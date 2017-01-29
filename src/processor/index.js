import Decoder         from '../decoder';
import ExpansionTicket from './expansion-ticket';
import { Readable }    from 'stream';

import {
  // CHARACTER CLASS MEMBERSHIP PREDICATES

  isAttValueCharDbl,
  isAttValueCharSng,
  isCDATAChar,
  isCDATASectionChar,
  isCommentChar,
  isDecChar,
  isEncContinueChar,
  isEncStartChar,
  isEntityValueCharDbl,
  isEntityValueCharSng,
  isHexChar,
  isLChar,
  isMChar,
  isNameContinueChar,
  isNameStartChar,
  isProcInstValueChar,
  isPublicIDCharDbl,
  isPublicIDCharSng,
  isSystemIDCharDbl,
  isSystemIDCharSng,
  isWhitespaceChar,
  isXChar,
  isXMLChar,

  // INDIVIDUAL CODEPOINTS

  A_LOWER, A_UPPER, AMPERSAND, ASTERISK, B_UPPER, BRACKET_LEFT, BRACKET_RIGHT,
  C_LOWER, C_UPPER, COMMA, D_LOWER, D_UPPER, E_LOWER, E_UPPER, EQUALS_SIGN,
  EXCLAMATION_POINT, F_UPPER, G_LOWER, G_UPPER, GREATER_THAN, HASH_SIGN, HYPHEN,
  I_LOWER, I_UPPER, K_UPPER, L_LOWER, L_UPPER, LESS_THAN, LF, M_LOWER, M_UPPER,
  N_LOWER, N_UPPER, O_LOWER, O_UPPER, ONE, P_UPPER, PARENTHESIS_LEFT,
  PARENTHESIS_RIGHT, PERCENT_SIGN, PERIOD, PIPE, PLUS_SIGN, Q_UPPER,
  QUESTION_MARK, QUOTE_DBL, QUOTE_SNG, R_LOWER, R_UPPER, S_LOWER, S_UPPER,
  SEMICOLON, SLASH, SPACE, T_LOWER, T_UPPER, U_UPPER, V_LOWER, X_LOWER, X_UPPER,
  Y_LOWER, Y_UPPER,

  // SPECIAL CASE

  EOF,

  // CODEPOINT SEQUENCES

  ANY_CPS,
  ATTLIST_CPS,
  CDATA_CPS,
  DOCTYPE_CPS,
  EMENT_CPS,
  EMPTY_CPS,
  ENCODING_CPS,
  FIXED_CPS,
  IDREF_CPS,
  IGNORE_CPS,
  IMPLIED_CPS,
  INCLUDE_CPS,
  NDATA_CPS,
  NMTOKEN_CPS,
  NO_CPS,
  NOTATION_CPS,
  PCDATA_CPS,
  PUBLIC_CPS,
  REQUIRED_CPS,
  STANDALONE_CPS,
  SYSTEM_CPS,
  TITY_CPS,
  VERSION_CPS,
  YES_CPS
} from '../data/codepoints';

import entities from '../data/entities';

const CONTEXT_LEN = 30;
const GREEN_START = '\u001b[32m';
const RED_END     = '\u001b[39m';
const RED_START   = '\u001b[31m';

// STANDARD CONTENT PATTERNS ///////////////////////////////////////////////////

export const ANY_CONTENT_PATTERN   = /(?:)/;
export const CDATA_CONTENT_PATTERN = /^(?: #text)*$/;
export const EMPTY_CONTENT_PATTERN = /^$/;

// MULTI-CP CHECKS /////////////////////////////////////////////////////////////

// Note that isPITarget and isXMLDeclStart are not inversions of each other.

const isPITarget = ([ x, m, l, ...rest ]) =>
  rest.length ||
  !isXChar(x) ||
  !isMChar(m) ||
  !isLChar(l);

const isXMLDeclStart = ([ x, m, l, ...rest ]) =>
  !rest.length &&
  x === X_LOWER &&
  m === M_LOWER &&
  l === L_LOWER;

// FORMATTING UTIL /////////////////////////////////////////////////////////////

// "1st", "2nd" etc (but for zero-indexed)

const ordinalOf = n => {
  if (n === 10 || n === 11 || n === 12) {
    return `${ n + 1 }th`;
  }

  switch (n % 10) {
    case 0: return `${ n + 1 }st`;
    case 1: return `${ n + 1 }nd`;
    case 2: return `${ n + 1 }rd`;
    default: return `${ n + 1 }th`;
  }
};

// Generated expectation message for failing to match a specific series.

const seriesFailMsg = (expectedCPs, expectedCP, index) => {
  const expectedString = String.fromCodePoint(...expectedCPs);
  const character      = String.fromCodePoint(expectedCP);

  const occursMultipleTimes =
    expectedCPs.indexOf(expectedCP) !==
    expectedCPs.lastIndexOf(expectedCP);

  const indexWithin =
    expectedCPs
      .slice(0, index)
      .filter(cp => cp === expectedCP)
      .length;

  const ordinal =
    !occursMultipleTimes
      ? '' :
      `${ ordinalOf(indexWithin) } `;

  return `the ${ ordinal }"${ character }" in "${ expectedString }"`;
};

// PROCESSOR ///////////////////////////////////////////////////////////////////

const DEFAULT_OPTS = {
  maxExpansionCount: 10000,
  maxExpansionSize: 20000,
  target: 'document'
};

// Generally it’s desireable to distinguish between parsing and lexing and build
// up the syntactic grammar over the lexical grammar and all that.
//
// I gave up on that idea fairly early on, I’m afraid.
//
// A simple, non-validating XML parser unconcerned with DTDs could do this
// easily, but things like parameter entity expansion and asynchronously
// dereferencing external entities that impact further lexing/parsing made
// maintaining the distinction more complicated than not maintaining it.
//
// The XML spec itself refers repeatedly to "XML processors", so I used that
// nomenclature as "Lexer", "Tokenizer", and "Parser" all seemed inappropriate.

export default
class Processor extends Decoder {
  constructor(opts={}) {
    super(opts);

    const $opts = this._opts = Object.assign({}, DEFAULT_OPTS, opts);

    // USER-PROVIDED DEREFERENCE FUNCTION
    //
    // - opts.dereference
    //
    //    should be a function that takes (type, info) and returns a
    //    buffer or stream or a promise that resolves to a buffer or stream.
    //    The "type" arg is "DTD" or "ENTITY". The info object will have some
    //    combination of "publicID" and "systemID" properties, and if "systemID"
    //    is populated, so too will be "systemIDEncoded", which is a URL-encoded
    //    version of the systemID for convenience. When type is DTD, the "name"
    //    property will also be provided.
    //
    //    Unparsed entities are not dereferenced. We will maintain the reference
    //    information and it will be available in the resulting AST, but there
    //    is no reason I can see to dereference these values during parsing.

    this._dereference = opts.dereference;

    // POSITION & CONTEXT
    //
    // We maintain knowledge of positional context (line, column) in order to
    // output informative error messages. Further we keep a buffer (I guess this
    // is a "ring buffer"?) of recently seen codepoints so we can display the
    // immediate context preceding an offending codepoint (textContext is the
    // buffer; textContentIndex is the position of the "first" codepoint).

    this.line             = 0;
    this.column           = -1;
    this.textContext      = new Uint32Array(CONTEXT_LEN);
    this.textContextIndex = 0;

    // ENTITY EXPANSION OPTIONS & STATE
    //
    // - opts.maxExpansionCount
    // - opts.maxExpansionSize
    //
    //    These two options (which have default values of 10000 and 20000
    //    respectively) are upper limits to the total number of expansions which
    //    may occur while parsing and the total size (in codepoints, not bytes)
    //    which a single reference (including any references within) may expand
    //    to. This is important for preventing expansion exploit attacks
    //    (aka billion laughs), though you can adjust the numbers or, if you
    //    wanted to disable them, set them to Infinity.
    //
    // The "expansionCount" property is incremented with each new expansion.
    // There is no "expansionSize" property; this would be represented by the
    // "length" property of specific ExpansionTickets.
    //
    // The "activeExpansions" array is a stack (FILO, where the currently
    // expanding entity is at position zero) of ExpansionTickets.
    //
    // The "entities" property is a map of names to objects which represent
    // declared entities (as well as the implicit general entities like &amp;).
    // Each of these objects takes the form { cps, publicID, systemID, type }
    // where "type" may be "GENERAL", "PARAMETER", or "UNPARSED" and "cps" is
    // the array of codepoints of the replacement text. The cps array is always
    // defined if the entity is internal (i.e., had a string literal value) and
    // if it is external, it becomes defined only after it is first
    // dereferenced. Some combination of the "publicID" and "systemID"
    // properties will be defined if the entity is external.
    //
    // The "__expansionPromise__" is a facet of the somewhat complex control
    // flow of expansion management, as some expansions may be asynchronous
    // owing to the fact that external entities are only dereferenced when a
    // reference actually first occurs. Its value is a promise associated with
    // whatever is the current deepest expansion underway.

    this.expansionCount    = 0;
    this.maxExpansionCount = $opts.maxExpansionCount;
    this.maxExpansionSize  = $opts.maxExpansionSize;
    this.activeExpansions  = [];

    this.__expansionPromise__ = undefined;

    // REGISTERS

    this.entities  = new Map(entities.xml);
    this.elements  = new Map();
    this.notations = new Map();

    // TERMINAL ITERATOR
    //
    // - opts.target
    //
    //    The possible values for "target" are "document", "extSubset", and
    //    "extEntity". It is not expected that users provide these values (the
    //    default is "document"). It indicates the target production. Each of
    //    these correspond to a state which is both initial and terminal, and
    //    which understands and expects the "EOF" symbol.
    //
    // The "eat" method is just the "next" function of an instance of the
    // corresponding target generator. This is what’s cool about using
    // generators for lexing and parsing: Generators can *self-describe*
    // hierarchical patterns (XML is not context free) and state transitions
    // through yield * delegation — it’s all "free", and local state can be
    // modeled as the contents of that specific closure. Though surely this is
    // more expensive than having a billion explicit one-codepoint state methods
    // & a big mess of extra stateful properties smashed onto the instance, the
    // code ends up cleaner & easier to debug. Generators provided a beautiful,
    // language-level/first-class representation of the problem space itself.
    //
    //                    💓💓💓 thank u tc39 💓💓💓

    const eater =
      $opts.target === 'document'  ? this.DOCUMENT() :
      $opts.target === 'extSubset' ? this.EXT_SUBSET() :
      $opts.target === 'extEntity' ? this.EXT_ENTITY() :
      undefined;

    if (!eater) {
      throw new Error(`Target ${ $opts.target } is not recognized.`);
    }

    eater.next();

    this.eat = cp => eater.next(cp);

    // EVENT HANDLING

    // When an error is emitted, regardless of other handling, we need to halt
    // all further processing (the processor is now in an invalid state and we
    // do not attempt any fuzzy recovery stuff — hardcore is strict).

    this.on('error', err => {
      console.log(err);
      this.haltAndCatchFire();
    });

    // EOF: All terminal states expect an EOF symbol; this is important for
    // ensuring our terminal state is, in fact, the expected terminal state.
    // Like any invalid codepoint, it will lead to an error if it occurs in a
    // position which was not ready to accept it. Further, in the case of
    // external general or parameter entities, the EOF is needed in order to
    // ensure the emission of the replacement text event, since that production
    // has no other delimiter. EOF is represented as an object, by the way, so
    // that it is unique, truthy, and returns false for all numeric comparisons.

    this.on('finish', () => {
      this.eat(EOF);
    });
  }

  // INPUT AND OUTPUT //////////////////////////////////////////////////////////

  // Called by decoder with each codepoint from input stream — calls eat() but
  // also advances position markers of source text for error reporting. Note
  // that newlines have already been normalized. (This overwrites the inherited
  // definition of the codepoint method in Decoder, which is intended mainly for
  // testing.)

  codepoint(cp) {
    this.column++;

    if (cp === 0x00) {
      // This could be caught alongside any other illegal characters in XML, so
      // capturing it early is just for my own convenience: I don’t want to have
      // to worry about falsy CP values, which would force us to change
      // expressions like "cp || (yield)" to "cp === undefined ? (yield) : cp".
      // It would be a little too easy to accidentally forget to handle. The
      // cost is a less informative error message, missing the normal contextual
      // expectation statement.
      this._expected(cp, 'a valid XML character, not the NUL character');
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

  // DTD METHODS, DEREFERENCING & SECONDARY TEXT RESOLUTION ////////////////////

  // Register a "boundary," meaning a context which must either be entirely
  // inside one entity expansion or entirely outside all entity expansions. The
  // function returned, when called, locks in a terminal position but does not
  // test it — rather it returns a third function that performs the test. This
  // distinction is important for boundaries where the leading character is
  // ambiguous until more is seen.

  boundary() {
    const [ boundaryTicket ] = this.activeExpansions;

    return () => {
      const [ terminalTicket ] = this.activeExpansions;

      return () => {
        if (boundaryTicket !== terminalTicket) {
          if (boundaryTicket && boundaryTicket.active) {
            this._expected(undefined,
              `that, when dereferencing the ‘${ boundaryTicket.name }’ ` +
              `entity, it would not violate hierarchical boundaries. A ` +
              `single entity must not terminate any markup structures which ` +
              `it did not begin`
            );
          } else {
            this._expected(undefined,
              `that, when dereferencing the ‘${ boundaryTicket.name }’ ` +
              `entity, it would not violate hierarchical boundaries. A ` +
              `single entity must terminate any markup structures that it ` +
              `begins`
            );
          }
        }
      };
    };
  }

  // Wrapper that switches an iterator into "parameters anywhere" mode.

  * chaoticNeutral(iter) {
    const parenBoundaries = [];

    let literalDelimiter;
    let cp;

    iter.next();

    while (true) {
      cp = yield;

      if (cp === PERCENT_SIGN && !literalDelimiter) {
        yield * this.PARAMETER_ENTITY_REFERENCE();
        continue;
      }

      if (cp === literalDelimiter) {
        literalDelimiter = undefined;
      } else if (cp === QUOTE_DBL || cp === QUOTE_SNG) {
        literalDelimiter = cp;
      }

      if (!literalDelimiter) {
        if (cp === PARENTHESIS_LEFT) {
          parenBoundaries.push(this.boundary());
        }

        if (cp === PARENTHESIS_RIGHT && parenBoundaries.length) {
          parenBoundaries.pop()()(); // haha yes
        }
      }

      const { done } = iter.next(cp);

      if (done) {
        return;
      }
    }
  }

  declareAttribute(attr) {
    // TODO
  }

  declareElement(element) {
    if (this.elements.has(element.name)) {
      this._expected(
        undefined,
        `the element ${ element.name } to be declared only once`
      );
    }

    this.elements.set(element.name, element);
  }

  declareEntity(entity) {
    if (entity.notation && !this.notations.has(entity.notation)) {
      this._expected(
        undefined,
        `notation ${ entity.notation } to have been declared`
      );
    }

    if (!this.entities.has(entity.name)) {
      this.entities.set(entity.name, entity);
    }
  }

  dereference(type, data) {
    return Promise.resolve(this._dereference(type, data));
  }

  dereferenceDTD(doctype) {
    if (!doctype.systemID) {
      return;
    }

    this.haltAndCatchFire();

    this
      .dereference('DTD', {
        name:            doctype.name,
        publicID:        doctype.publicID,
        systemID:        doctype.systemID,
        systemIDEncoded: encodeURI(doctype.systemID)
      })
      .then(bufferOrStream => new Promise((resolve, reject) => {
        const interceptor = this;

        const Intercepted = class extends Processor {
          declareAttribute(attr) {
            super.declareAttribute(attr);
            interceptor.declareAttribute(attr);
          }

          declareElement(element) {
            super.declareElement(element);
            interceptor.declareElement(element);
          }

          declareEntity(entity) {
            super.declareEntity(entity);
            interceptor.declareEntity(entity);
          }

          declareNotation(notation) {
            super.declareNotation(notation);
            interceptor.declareNotation(notation);
          }
        }

        const dtdProcessor = new Intercepted(Object.assign({}, this._opts, {
          target: 'extSubset'
        }));

        dtdProcessor.elements  = new Map(this.elements);
        dtdProcessor.entities  = new Map(this.entities);
        dtdProcessor.notations = new Map(this.notations);

        dtdProcessor.on('error', reject);
        dtdProcessor.on('finish', resolve);

        if (bufferOrStream instanceof Buffer) {
          dtdProcessor.end(bufferOrStream);
        } else if (bufferOrStream instanceof Readable) {
          bufferOrStream.pipe(dtdProcessor);
        }
      }))
      .then(() => {
        this.unhalt();
      })
      .catch(err => {
        this.emit('error', err);
      });
  }

  expandEntity(type, entityCPs) {
    this.haltAndCatchFire();

    const entityName = String.fromCodePoint(...entityCPs);
    const expansionTicket = new ExpansionTicket(entityName, this);

    const expansionPromise = this.__expansionPromise__ = this
      .resolveEntityText(type, entityName)
      .then(entity => new Promise((resolve, reject) => {
        expansionTicket.external = Boolean(entity.systemID || entity.publicID);

        const cps = type === 'PARAMETER' && this.activeExpansions.length === 1
          ? [ SPACE, ...entity.cps, SPACE ]
          : entity.cps;

        const iter = cps[Symbol.iterator]();

        const expand = () => {
          let cp;

          this.__expansionPromise__ = expansionPromise;

          while (cp = iter.next().value) {
            expansionTicket.increment();
            this.eat(cp);

            if (this.__expansionPromise__ !== expansionPromise) {
              this.__expansionPromise__.then(expand).catch(reject);
              return;
            }
          }

          resolve();
        };

        expand();
      }))
      .then(() => {
        if (this.__expansionPromise__ === expansionPromise) {
          this.__expansionPromise__ = undefined;
        }

        expansionTicket.close();
        this.unhalt();
      })
      .catch(err => {
        this.emit('error', err);
      });

    return expansionTicket;
  }

  resolveEntityText(type, name) {
    if (!this.entities.has(name)) {
      return Promise.reject(new Error(`Entity ${ name } was never declared.`));
    }

    const entity = this.entities.get(name);

    if (entity.type !== type) {
      return Promise.reject(new Error(
        `Entity ${ name } is ${ entity.type }, not ${ type }.`
      ));
    }

    if (entity.cps) {
      return Promise.resolve(entity);
    } else {
      return this.dereference('ENTITY', {
        publicID: entity.publicID,
        systemID: entity.systemID,
        systemIDEncoded: entity.systemID && encodeURI(entity.systemID)
      }).then(bufferOrStream => {
        const entProcessor = new Processor(Object.assign({}, this._opts, {
          target: 'extEntity'
        }));

        entProcessor.on('REPLACEMENT_TEXT', resolve);
        entProcessor.on('error', reject);

        if (bufferOrStream instanceof Buffer) {
          entProcessor.end(bufferOrStream);
        } else if (bufferOrStream instanceof Readable) {
          bufferOrStream.pipe(entProcessor);
        }
      }).then(cps => {
        entity.cps = cps;
        return entity;
      });
    }
  }

  setStandalone(standalone) {
    // TODO
  }

  // ERROR BARFING /////////////////////////////////////////////////////////////

  // Generic barf on bad continuation. Expects the offending CP & a description
  // of what would have been valid (`Expected ${ msg }`).

  _expected(cp, msg) {
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
      `Expected ${ msg }.`
    );
  }

  // ADVANCERS /////////////////////////////////////////////////////////////////
  //
  // These generators abstract away common matching operations needed in lexing
  // logic. They are composeable, such that you can nest a series of them one
  // inside the other. This pattern allows the actual state methods to be
  // focused on logic that is either about:
  //
  // - disjunctions or
  // - meta-poop like node assembly
  //
  // All of these methods take four arguments:
  //
  // - expectation: depending on the method, this will be a single CP, an array
  //   of CPs, or a predicate function from data/character-classes.
  // - acc: optional array into which any matches will be deposited. If this is
  //   not provided, the matched characters are simply discarded.
  // - cp: an optional initial codepoint to begin matching from.
  //
  // The last item is important for composability. The advancers can be divided
  // into two categories, greedy and non-greedy, and the greedy ones will return
  // the first codepoint which was not matched. This contract allows greedy and
  // non-greedy advancers to interact correctly:
  //
  // const numberCPs = [];
  //
  // const firstCharWhichIsNotPartOfNumber =
  //   yield * this.zeroOrMoreWhere('...', isDecChar, numberCPs,
  //     yield * this.oneIs('...', PERIOD, numberCPs,
  //       yield * this.oneOrMoreWhere('...', isDecChar, numberCPs)
  //     )
  //   );
  //
  // Alternatively, this could be written more linearly, which is what I’ve
  // generally preferred simply because it’s the order we read things in:
  //
  // cp = yield * this.oneOrMoreWhere('...', isDecChar, numberCPs);
  // cp = yield * this.oneIs('...', PERIOD, numberCPs, cp);
  // cp = yield * this.zeroOrMoreWhere('...', isDecChar, numberCPs, cp);
  //
  // Each method can be considered equivalent to applying an EBNF/regex
  // quantifier (*, +, none) to either literal characters ("is") or character
  // classes ("where"). Not every possible combination is represented since some
  // would never be used (e.g. zeroOrMoreIs) — plus some variations might imply
  // the need for backtracking, which fortunately is entirely avoidable in XML.

  // ONEIS
  // Match a single, specific codepoint.
  //
  // :: Like /^x/
  // :: Non-greedy — does not have a return CP
  // :: Fail msg — '"p"'

  * oneIs(expectedCP, acc, cp) {
    cp = cp || (yield);

    if (cp === expectedCP) {
      if (acc) {
        acc.push(cp);
      }

      return;
    }

    const msg = `"${ String.fromCodePoint(expectedCP) }"`;

    this._expected(cp, msg);
  }

  // ONEORMOREIS
  // Match a specific codepoint one or more times.
  //
  // :: Like /^x+/
  // :: Greedy — will return the first CP which is not matched.
  // :: Fail msg: '"p"'

  * oneOrMoreIs(expectedCP, acc, cp) {
    yield * this.oneIs(expectedCP, acc, cp);

    while (true) {
      if ((cp = yield) === expectedCP) {
        if (acc) {
          acc.push(cp);
        }
      } else {
        return cp;
      }
    }
  }

  // ONEORMOREWHERE
  // Match one or more codepoints satisfying a predicate.
  //
  // :: Like /^[xyz]+/
  // :: Greedy — will return the first CP which is not matched.
  // :: Fail msg — 'at least one valid decimal number character after ${ msg }'

  * oneOrMoreWhere(pred, acc, cp) {
    return yield * this.zeroOrMoreWhere(pred, acc,
      yield * this.oneWhere(pred, acc, cp, true)
    );
  }

  // ONEWHERE
  // Match a single codepoint satisfying a predicate. The extra arg is for
  // altering the failure message slightly when used by oneOrMore.
  //
  // :: Like /^[xyz]/
  // :: Non-greedy — does not have a return CP
  // :: Fail msg — 'a valid decimal number character after ${ msg }'

  * oneWhere(pred, acc, cp, fromOneOrMore) {
    cp = cp || (yield);

    if (pred(cp)) {
      if (acc) {
        acc.push(cp);
      }

      return;
    }

    const prefix =
      fromOneOrMore ? `at least one` : `a`;

    const msg =
      `${ prefix } ${ pred.description } character`;

    this._expected(cp, msg);
  }

  // SERIESIS
  // Match a series of specific codepoints.
  //
  // :: Like /^xyz/
  // :: Non-greedy — does not have a return CP
  // :: Fail msg — 'the 1st "p" in "poop"'

  * seriesIs(expectedCPs, acc, cp) {
    for (const [ index, expectedCP ] of expectedCPs.entries()) {
      const actualCP = cp || (yield);

      if (actualCP === expectedCP) {
        if (acc) {
          acc.push(cp);
        }

        cp = undefined;
        continue;
      }

      const msg = seriesFailMsg(expectedCPs, expectedCP, index);

      this._expected(actualCP, msg);
    }
  }

  // ZEROORMOREWHERE
  // Match zero or more codepoints satisfying a predicate.
  //
  // :: Like /^[xyz]*/
  // :: Greedy — will return the first CP which is not matched.
  // :: Fail msg — inapplicable

  * zeroOrMoreWhere(pred, acc, cp) {
    if (cp) {
      if (pred(cp)) {
        if (acc) {
          acc.push(cp);
        }
      } else {
        return cp;
      }
    }

    while (pred(cp = yield)) {
      if (acc) {
        acc.push(cp);
      }
    }

    return cp;
  }

  //////////////////////////////////////////////////////////////////////////////
  // STATE METHODS /////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////
  //
  // Each of these is a generator which will be delegated to at various times as
  // we iterate over incoming codepoints. Some of them accept an initial CP and
  // others do not; some of them return a final CP and others do not. This
  // reflects the nature of the production terminus (greedy vs non-greedy, etc).
  // I’m really happy with how this approach turned out, since before this the
  // code was much longer, much wetter, and much hairier: I had a single method
  // corresponding to each codepoint-level state, totalling hundreds.
  //
  // The biggest benefit is that it naturally encapsulates stateful information
  // precisely where it’s needed in simple closures, letting us avoid a mishmash
  // of stateful properties on the instance that actually only pertain to one
  // specific operation or another; relatedly, we do not even need to do things
  // like maintain an explicit stack for hierarchies (since it’s implicit in the
  // delegation-based logical structure).
  //
  // Of the methods below, some represent distinct pathways that *must* be
  // unique generators, either because they can are terminal states (e.g.
  // DOCUMENT), or because they may form cycles (e.g. ELEMENT), or because they
  // can be entered from multiple states of the first two types (e.g. COMMENT).
  // In addition, though some methods are purely organizational, as their
  // content could have been subsumed by only one of the methods in the first
  // category. To avoid loss of data (it is useful to understand which methods
  // ‘atomic’ and which exist only for code organization), I’ve named ‘atomic’
  // states as "POOP" and purely organization states as "POOP_suffix".
  //
  //////////////////////////////////////////////////////////////////////////////

  // ATTLIST DECLARATION ///////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ NO RETURN VALUE
  //
  // Beginning immediately after "<!A". Registers one or more attribute
  // definitions associated with a declared element.

  * ATTLIST_DECL() {
    // TODO
  }

  // CHARACTER REFERENCE ///////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✔ RETURNS RESOLVED CP
  //
  // Beginning immediately after "&#".

  * CHARACTER_REFERENCE() {
    let cp = yield;

    const [ base, pred, digitCPs ] =
      cp === X_LOWER ? [ 16, isHexChar, [] ] :
      isDecChar(cp)  ? [ 10, isDecChar, [ cp ] ] :
      [];

    if (!pred) {
      this._expected(cp, '"x" or a decimal digit');
    }

    cp = yield * this.oneOrMoreWhere(pred, digitCPs);

    const resultCP = Number.parseInt(String.fromCodePoint(...digitCPs), base);

    if (!isXMLChar(resultCP)) {
      this._expected(cp, 'a char reference describing at a valid codepoint');
    }

    yield * this.oneIs(SEMICOLON, undefined, cp);

    return resultCP;
  }

  // COMMENT ///////////////////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ RETURNS RAW COMMENT NODE
  //
  // Starting from immediately after "<!-".

  * COMMENT() {
    const commentCPs = [];

    let cp = yield * this.oneIs(HYPHEN);

    while (true) {
      cp = yield * this.zeroOrMoreWhere(isCommentChar, commentCPs);
      cp = yield * this.oneIs(HYPHEN, undefined, cp);
      cp = yield;

      if (cp === HYPHEN) {
        cp = yield * this.oneIs(GREATER_THAN);

        return {
          content: String.fromCodePoint(...commentCPs),
          type: 'COMMENT'
        };

      } else {
        cp = yield * this.oneWhere(isCommentChar, commentCPs, cp);
      }
    }
  }

  // CONDITIONAL SECTION ///////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ NO RETURN VALUE
  //
  // Starting immediately after "<![".

  * CONDITIONAL_SECT() {
    // TODO
  }

  // DOCUMENT //////////////////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ NO RETURN VALUE
  //
  //           ✨✨✨✨ TARGET STATE — UNDERSTANDS EOF ✨✨✨✨
  //
  // Emits 'DOCUMENT' event.

  * DOCUMENT() {
    let xmlDeclPossible     = true;
    let doctypeDeclPossible = true;
    let rootElementPossible = true;
    let cp;

    const document = {
      children: [],
      type: 'DOCUMENT'
    };

    while (true) {
      cp = xmlDeclPossible
        ? yield
        : yield * this.zeroOrMoreWhere(isWhitespaceChar);

      // terminus

      if (cp === EOF) {
        if (rootElementPossible) {
          this._expected(cp, 'document element');
        }

        this.emit('DOCUMENT', document);
        console.log(document)
        return;
      }

      // markup

      if (cp === LESS_THAN) {
        cp = yield;

        // disambiguation: <! can begin <!--comment or <!DOCTYPE

        if (cp === EXCLAMATION_POINT) {
          cp = yield;

          if (cp === HYPHEN) {
            document.children.push(yield * this.COMMENT());
            continue;
          }

          if (doctypeDeclPossible) {
            if (cp === D_UPPER) {
              document.doctype = yield * this.DOCUMENT_doctypeDecl();
              continue;
            }

            this._expected(cp, '"-" or "DOCTYPE" after "<!"');
          }

          this._expected(cp, '1st "-" of "<!--');
        }

        // disambiguation: <? can begin <?xml or <?procinst

        if (cp === QUESTION_MARK) {
          const targetCPs = [];

          cp = yield * this.oneWhere(isNameStartChar, targetCPs);
          cp = yield * this.zeroOrMoreWhere(isNameContinueChar, targetCPs);

          if (xmlDeclPossible && isXMLDeclStart(targetCPs)) {
            yield * this.DOCUMENT_xmlDecl(cp);
            continue;
          }

          if (!isPITarget(targetCPs)) {
            this._expected(cp, 'PI target not to be "xml" (case insensitive)');
          }

          document.children.push({
            type: 'PROCESSING_INSTRUCTION',
            target: String.fromCodePoint(...targetCPs),
            value: yield * this.PROCESSING_INSTRUCTION_VALUE(cp)
          });

          continue;
        }

        // root element
        if (rootElementPossible) {
          if (isNameStartChar(cp)) {
            doctypeDeclPossible = false;
            rootElementPossible = false;
            xmlDeclPossible     = false;
            document.children.push(yield * this.ELEMENT(cp));
            continue;
          }

          this._expected(cp, '"?", "!", or name start character');
        }

        if (isNameStartChar(cp)) {
          this._expected(cp, '"?" or "!"; there can only be one root element');
        }

        this._expected(cp, '"?" or "!"');
      }

      // whitespace

      if (isWhitespaceChar(cp)) {
        xmlDeclPossible = false;
        continue;
      }

      this._expected(cp, 'whitespace or markup');
    }
  }

  // DOCUMENT: Doctype Declaration /////////////////////////////////////////////
  //
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Child of document, this state begins immediately after "<!D".

  * DOCUMENT_doctypeDecl() {
    let externalIDPossible = true;
    let internalSubsetPossible = true;
    let cp;

    // doctype name

    const nameCPs = [];

    cp = yield * this.seriesIs(DOCTYPE_CPS, undefined, D_UPPER);
    cp = yield * this.oneOrMoreWhere(isWhitespaceChar);
    cp = yield * this.oneWhere(isNameStartChar, nameCPs, cp);
    cp = yield * this.zeroOrMoreWhere(isNameContinueChar, nameCPs);
    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar, undefined, cp);

    const doctype = {
      name: String.fromCodePoint(...nameCPs)
    };

    while (true) {
      // terminus

      if (cp === GREATER_THAN) {
        this.dereferenceDTD(doctype);
        return doctype;
      }

      // internal subset

      if (!internalSubsetPossible) {
        this._expected(cp, '">"');
      }

      if (cp === BRACKET_LEFT) {
        externalIDPossible = false;
        internalSubsetPossible = false;

        cp = yield * this.DOCUMENT_doctypeDecl_intSubset();

        if (cp !== BRACKET_RIGHT) {
          this._expected(cp, '"%", "<", "]", or whitespace');
        }

        cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);

        continue;
      }

      // external ID

      if (!externalIDPossible) {
        this._expected(cp, '"[" or ">"');
      }

      externalIDPossible = false;

      if (cp !== P_UPPER && cp !== S_UPPER) {
        this._expected(cp, '"PUBLIC", "SYSTEM", "[" or ">"');
      }

      if (cp === P_UPPER) {
        cp = yield * this.seriesIs(PUBLIC_CPS, undefined, cp);
        cp = yield * this.oneOrMoreWhere(isWhitespaceChar);

        const publicIDCPs = [];
        const delimiter = cp;

        const pred =
          delimiter === QUOTE_DBL ? isPublicIDCharDbl :
          delimiter === QUOTE_SNG ? isPublicIDCharSng :
          undefined;

        if (!pred) {
          this._expected(cp, 'quoted public ID value');
        }

        cp = yield * this.oneOrMoreWhere(pred, publicIDCPs);

        doctype.publicID = String.fromCodePoint(...publicIDCPs);

        if (cp !== delimiter) {
          this._expected(cp, 'matching quotation mark after public ID');
        }

        cp = yield * this.oneOrMoreWhere(isWhitespaceChar);
      } else if (cp === S_UPPER) {
        cp = yield * this.seriesIs(SYSTEM_CPS, undefined, cp);
        cp = yield * this.oneOrMoreWhere(isWhitespaceChar);
      }

      const systemIDCPs = [];
      const delimiter = cp;

      const pred =
        delimiter === QUOTE_DBL ? isSystemIDCharDbl :
        delimiter === QUOTE_SNG ? isSystemIDCharSng :
        undefined;

      if (!pred) {
        this._expected(cp, 'quoted system ID value');
      }

      cp = yield * this.oneOrMoreWhere(pred, systemIDCPs);

      doctype.systemID = String.fromCodePoint(...systemIDCPs);

      if (cp !== delimiter) {
        this._expected(cp, 'matching quotation mark after system ID');
      }

      cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);
    }
  }

  // DOCUMENT: Doctype Declaration: Internal Subset ////////////////////////////
  //
  // :: ✘ ARGUMENT CP
  // :: ✔ RETURN CP
  //
  // Beginning immediately after "[" in doctype declaration. Return CP is first
  // codepoint at same-level which is not whitespace, "<", or "%"; in other
  // words, parent should confirm it is the "]" delimiter.
  //
  //
  // intSubset     ::= (markupdecl | DeclSep)*
  // markupdecl    ::= elementdecl | AttlistDecl | EntityDecl | NotationDecl
  //                 | PI | Comment
  // PEReference   ::= '%' Name ';'

  * DOCUMENT_doctypeDecl_intSubset() {
    let cp;

    while (true) {
      cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);

      if (cp === LESS_THAN) {
        const markupBoundary = this.boundary();

        cp = yield;

        if (cp === QUESTION_MARK) {
          yield * this.PROCESSING_INSTRUCTION();
          markupBoundary()();
          continue;
        }

        if (cp === EXCLAMATION_POINT) {
          cp = yield;

          if (cp === HYPHEN) {
            yield * this.COMMENT();
            markupBoundary()();
            continue;
          }

          const [ expansionTicket={} ] = this.activeExpansions || [];

          if (cp === A_UPPER) {
            yield * (expansionTicket.external
              ? this.chaoticNeutral(this.ATTLIST_DECL())
              : this.ATTLIST_DECL()
            );
            markupBoundary()();
            continue;
          }

          if (cp === E_UPPER) {
            cp = yield;

            if (cp === L_UPPER) {
              yield * (expansionTicket.external
              ? this.chaoticNeutral(this.ELEMENT_DECL())
              : this.ELEMENT_DECL()
            );
              markupBoundary()();
              continue;
            }

            if (cp === N_UPPER) {
              yield * (expansionTicket.external
                ? this.chaoticNeutral(this.ENTITY_DECL())
                : this.ENTITY_DECL()
              );
              markupBoundary()();
              continue;
            }

            this._expected(cp, '"LEMENT" or "NTITY"');
          }

          if (cp === N_UPPER) {
            yield * (expansionTicket.external
              ? this.chaoticNeutral(this.NOTATION_DECL())
              : this.NOTATION_DECL()
            );
            markupBoundary()();
            continue;
          }

          if (expansionTicket.external) {
            if (cp === BRACKET_LEFT) {
              yield * this.CONDITIONAL_SECT();
              markupBoundary()();
              continue;
            }

            this._expected(
              cp, '"ATTLIST", "ELEMENT", "ENTITY", "NOTATION", "[", or "--"'
            );
          }

          this._expected(
            cp, '"ATTLIST", "ELEMENT", "ENTITY", "NOTATION", or "--"'
          );
        }

        this._expected(cp, '"?" or "!"');
      }

      if (cp === PERCENT_SIGN) {
        yield * this.PARAMETER_ENTITY_REFERENCE();
        continue;
      }

      return cp;
    }
  }

  // DOCUMENT: XML Declaration /////////////////////////////////////////////////
  //
  // :: ✔ ARG: INITIAL CP
  // :: ✘ NO RETURN VALUE
  //
  // Starting from "<?xml" + one cp which is not name continue.

  * DOCUMENT_xmlDecl(cp) {
    let encodingPossible   = true;
    let standalonePossible = true;

    cp = yield * this.oneOrMoreWhere(isWhitespaceChar, undefined, cp);
    cp = yield * this.XML_VERSION(cp);

    while (true) {
      const wsCPs = [];

      cp = yield;
      cp = yield * this.zeroOrMoreWhere(isWhitespaceChar, wsCPs, cp);

      if (cp === QUESTION_MARK) {
        yield * this.oneIs(GREATER_THAN);
        return;
      }

      if (!wsCPs.length) {
        this._expected(cp, '"?>" or whitespace');
      }

      if (encodingPossible && cp === E_LOWER) {
        encodingPossible = false;
        yield * this.XML_ENCODING();
        continue;
      }

      if (standalonePossible && cp === S_LOWER) {
        encodingPossible = false;
        standalonePossible = false;
        yield * this.DOCUMENT_xmlDecl_standalone();
        continue;
      }

      if (encodingPossible) {
        this._expected(cp, '"encoding", "standalone" or "?>"');
      }

      if (standalonePossible) {
        this._expected(cp, '"standalone" or "?>"');
      }

      this._expected(cp, '"?>"');
    }
  }

  // DOCUMENT: XML Declaration: Standalone /////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ NO RETURN VALUE
  //
  // Starting after the "s" of "standalone". Sets standalone state.

  * DOCUMENT_xmlDecl_standalone() {
    let cp;

    cp = yield * this.seriesIs(STANDALONE_CPS, undefined, S_LOWER);
    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);
    cp = yield * this.oneIs(EQUALS_SIGN, undefined, cp);
    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);

    const delimiter = cp;

    if (delimiter !== QUOTE_DBL && delimiter !== QUOTE_SNG) {
      this._expected(cp, 'quoted standalone value');
    }

    cp = yield;

    const series =
      cp === N_LOWER ? NO_CPS :
      cp === Y_LOWER ? YES_CPS :
      undefined;

    if (!series) {
      this._expected(cp, '"no" or "yes"');
    }

    yield * this.seriesIs(series, undefined, cp);
    yield * this.oneIs(delimiter);

    this.setStandalone(series === YES_CPS);
  }

  // ELEMENT ///////////////////////////////////////////////////////////////////
  //
  // :: ✔ ARG: INITIAL CP
  // :: ✔ RETURNS RAW ELEMENT NODE
  //
  // Starting from "<" + one name start character.

  * ELEMENT(cp) {
    const nameCPs = [];

    cp = yield * this.oneWhere(isNameStartChar, nameCPs, cp);
    cp = yield * this.zeroOrMoreWhere(isNameContinueChar, nameCPs, cp);

    const element = {
      attr: {},
      name: String.fromCodePoint(...nameCPs),
      type: 'ELEMENT'
    };

    while (true) {
      const wsCPs = [];

      cp = yield * this.zeroOrMoreWhere(isWhitespaceChar, wsCPs, cp);

      if (cp === GREATER_THAN) {
        element.children = yield * this.ELEMENT_content();

        yield * this.seriesIs([ ...nameCPs ]);
        yield * this.oneIs(GREATER_THAN, undefined,
          yield * this.zeroOrMoreWhere(isWhitespaceChar)
        );

        return element;
      }

      if (cp === SLASH) {
        yield * this.oneIs(GREATER_THAN);
        return element;
      }

      if (!wsCPs.length) {
        this._expected(cp, '"/>", ">", or whitespace');
      }

      yield * this.ELEMENT_attribute(cp, element.attr);

      cp = undefined;
    }
  }

  // ELEMENT: Attribute ////////////////////////////////////////////////////////
  //
  // :: ✔ ARGS: INITIAL CP, RAW ELEMENT ATTR
  // :: ✘ NO RETURN VALUE
  //
  // Starting from a character which should be name start, beginning the
  // attribute key.

  * ELEMENT_attribute(cp, attr) {
    const attrKeyCPs = [];
    const attrValCPs = [];

    let expansionTicket;

    cp = yield * this.oneWhere(isNameStartChar, attrKeyCPs, cp);
    cp = yield * this.zeroOrMoreWhere(isNameContinueChar, attrKeyCPs);

    const key = String.fromCodePoint(...attrKeyCPs);

    if (key in attr) {
      this._expected(cp, `attribute ${ key } not to be appear twice`);
    }

    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar, undefined, cp);
    cp = yield * this.oneIs(EQUALS_SIGN, undefined, cp);
    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);

    const delim = cp;

    const pred =
      cp === QUOTE_DBL ? isAttValueCharDbl :
      cp === QUOTE_SNG ? isAttValueCharSng :
      undefined;

    if (!pred) {
      this._expected(cp, 'quoted attribute value');
    }

    while (true) {

      cp = yield * this.zeroOrMoreWhere(pred, attrValCPs);

      if (cp === delim) {
        if (expansionTicket && expansionTicket.active) {

          // 4.4.5 Included in Literal
          //   [...] replacement text must be processed in place of the
          //   reference itself as though it were part of the document at the
          //   location the reference was recognized, except that a single or
          //   double quote character in the replacement text must always be
          //   treated as a normal data character and must not terminate the
          //   literal.

          attrValCPs.push(cp);
          continue;
        }

        attr[key] = String.fromCodePoint(...attrValCPs);
        break;
      }

      if (cp === AMPERSAND) {
        const referenceBoundary = this.boundary();

        cp = yield;

        if (cp === HASH_SIGN) {
          attrValCPs.push(yield * this.CHARACTER_REFERENCE());
          referenceBoundary()();
          continue;
        }

        if (isNameStartChar(cp)) {
          const entityCPs = [ cp ];

          cp = yield * this.zeroOrMoreWhere(isNameContinueChar, entityCPs);
          cp = yield * this.oneIs(SEMICOLON, undefined, cp);

          referenceBoundary()();

          // Attribute values have slightly different needs from entity
          // expansions in other contexts, because they are never have
          // hierarchical results. Therefore we only want to keep a reference
          // to the outermost expansion.

          const newTicket = this.expandEntity('GENERAL', entityCPs);

          expansionTicket = expansionTicket || newTicket;

          continue;
        }

        this._expected(cp, '"#" or general entity name');
      }

      this._expected(cp, 'valid attribute value content');
    }
  }

  // ELEMENT: Content //////////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✔ RETURNS CONTENT ARRAY
  //
  // From the immediately after the ">" of an element open tag.

  * ELEMENT_content() {
    const contentBoundary = this.boundary();
    const content = [];

    let cp;
    let cdataCPs = [];

    while (true) {
      cp = yield * this.zeroOrMoreWhere(isCDATAChar, cdataCPs);

      // the "]]>" sequence in chardata

      if (cp === BRACKET_RIGHT) {
        const brCPs = [];

        cp = yield * this.oneOrMoreIs(BRACKET_RIGHT, brCPs, cp);

        if (brCPs.length >= 2 && cp === GREATER_THAN) {
          this._expected(cp,
            `a legal cdata character other than ">" (the sequence "]]>" ` +
            `may not appear in cdata)`
          );
        }

        cdataCPs.push(...brCPs);

        if (isCDATAChar(cp)) {
          cdataCPs.push(cp);
          continue;
        }
      }

      // general entity reference

      if (cp === AMPERSAND) {
        const referenceBoundary = this.boundary();

        cp = yield;

        if (cp === HASH_SIGN) {
          cdataCPs.push(yield * this.CHARACTER_REFERENCE());
          referenceBoundary()();
          continue;
        }

        if (isNameStartChar(cp)) {
          const entityCPs = [ cp ];

          cp = yield * this.zeroOrMoreWhere(isNameContinueChar, entityCPs);
          cp = yield * this.oneIs(SEMICOLON, undefined, cp);

          referenceBoundary()();

          this.expandEntity('GENERAL', entityCPs);

          continue;
        }

        this._expected(cp, '"#" or general entity name');
      }

      // markup

      if (cp === LESS_THAN) {
        const markupBoundary = this.boundary();
        const wasContentBoundary = contentBoundary();

        cp = yield;

        if (cp === EXCLAMATION_POINT) {
          cp = yield;

          // comment

          if (cp === HYPHEN) {
            if (cdataCPs.length) {
              content.push({
                text: String.fromCodePoint(...cdataCPs),
                type: 'CDATA'
              });
              cdataCPs = [];
            }

            content.push(yield * this.COMMENT());
            markupBoundary()();
            continue;
          }

          // cdata section

          if (cp === BRACKET_LEFT) {
            cdataCPs = cdataCPs || [];

            yield * this.seriesIs([ ...CDATA_CPS, BRACKET_LEFT ]);

            while (true) {
              cp = yield * this.zeroOrMoreWhere(isCDATASectionChar, cdataCPs);
              cp = yield * this.oneIs(BRACKET_RIGHT, undefined, cp);
              cp = yield;

              if (cp === BRACKET_RIGHT) {
                cp = yield;

                if (cp === GREATER_THAN) {
                  break;
                }

                cdataCPs.push(BRACKET_RIGHT, BRACKET_RIGHT, cp);
              } else {
                cdataCPs.push(BRACKET_RIGHT, BRACKET_RIGHT);
              }
            }

            markupBoundary()();
            continue;
          }
        }

        if (cdataCPs.length) {
          content.push({
            text: String.fromCodePoint(...cdataCPs),
            type: 'CDATA'
          });
          cdataCPs = [];
        }

        // processing instruction

        if (cp === QUESTION_MARK) {
          content.push(yield * this.PROCESSING_INSTRUCTION());
          markupBoundary()();
          continue;
        }

        // element close tag

        if (cp === SLASH) {
          wasContentBoundary();
          return;
        }

        // element open tag

        if (isNameStartChar(cp)) {
          content.push(yield * this.ELEMENT(cp));
          markupBoundary()();
          continue;
        }

        this._expected(cp, '"!", "?", "/", or element name');
      }

      this._expected(cp, 'markup, entity references, or valid chardata');
    }
  }

  // ELEMENT DECLARATION ///////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ NO RETURN VALUE
  //
  // Beginning immediately after "<!EL". The assembled definition will be
  // registered with declareElement().

  * ELEMENT_DECL() {
    let cp;

    const element = {};
    const nameCPs = [];

    cp = yield * this.seriesIs(EMENT_CPS);
    cp = yield * this.oneOrMoreWhere(isWhitespaceChar);
    cp = yield * this.oneWhere(isNameStartChar, nameCPs, cp);
    cp = yield * this.zeroOrMoreWhere(isNameContinueChar, nameCPs);
    cp = yield * this.oneOrMoreWhere(isWhitespaceChar, undefined, cp);

    element.name = String.fromCodePoint(...nameCPs);

    switch (cp) {
      case A_UPPER:
        element.contentType        = 'any';
        element.contentPattern     = ANY_CONTENT_PATTERN;
        element.mayContainCDATA    = true;
        element.mayContainElements = true;
        element.permittedElements  = { has: () => true };
        cp = yield * this.seriesIs(ANY_CPS, undefined, cp);
        cp = yield;
        break;

      case E_UPPER:
        element.contentType        = 'empty';
        element.contentPattern     = EMPTY_CONTENT_PATTERN;
        element.mayContainCDATA    = false;
        element.mayContainElements = false;
        element.permittedElements  = { has: () => false };
        cp = yield * this.seriesIs(EMPTY_CPS, undefined, cp);
        cp = yield;
        break;

      case PARENTHESIS_LEFT:
        cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);

        if (cp === HASH_SIGN) {
          element.contentType        = 'mixed';
          element.mayContainCDATA    = true;
          element.mayContainElements = true;
          element.permittedElements  = new Set();

          cp = yield * this.seriesIs(PCDATA_CPS, undefined, cp);

          while (true) {
            cp = yield * this.zeroOrMoreWhere(isWhitespaceChar, undefined, cp);

            if (cp === PARENTHESIS_RIGHT) {
              if (element.permittedElements.size) {
                yield * this.oneIs(ASTERISK);
              }

              cp = yield;
              break;
            }

            if (cp === PIPE) {
              const nameCPs = [];

              cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);
              cp = yield * this.oneWhere(isNameStartChar, nameCPs, cp);
              cp = yield * this.zeroOrMoreWhere(isNameContinueChar, nameCPs);

              // 3.2.2 Mixed Content >> VC: No Duplicate Types

              const name = String.fromCodePoint(...nameCPs);

              if (element.permittedElements.has(name)) {
                this._expected(cp, `name ${ name } to be unique`);
              }

              element.permittedElements.add(name);
            }
          }

          if (element.permittedElements.size) {
            const elems = [ ...element.permittedElements ];
            const src   = `^( (#text|${ elems.join('|') }))*$`;

            element.contentPattern = new RegExp(src);
          } else {
            element.contentPattern = CDATA_CONTENT_PATTERN;
          }
        } else if (cp === PARENTHESIS_LEFT || isNameStartChar(cp)) {
          element.contentType        = 'children';
          element.mayContainCDATA    = false;
          element.mayContainElements = true;

          const res = yield * this.ELEMENT_DECL_children(cp);

          element.contentPattern    = new RegExp(`^${ res.pattern }$`);
          element.permittedElements = res.permittedElements;

          cp = res.cp;
        } else {
          this._expected(cp, '"(", "#PCDATA, or an element name');
        }

        break;
      default:
        this._expected(cp, '"ANY", "EMPTY", or "("');
    }

    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar, undefined, cp);
    cp = yield * this.oneIs(GREATER_THAN, undefined, cp);

    this.declareElement(element);
  }

  // ELEMENT DECLARATION: Children /////////////////////////////////////////////
  //
  // :: ✔ ARGUMENT: INITIAL CP
  // :: ✔ RETURNS OBJECT { cp, pattern, permittedElements }
  //
  // Right after the opening "(" and any whitespace, with a cp that is not "#".
  // This can be from the first "(" or a child "(".
  //
  // The return value is an object of the form:
  //  {
  //    pattern: string which will become part of regular expression
  //    permittedElements: set of element names
  //    cp: greed artifact
  //  }

  * ELEMENT_DECL_children(cp) {
    const patternMembers = [];

    let permittedElements = new Set();
    let type;

    while (true) {
      if (cp === PARENTHESIS_LEFT) {
        const res = yield * this.ELEMENT_DECL_children(yield);

        permittedElements = new Set([
          ...permittedElements,
          ...res.permittedElements
        ]);

        patternMembers.push(res.pattern);

        cp = res.cp;
      } else if (isNameStartChar(cp)) {
        const nameCPs = [ cp ];

        cp = yield * this.zeroOrMoreWhere(isNameContinueChar, nameCPs);

        const name = String.fromCodePoint(...nameCPs);

        let quantifier = '';

        if (cp === ASTERISK || cp === PLUS_SIGN || cp === QUESTION_MARK) {
          quantifier = String.fromCodePoint(cp);
          cp = yield;
        }

        patternMembers.push(`(?: ${ name })${ quantifier }`);
        permittedElements.add(name);
      } else {
        this._expected(cp, '"(" or element name')
      }

      cp = yield * this.zeroOrMoreWhere(isWhitespaceChar, undefined, cp);

      switch (cp) {
        case COMMA:
          if (type === 'DISJUNCTION') {
            this._expected(cp, '")" or "|"');
          }

          type = 'SERIES';
          break;

        case PIPE:
          if (type === 'SERIES') {
            this._expected(cp, '")" or ","');
          }

          type = 'DISJUNCTION';
          break;

        case PARENTHESIS_RIGHT:
          const divider = type === 'DISJUNCTION' ? '|' : '';

          let quantifier = '';

          cp = yield;

          if (cp === ASTERISK || cp === PLUS_SIGN || cp === QUESTION_MARK) {
            quantifier = String.fromCodePoint(cp);
            cp = yield;
          }

          return {
            cp,
            pattern: `(?:${ patternMembers.join(divider) })${ quantifier }`,
            permittedElements
          };

        default:
          switch (type) {
            case 'DISJUNCTION': this._expected(cp, '"|" or ")"');
            case 'SERIES':      this._expected(cp, '"," or ")"');
            default:            this._expected(cp, '",", "|", or ")"');
          }
      }

      cp = yield * this.zeroOrMoreWhere(isWhitespaceChar, undefined);

      continue;
    }
  }

  // ENTITY DECLARATION ////////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ NO RETURN VALUE
  //
  // Beginning immediately after "<!EN". The assembled value will be passed to
  // declareEntity().

  * ENTITY_DECL() {
    let cp;

    const entity  = {};
    const nameCPs = [];

    cp = yield * this.seriesIs(TITY_CPS);
    cp = yield * this.oneOrMoreWhere(isWhitespaceChar);

    if (cp === PERCENT_SIGN) {
      entity.type = 'PARAMETER';
      cp = yield * this.oneOrMoreWhere(isWhitespaceChar);
    } else {
      entity.type = 'GENERAL';
    }

    cp = yield * this.oneWhere(isNameStartChar, nameCPs, cp);
    cp = yield * this.zeroOrMoreWhere(isNameContinueChar, nameCPs);
    cp = yield * this.oneOrMoreWhere(isWhitespaceChar, undefined, cp);

    entity.name = String.fromCodePoint(...nameCPs);

    if (cp === QUOTE_DBL || cp === QUOTE_SNG) {
      const entityCPs = [];
      const delim = cp;

      const pred = cp === QUOTE_DBL
        ? isEntityValueCharDbl
        : isEntityValueCharSng;

      let expansionTicket;

      while (true) {
        cp = yield * this.zeroOrMoreWhere(pred, entityCPs);

        if (cp === delim) {
          if (expansionTicket && expansionTicket.active) {
            entityCPs.push(cp);
            continue;
          }

          entity.cps = entityCPs;

          cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);
          cp = yield * this.oneIs(GREATER_THAN, undefined, cp);

          this.declareEntity(entity);
          return;
        }

        if (cp === AMPERSAND) {
          cp = yield;

          if (cp === HASH_SIGN) {
            // 4.4.2 Included [...]
            entityCPs.push(yield * this.CHARACTER_REFERENCE());
            continue;
          } else {
            // 4.4.7 Bypassed
            //   When a general entity reference appears in the EntityValue in
            //   an entity declaration, it must be bypassed and left as is.

            entityCPs.push(AMPERSAND);

            cp = yield * this.oneWhere(isNameStartChar, entityCPs, cp);
            cp = yield * this.zeroOrMoreWhere(isNameContinueChar, entityCPs);
            cp = yield * this.oneIs(SEMICOLON, entityCPs, cp);

            continue;
          }
        }

        if (cp === PERCENT_SIGN) {
          // 4.4.5 Included in Literal [...]
          const newTicket = yield * this.PARAMETER_ENTITY_REFERENCE();
          expansionTicket = expansionTicket || newTicket;
          continue;

          // Note that this case is deliberately not covered by the
          // *chaoticNeutral() wrapper, as it occurs within a quoted literal.
          // This is important because the rules here differ, and because the
          // use of parameter references here is legal even if we are directly
          // in an internal DTD.
        }

        this._expected(cp, 'terminal quote, reference, or valid entity char');
      }
    }

    if (cp !== P_UPPER || cp !== S_UPPER) {
      this._expected(cp, 'quoted entity value or external identifier');
    }

    if (cp === P_UPPER) {
      cp = yield * this.seriesIs(PUBLIC_CPS, undefined, cp);
      cp = yield * this.oneOrMoreWhere(isWhitespaceChar);

      const publicIDCPs = [];
      const delim = cp;

      const pred =
        cp === QUOTE_DBL ? isPublicIDCharDbl :
        cp === QUOTE_SNG ? isPublicIDCharSng :
        undefined;

      if (!pred) {
        this._expected(cp, 'quoted public ID');
      }

      cp = yield * this.zeroOrMoreWhere(pred, publicIDCPs);

      if (cp !== delim) {
        this._fail(cp, 'terminal quote or valid public ID character');
      }

      entity.publicID = String.fromCodePoint(...publicIDCPs);
    } else {
      cp = yield * this.seriesIs(SYSTEM_CPS, undefined, cp);
    }

    cp = yield * this.oneOrMoreWhere(isWhitespaceChar);

    const systemIDCPs = [];
    const delim = cp;

    const pred =
      cp === QUOTE_DBL ? isSystemIDCharDbl :
      cp === QUOTE_SNG ? isSystemIDCharSng :
      undefined;

    if (!pred) {
      this._expected(cp, 'quoted system ID');
    }

    cp = yield * this.zeroOrMoreWhere(pred, systemIDCPs);

    if (cp !== delim) {
      this._fail(cp, 'terminal quote or valid public ID character');
    }

    entity.systemID = String.fromCodePoint(...systemIDCPs);

    cp = yield;

    if (isWhitespaceChar(cp) && entity.type === 'GENERAL') {
      cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);

      if (cp === N_UPPER) {
        const ndataCPs = [];

        cp = yield * this.seriesIs(NDATA_CPS, undefined, cp);
        cp = yield * this.oneOrMoreWhere(isWhitespaceChar);
        cp = yield * this.oneWhere(isNameStartChar, ndataCPs, cp);
        cp = yield * this.zeroOrMoreWhere(isNameContinueChar, ndataCPs);

        entity.notation = String.fromCodePoint(...ndataCPs);
        entity.type = 'UNPARSED';
      }
    }

    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar, undefined, cp);

    yield * this.oneIs(GREATER_THAN, undefined, cp);

    this.declareEntity(entity);
  }

  // EXT_ENTITY ////////////////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ NO RETURN VALUE
  //
  //          ✨✨✨✨ TARGET STATE — UNDERSTANDS EOF ✨✨✨✨
  //
  // Emits REPLACEMENT_TEXT event on termination; value is array of CPs.

  * EXT_ENTITY() {
    const replTextCPs = [];

    let textDeclPossible = true;
    let cp;

    while (true) {
      cp = yield;

      if (textDeclPossible && cp === LESS_THAN) {
        textDeclPossible = false;

        const candidateCPs = [ cp ];

        for (const testCP of [ QUESTION_MARK, X_LOWER, M_LOWER, L_LOWER ]) {
          if ((cp = yield) === testCP) {
            candidateCPs.push(cp);
          } else {
            replTextCPs.push(...candidateCPs);
            break;
          }
        }

        if (candidateCPs.length === 5) {
          if (isWhitespaceChar(cp = yield)) {
            yield * this.TEXT_DECL();
            continue;
          } else {
            replTextCPs.push(...candidateCPs);
          }
        }
      }

      if (cp === EOF) {
        this.emit('REPLACEMENT_TEXT', replTextCPs);
        return;
      }

      textDeclPossible = false;
      replTextCPs.push(cp);
    }
  }

  // EXT_SUBSET ////////////////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ NO RETURN VALUE
  //
  //           ✨✨✨✨ TARGET STATE — UNDERSTANDS EOF ✨✨✨✨

  * EXT_SUBSET() {
    let textDeclPossible = true;
    let cp;

    while (true) {
      cp = textDeclPossible
        ? (yield)
        : (yield * this.zeroOrMoreWhere(isWhitespaceChar));

      if (textDeclPossible && isWhitespaceChar(cp)) {
        textDeclPossible = false;
        continue;
      }

      if (cp === LESS_THAN) {
        const markupBoundary = this.boundary();

        cp = yield;

        if (cp === EXCLAMATION_POINT) {
          cp = yield;

          if (cp === BRACKET_LEFT) {
            yield * this.CONDITIONAL_SECT();
            markupBoundary()();
            continue;
          }

          if (cp === HYPHEN) {
            yield * this.COMMENT();
            markupBoundary()();
            continue;
          }

          if (cp === A_UPPER) {
            yield * this.chaoticNeutral(this.ATTLIST_DECL());
            markupBoundary()();
            continue;
          }

          if (cp === E_UPPER) {
            cp = yield;

            if (cp === L_UPPER) {
              yield * this.chaoticNeutral(this.ELEMENT_DECL());
              markupBoundary()();
              continue;
            }

            if (cp === N_UPPER) {
              yield * this.chaoticNeutral(this.ENTITY_DECL());
              markupBoundary()();
              continue;
            }

            this._expected(cp, '"LEMENT" or "NTITY"');
          }

          if (cp === N_UPPER) {
            yield * this.chaoticNeutral(this.NOTATION_DECL());
            markupBoundary()();
            continue;
          }

          this._expected(
            cp, '"ATTLIST", "ELEMENT", "ENTITY", "NOTATION", or "--"'
          );
        }

        if (cp === QUESTION_MARK) {
          const targetCPs = [];

          cp = yield * this.oneWhere(isNameStartChar, targetCPs);
          cp = yield * this.zeroOrMoreWhere(isNameContinueChar, targetCPs);

          if (textDeclPossible && isXMLDeclStart(targetCPs)) {
            yield * this.oneWhere(isWhitespaceChar, undefined, cp);
            yield * this.TEXT_DECL();
            continue;
          }

          if (isPITarget(targetCPs)) {
            yield * this.PROCESSING_INSTRUCTION_VALUE();
            markupBoundary()();
            continue;
          }

          this._expected(cp, 'valid processing instruction target name');
        }

        this._expected(cp, '"?" or "!"');
      }

      if (cp === PERCENT_SIGN) {
        textDeclPossible = false;
        yield * this.PARAMETER_ENTITY_REFERENCE();
        continue;
      }

      this._expected(cp, '"<", "%", or whitespace');
    }
  }

  // NOTATION DECLARATION //////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ NO RETURN VALUE
  //
  // Beginning immediately after "<!N".

  * NOTATION_DECL() {
    // TODO
  }

  // PARAMETER ENTITY REFERENCE ////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✔ RETURNS EXPANSION TICKET
  //
  // Immediately after '%' — and it triggers the expansion.

  * PARAMETER_ENTITY_REFERENCE() {
    const referenceBoundary = this.boundary();
    const entityCPs = [];

    let cp;

    cp = yield * this.oneWhere(isNameStartChar, entityCPs);
    cp = yield * this.zeroOrMoreWhere(isNameContinueChar, entityCPs);
    cp = yield * this.oneIs(SEMICOLON, undefined, cp);

    referenceBoundary()();
    return this.expandEntity('PARAMETER', entityCPs);
  }

  // PROCESSING_INSTRUCTION ////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✔ RETURNS PROCESSING INSTRUCTION
  //
  // Starting immediately after "<?".

  * PROCESSING_INSTRUCTION() {
    const targetCPs = [];

    let cp;

    yield * this.oneWhere(isNameStartChar, targetCPs);
    cp = yield * this.zeroOrMoreWhere(isNameContinueChar, targetCPs);

    if (isPITarget(targetCPs)) {
      const target = String.fromCodePoint(...targetCPs);
      const value = yield * this.PROCESSING_INSTRUCTION_VALUE(cp);
      return new ProcessingInstruction(target, value);
    }

    this._expected(cp, 'valid processing instruction target');
  }

  // PROCESSING_INSTRUCTION_VALUE //////////////////////////////////////////////
  //
  // :: ✔ ARGUMENT: INITIAL CP
  // :: ✔ RETURNS: PROCESSING INSTRUCTION VALUE
  //
  // Starting from immediately after the processing instruction target.

  * PROCESSING_INSTRUCTION_VALUE(cp) {
    if (cp === QUESTION_MARK) {
      yield * this.oneIs(GREATER_THAN);
      return '';
    }

    const valueCPs = [];

    yield * this.oneWhere(isWhitespaceChar, undefined, cp);

    while (true) {
      const questionCPs = [];

      cp = yield * this.zeroOrMoreWhere(isProcInstValueChar, valueCPs);
      cp = yield * this.oneOrMoreIs(QUESTION_MARK, undefined, cp);

      if (cp === GREATER_THAN) {
        valueCPs.push(...questionCPs.slice(1));

        return String.fromCodePoint(...valueCPs);
      } else {
        yield * this.oneWhere(isProcInstValueChar, undefined, cp);
        valueCPs.push(...questionCPs, cp);
      }
    }
  }

  // TEXT_DECL /////////////////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ NO RETURN VALUE
  //
  // Starting from "<?xml ".

  * TEXT_DECL() {
    let cp;

    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);

    if (cp === V_LOWER) {
      yield * this.XML_VERSION(cp);
      cp = yield * this.oneOrMoreWhere(isWhitespaceChar);
    }

    yield * this.oneIs(E_LOWER, undefined, cp);
    yield * this.XML_ENCODING();

    yield * this.seriesIs([ QUESTION_MARK, GREATER_THAN ], undefined,
      yield * this.zeroOrMoreWhere(isWhitespaceChar)
    );
  }

  // XML_ENCODING //////////////////////////////////////////////////////////////
  //
  // :: ✘ NO ARGS
  // :: ✘ NO RETURN VALUE
  //
  // Starting after the initial "e" in "encoding". Configures decoder.

  * XML_ENCODING() {
    let cp;

    cp = yield * this.seriesIs(ENCODING_CPS, undefined, E_LOWER);
    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);
    cp = yield * this.oneIs(EQUALS_SIGN, undefined, cp);
    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);

    const encValueCPs = [];
    const delimiter = cp;

    if (cp !== QUOTE_DBL && cp !== QUOTE_SNG) {
      this._expected(cp, 'quoted encoding declaration');
    }

    cp = yield * this.oneWhere(isEncStartChar, encValueCPs);
    cp = yield * this.zeroOrMoreWhere(isEncContinueChar, encValueCPs);

    this.setXMLEncoding(String.fromCodePoint(...encValueCPs), 'declared');

    if (cp !== delimiter) {
      this._expected(cp, 'corresponding closing quotation mark');
    }
  }

  // XML_VERSION ///////////////////////////////////////////////////////////////
  //
  // :: ✔ ARGUMENT: INITIAL CP
  // :: ✘ NO RETURN VALUE
  //
  // Starting from expected "v". Has no effect.

  * XML_VERSION(cp) {
    cp = yield * this.seriesIs(VERSION_CPS, undefined, cp);
    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);
    cp = yield * this.oneIs(EQUALS_SIGN, undefined, cp);
    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);

    const delimiter = cp;

    if (cp !== QUOTE_DBL && cp !== QUOTE_SNG) {
      this._expected(cp, 'quoted version value');
    }

    cp = yield * this.seriesIs([ ONE, PERIOD ]);
    cp = yield * this.oneOrMoreWhere(isDecChar);

    if (cp !== delimiter) {
      this._expected(cp, 'corresponding closing quotation mark');
    }
  }
}
