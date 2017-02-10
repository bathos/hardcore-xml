import Decoder            from '../decoder';
import { Readable }       from 'stream';

import {
  isWhitespaceChar,
  EOF, LF, PARENTHESIS_LEFT, PERCENT_SIGN, PARENTHESIS_RIGHT, QUOTE_DBL,
  QUOTE_SNG, SPACE
} from '../data/codepoints';

import {
  DOCUMENT, EXT_PARSED_ENT, EXT_SUBSET, PARAMETER_REFERENCE
} from './productions';

const CONTEXT_LEN = 30;
const GREEN_START = '\u001b[32m';
const RED_END     = '\u001b[39m';
const RED_START   = '\u001b[31m';

const DEFAULT_OPTS = {
  maxExpansionCount: 10000,
  maxExpansionSize: 20000,
  target: 'document'
};

export default
class Processor extends Decoder {
  constructor(opts={}, document) {
    super(opts);

    const $opts = this._opts = Object.assign({}, DEFAULT_OPTS, opts);

    // Dereferencing (opts.dereference):
    //
    // Function which is called to get external entity text as a stream or
    // buffer. User may implement it according to their needs (local file
    // system, over HTTP, with caching layer, with host whitelist, etc). Only
    // required for documents that have external references.
    //
    // (type, { name, publicID, systemID, systemIDEncoded })
    // => Stream|Buffer|Promise(Stream|Buffer)
    //
    // publicID        : may be undefined
    // systemID        : may be undefined for entity
    // systemIDEncoded : url-encoded version of systemID if present
    // type            : will be either 'ENTITY' or 'DTD'

    this._dereference = opts.dereference;

    // Position tracking
    //
    // Used for outputting more informative error messages. Line and column are
    // obvious; textContext is a buffer (ring buffer?) of recently seen
    // codepoints, where the index marks the current "start" position.

    this.line             = 0;
    this.column           = -1;
    this.textContext      = new Uint32Array(CONTEXT_LEN);
    this.textContextIndex = 0;

    // Entity expansion (opts.maxExpansionCount, opts.maxExpansionSize)
    //
    // The two options (defaults: 10000 and 20000) exist to prevent entity
    // expansion attacks (aka Billion Laughs). They can be effectively disabled
    // by setting them to Infinity. The two other unprefixed properties model
    // the expansion state and total count seen, while __expansionPromise is for
    // transient promises that may ‘interrupt’ recursive expansions.

    this.activeExpansions   = [];
    this.expansionCount     = 0;
    this.maxExpansionCount  = $opts.maxExpansionCount;
    this.maxExpansionSize   = $opts.maxExpansionSize;
    this.__expansionPromise = undefined;

    // AST & root driver

    const rootProduction =
      $opts.target === 'document'  ? DOCUMENT :
      $opts.target === 'extSubset' ? EXT_SUBSET :
      $opts.target === 'extEntity' ? EXT_PARSED_ENT :
      undefined;

    if (!rootProduction) {
      throw new Error(`Target ${ $opts.target } is not recognized.`);
    }

    const driver = this.GRAMMAR_DRIVER(rootProduction, document);

    driver.next();

    this.eat = cp => driver.next(cp);

    // Event handling

    this.on('error', err => {
      this.haltAndCatchFire();
    });

    this.on('finish', () => {
      this.eat(EOF);
    });
  }

  // INPUT /////////////////////////////////////////////////////////////////////

  // An instance of GRAMMAR_DRIVER is the source of the "eat" method that gets
  // added at construction time. It is the intersection point between grammar
  // interpretation and the processor, as it may receive signals from the
  // specific production drivers that trigger behaviors back at home (e.g. a
  // signal can trigger the expansion of an entity).

  * GRAMMAR_DRIVER(rootProduction, document) {
    const iter = rootProduction(document);
    const node = iter.next().value;

    iter.next();

    const chaosBoundaries = [];

    let chaosMode = 0;
    let chaosDelim;
    let chaosIter;

    const injectedCPs = [];

    let greedHoldover;

    while (true) {
      let cp = greedHoldover || injectedCPs.shift() || (yield);

      if (chaosMode) {
        if (cp === PERCENT_SIGN && !chaosDelim) {
          const possibleChaosIter = PARAMETER_REFERENCE(node, false);

          possibleChaosIter.next();

          const innerCP = yield;

          // Special case: '%' may appear as part of one non-literal value: the
          // symbol in parameter entity declarations themselves. Therefore we
          // need to use the following CP to disambiguate.

          if (!isWhitespaceChar(innerCP)) {
            chaosIter = possibleChaosIter;
            cp = innerCP;
          } else {
            injectedCPs.unshift(innerCP);
          }
        }

        if (cp === chaosDelim) {
          chaosDelim = undefined;
        } else if (cp === QUOTE_DBL || cp === QUOTE_SNG) {
          chaosDelim = cp;
        }

        if (!chaosDelim) {
          if (cp === PARENTHESIS_LEFT) {
            chaosBoundaries.push(this.boundary());
          }

          if (cp === PARENTHESIS_RIGHT && chaosBoundaries.length) {
            chaosBoundaries.pop()()(); // haha yes
          }
        }
      }

      const activeIter = chaosIter || iter;

      let res = activeIter.next(cp);

      if (res.value instanceof Array) {
        injectedCPs.push(...res.value);
        res = activeIter.next();
        continue;
      } else if (typeof res.value === 'object') {
        switch (res.value.signal) {
          case 'CHAOS?':
            res = activeIter.next(Boolean(chaosMode));
            break;

          case 'CHAOS_PLEASE':
            chaosMode++;
            res = activeIter.next();
            break;

          case 'DEREFERENCE_DTD':
            this.dereference('extSubset', 'DOCTYPE', res.value.value, node);

            res = activeIter.next();

            break;

          case 'EXPAND_ENTITY':
            {
              const { entity, pad } = res.value.value;

              const cb = entity.hasExternalOrigin
                ? () => chaosMode--
                : () => undefined;

              if (entity.hasExternalOrigin) {
                chaosMode++;
              }

              res = activeIter.next(this.expandEntity({ entity, pad }, cb));
            }

            break;

          case 'EXPANSION_BOUNDARY':
            res = activeIter.next(this.boundary());
            break;

          case 'SET_ENCODING':
            this.setXMLEncoding(res.value.value, 'declared');
            res = activeIter.next();
            break;
        }
      }

      if (typeof res.value === 'number') {
        greedHoldover = res.value;
        res = activeIter.next();
      } else {
        greedHoldover = undefined;
      }

      if (typeof res.value === 'string') {
        this.expected(cp, res.value);
        return;
      }

      if (res.done) {
        if (chaosIter) {
          chaosIter = undefined;
          continue;
        }

        this.emit('ast', node);
        break;
      }
    }
  }

  // Called by the underlying Decoder for each incoming codepoint — wraps "eat"
  // with logic to advance our source text position and context. Note that the
  // eat method itself may be called outside of this during dereferencing, which
  // does not advance the source position.

  codepoint(cp) {
    this.column++;

    if (cp === 0x00) {
      // This could be caught alongside any other illegal characters in XML, but
      // capturing it here is worth the loss of clarity in the error message for
      // the sake of being able to say ‘all codepoints are truthy’.
      this.expected(cp, 'a valid XML character, not the NUL character');
    }

    this.eat(cp);

    this.textContext[this.textContextIndex] = cp;
    this.textContextIndex = (this.textContextIndex + 1) % CONTEXT_LEN;

    // Note that the decoder has already normalized newline sequences, so we
    // only need to handle LF:

    if (cp === LF) {
      this.line++;
    }
  }

  // Used to assemble error messages that provide context for where things went
  // awry. The message takes the codepoint that was being processed at the time
  // of failure and an expectation message that was produced by the grammar
  // drivers which indicates what the valid continuations would have been.

  expected(cp, expectation) {
    const prefix =
      cp === EOF ? `Hardcore processor input ended abruptly` :
      cp         ? `Hardcore processor failed at 0x${ cp.toString(16) }` :
                   `Hardcore processor failed`;

    const context = `${ GREEN_START }${
      String.fromCodePoint(...[
        ...this.textContext.slice(this.textContextIndex),
        ...this.textContext.slice(0, this.textContextIndex)
      ].filter(Boolean)).replace(/\n/g, ' ')
    }${ RED_START }`;

    const contextStr =
      cp === EOF ? `${ context }[EOF]${ RED_END }` :
      cp         ? `${ context }${ String.fromCodePoint(cp) }${ RED_END }` :
                   `${ context }[<--]${ RED_END }`;

    const ellipsis = this.textContext.includes(0) ? '' : '[...]';

    this.emit('error', new Error(
      `${ prefix }, line ${ this.line }, column ${ this.column }:\n` +
      `${ ellipsis }${ contextStr }\n` +
      `Expected ${ expectation.replace(/"""/, '\'"\'') }.`
    ));
  }

  // DEREFERENCING & EXPANSION /////////////////////////////////////////////////

  // Used to sanity-check the boundaries of entity expansions. This is mainly
  // for use with general entity expansions, since parameter entity expansions
  // have a built-in mechanism for the same effect (they pad the start and end
  // of the replacement text with whitespace).
  //
  // The method returns a function which returns a function. The second tier is
  // needed to handle cases where the initial character of a potential boundary
  // violation is ambiguous — for example, assume we have a general entity, ass,
  // whose replacement text is "wat<".
  //
  // <poop>&ass;/poop>
  //
  // When we hit "&", we call boundary() to get the "locking" function. When we
  // hit "<", we call the locking function to get the "explode" function. When
  // we hit the "/", we call the explode function, and because we "locked on" at
  // the "<", even though we are now back in the original context, it explodes.
  // (There’s a bit boundary stuff that would occur in that example, but that
  // covers the main idea).

  boundary() {
    const [ initialContext ] = this.activeExpansions;

    return () => {
      const [ terminalContext ] = this.activeExpansions;

      return () => {
        if (initialContext === terminalContext) {
          return;
        }

        if (initialContext && initialContext.active) {
          this.expected(undefined,
            `that, when dereferencing the ‘${ initialContext.name }’ ` +
            `entity, it would not violate hierarchical boundaries — a ` +
            `single entity must not terminate any markup structures which ` +
            `it did not begin`
          );
        } else {
          this.expected(undefined,
            `that, when dereferencing the ‘${ terminalContext.name }’ ` +
            `entity, it would not violate hierarchical boundaries — a ` +
            `single entity must terminate any markup structures which it ` +
            `began`
          );
        }
      };
    };
  }

  // Wraps user’s dereference function; launches a second parser to handle the
  // external entity and resolves with the AST (in the case of external parsed
  // or general entities, this just means an array of codepoints, however).

  dereference(target, type, entityData, document) {
    this.haltAndCatchFire();

    const data = {
      name:            entityData.name,
      publicID:        entityData.publicID,
      systemID:        entityData.systemID,
      systemIDEncoded: entityData.systemID && encodeURI(entityData.systemID)
    };

    const promise = Promise
      .resolve(this._dereference(type, data))
      .then(bufferOrStream => new Promise((resolve, reject) => {
        const opts      = Object.assign({}, this._opts, { target });
        const processor = new Processor(opts, document);

        processor.on('error', reject);
        processor.on('ast', resolve);

        if (bufferOrStream instanceof Buffer) {
          processor.end(bufferOrStream);
        } else if (bufferOrStream instanceof Readable) {
          bufferOrStream.pipe(processor);
        } else {
          reject(new Error(
            `Cannot dereference ${ entityData.name } ${ type }: ` +
            `user-supplied dereferencing function returned ` +
            `${ bufferOrStream }; expected Buffer or Readable stream.`
          ));
        }
      }));

    promise
      .then(() => this.unhalt())
      .catch(err => this.emit('error', err));

    return promise;
  }

  // Given an entity (an actual EntityDeclaration node in practice, but could be
  // any object implementing at least "name", "type", and either "value" or
  // "systemID"), halts normal flow, resolves the entity replacement text if
  // necessary, and dereferences the entity by injecting the replacement text.
  // Since entity expansion may be recursive (just not circular), we have to do
  // a little dance.
  //
  // Note that in the case of resolving externals, this mutates the entity
  // object (it adds the `value` property if it was absent).

  expandEntity({ entity, pad }, cb) {
    this.haltAndCatchFire();

    const ancestors = this.activeExpansions.slice();

    const ticket = {
      active: true,
      increment: () => {
        ticket.length++;

        if (ticket.length > this.maxExpansionSize) {
          this.expected(undefined,
            `Entity ${ entity.name } not to expand to larger than the ` +
            `maximum permitted size, ${ this.maxExpansionSize }`
          );
        }

        ancestors.forEach(ticket => ticket.increment());
      },
      length: 0
    };

    const promise = this.__expansionPromise = new Promise(resolve => {
      const { name } = entity;

      this.expansionCount++;

      if (this.expansionCount > this.maxExpansionCount) {
        this.expected(undefined,
          `not to surpass the maximum number of permitted expansions, ` +
          `${ this.maxExpansionCount }`
        );
      }

      if (this.activeExpansions.some(expansion => expansion.name === name)) {
        const chain = this.activeExpansions
          .map(expansion => expansion.name)
          .reverse()
          .join(' => ');

        this.expected(undefined,
          `entity ${ name } not to include a recursive reference to itself ` +
          `(${ chain } => ${ name })`
        );
      }

      this.activeExpansions.unshift(ticket);

      resolve(entity.value || this.dereference('extEntity', 'ENTITY', entity));
    }).then(origCPs => {
      entity.value = origCPs;

      const cps  = pad ? [ SPACE, ...origCPs, SPACE ] : origCPs;
      const iter = cps[Symbol.iterator]();

      const expand = () => {
        let cp;

        this.__expansionPromise = promise;

        // Note: Cannot be for loop due to satanic automatic iterator closing.

        while (cp = iter.next().value) {
          ticket.increment();
          this.eat(cp);

          if (this.__expansionPromise !== promise) {
            this.__expansionPromise.then(expand);
            return;
          }
        }

        ticket.active = false;
        this.activeExpansions.shift();
        this.unhalt();
        cb();
      };

      expand();
    }).catch(err => this.emit('error', err));

    return ticket;
  }
}
