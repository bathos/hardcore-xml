import Decoder            from '../decoder';
import { EOF, LF }        from '../data/codepoints';
import { Readable }       from 'stream';

import {
  DOCUMENT, EXT_PARSED_ENT, EXT_SUBSET
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
  constructor(opts={}) {
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
    // by setting them to Infinity.

    this.expansionCount    = 0;
    this.maxExpansionCount = $opts.maxExpansionCount;
    this.maxExpansionSize  = $opts.maxExpansionSize;

    // AST & root driver

    const rootProduction =
      $opts.target === 'document'  ? DOCUMENT :
      $opts.target === 'extSubset' ? EXT_SUBSET :
      $opts.target === 'extEntity' ? EXT_PARSED_ENT :
      undefined;

    if (!rootProduction) {
      throw new Error(`Target ${ $opts.target } is not recognized.`);
    }

    const driver = this.GRAMMAR_DRIVER(rootProduction);

    driver.next();

    this.eat = cp => driver.next(cp);

    // Event handling

    this.on('error', err => {
      console.log(err);
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

  * GRAMMAR_DRIVER(rootProduction) {
    const iter = rootProduction();
    const node = iter.next().value;

    iter.next();

    let greedHoldover;

    while (true) {
      const cp  = greedHoldover || (yield);

      let res = iter.next(cp);

      if (typeof res.value === 'number') {
        greedHoldover = res.value;
        res = iter.next();
      } else {
        greedHoldover = undefined;
      }

      if (typeof res.value === 'object') {
        switch (res.value.signal) {
          // case DEFINE_ENTITY:
          //   this.entities.set(res.value.entity.name, res.value.entity);
          //   iter.next();
          //   break;
          case 'DEREFERENCE_DTD':
            this
              .dereferenceDTD(res.value.value)
              .then(external => iter.next(external));

            break;
          // case EXPAND_ENTITY:
          //   this.expandEntity(res.value.entity);
          //   iter.next();
          //   break;
          // case SET_BOUNDARY:
          //   iter.next(this.setBoundary());
          //   break;
          case 'SET_ENCODING':
            this.setXMLEncoding(res.value.value, 'declared');
            res = iter.next();
            break;
        }
      }

      if (typeof res.value === 'string') {
        console.log(node);
        this.expected(cp, res.value);
        return;
      }

      if (res.done) {
        this.emit('ast', node);
        break;
      }
    }
  }

  // Called by the underlying Decoder for each incoming codepoint — wraps "eat"
  // with logic to advance our source text position and context.

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

    throw new Error(
      `${ prefix }, line ${ this.line }, column ${ this.column }:\n` +
      `${ ellipsis }${ contextStr }\n` +
      `Expected ${ expectation }.`
    );
  }

  // DEREFERENCING /////////////////////////////////////////////////////////////

  dereference(type, entity) {
    const data = {
      name:            entity.name,
      publicID:        entity.publicID,
      systemID:        entity.systemID,
      systemIDEncoded: entity.systemID && encodeURI(entity.systemID)
    };

    return Promise.resolve(this._dereference(type, data));
  }

  dereferenceDTD(doctypeData) {
    this.haltAndCatchFire();

    const dtdPromise = this
      .dereference('DTD', doctypeData)
      .then(bufferOrStream => new Promise((resolve, reject) => {

        const dtdProcessor = new Processor(Object.assign({}, this._opts, {
          target: 'extSubset'
        }));

        dtdProcessor.on('error', reject);
        dtdProcessor.on('ast', resolve);

        if (bufferOrStream instanceof Buffer) {
          dtdProcessor.end(bufferOrStream);
        } else if (bufferOrStream instanceof Readable) {
          bufferOrStream.pipe(dtdProcessor);
        }
      }));

    dtdPromise
      .then(() => {
        this.unhalt();
      })
      .catch(err => {
        this.emit('error', err);
      });

    return dtdPromise;
  }

  dereferenceEntity() {
    // TODO
  }

  // ENTITIES //////////////////////////////////////////////////////////////////

  expandEntity() {
    // TODO
  }

  setBoundary() {
    // TODO
  }
}
