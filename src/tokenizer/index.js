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

// TOKENIZER ///////////////////////////////////////////////////////////////////

const DEFAULT_OPTS = {
  maxExpansionCount: 10000,
  maxExpansionSize: 20000,
  target: 'document'
};

// Some information about the implementation, which stretches the word
// ‘tokenizer’ pretty far:
//
// In a simple, non-conformant XML parser — one that does not concern itself
// with even general entity expansion (beyond those which are predefined) — it
// is possible, despite the non-context-free nature of XML at a higher level, to
// create a clean division between lexing and parsing. You’d still need a little
// bit of statefulness in the lexer for practical reasons, but not much.
//
// This intends to be a non-simple, conformant XML-parser — one that reads and
// understands DTDs, markup declarations, conditional sections, parameter entity
// expansion in every weird oriface and general entity expansions that might
// contain markup in addition to just CDATA...
//
// Someone more clever than myself might see a way to have all these things
// while still maintaining clean separation between lexing and parsing. I could
// not. It seemed to me that entity expansion in particular made the the two
// concepts truly inextricable.
//
// That said, at this level we *are* emitting ‘tokens’. That makes it,
// superficially, kinda lexy, even though inside it’s really parsing syntactic
// as well as lexical productions.

export default
class Tokenizer extends Decoder {
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
    //    property will also be provided. The reason this function must be
    //    supplied by the user is that in typical usage, one does not want to
    //    be fetching arbitrary URIs from the internet when parsing. For reasons
    //    of security and efficiency, most likely you either want to whitelist
    //    specific URLs (with a caching layer), or keep external files which you
    //    know will be needed on the local system; all of this falls outside
    //    Hardcore’s domain. (Though I have been considering providing a
    //    catalogue of common DTDs like SVG, MathML, etc...)
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

    this.entities          = new Map(entities.xml);
    this.expansionCount    = 0;
    this.maxExpansionCount = $opts.maxExpansionCount;
    this.maxExpansionSize  = $opts.maxExpansionSize;
    this.activeExpansions  = [];

    this.__expansionPromise__ = undefined;

    // TERMINAL ITERATOR
    //
    // - opts.target
    //
    //    The possible values for "target" are "document", "extSubset", and
    //    "extEntity". It is not expected that users provide these values (the
    //    default is "document"). It indicates the target production. Each of
    //    these correspond to a state which is both initial and terminal, and
    //    which understands and expects the "EOF" token.
    //
    // The "eat" method is just the "next" function of an instance of the
    // corresponding target generator. This is what’s cool about using
    // generators for lexing and parsing: we do not need to maintain global
    // lexing state beyond this! No element stack, no global accretion arrays,
    // etc. Generators can *self-describe* hierarchical patterns (XML is not
    // context free) and state transitions through yield * delegation — it’s all
    // "free", and any local state is exactly that: local to one or another
    // generator closure. Though surely this is more expensive than having a
    // billion explicit one-codepoint state methods & a big mess of stateful
    // properties smashed onto the instance, the code ends up a lot cleaner &
    // easier to understand and debug. Generators provide a beautiful,
    // language-level/first-class representation of exactly what we are trying
    // to do.
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
    // all further processing (the tokenizer is now in an invalid state and we
    // do not attempt any fuzzy recovery stuff — hardcore is strict).

    this.on('error', err => {
      console.log(err);
      this.haltAndCatchFire();
    });

    // Some token events describe information which is meaningful to the
    // tokenizer itself. Rather than perform these actions at the token emission
    // "site", we can group them here in a regular event handler so it doesn’t
    // matter if they may come from more than one pathway (also this helps keep
    // the amount of "meta" logic in state methods lower). Encoding declarations
    // must be communicated to the Decoder (well, this is the decoder, but it
    // needs to call the setXMLEncoding method) and some of the DTD-related
    // tokens are needed to define entities, etc.

    this.on('token', token => {
      console.log(token);

      switch (token.type) {
        case 'DOCTYPE_NAME': {
          this.doctype = { name: token.value };
          return;
        }

        case 'DOCTYPE_PUBLIC_ID': {
          this.doctype.publicID = token.value;
          return;
        }

        case 'DOCTYPE_SYSTEM_ID': {
          this.doctype.systemID = token.value;
          return;
        }

        case 'XML_ENCODING': {
          if (token.value && !token.external) {
            try {
              this.setXMLEncoding(token.value, 'declared');
            } catch (err) {
              this.emit('error', err);
            }
          }
          return;
        }
      }
    });

    // EOF: All terminal states expect an EOF symbol; this is important for
    // ensuring our terminal state is, in fact, the expected terminal state.
    // Like any invalid codepoint, it will lead to an error if it occurs in a
    // position which was not ready to accept it. Further, in the case of
    // external general or parameter entities, the EOF is needed in order to
    // ensure the emission of the replacement text token, since that production
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

  // Emits a token, serializing the string value if applicable. At the parsing
  // level, we are finally dealing with strings.

  token(type, cps) {
    this.emit('token', {
      type,
      value: cps instanceof Array
        ? String.fromCodePoint(...cps)
        : cps
    });
  }

  // DEREFERENCING & SECONDARY TEXT RESOLUTION /////////////////////////////////

  // Register a "boundary," meaning a context which must either be entirely
  // inside one entity expansion or entirely outside all entity expansions. It
  // is called when such a context is entered, and it returns a function which
  // is called when that context first may have exited. This in turn returns a
  // function which is called when it is definitely exited, and that either may
  // be a noop or will throw an error if the boundary was violated by
  // expansions. With great power comes great responsibilities!
  //
  // To see why this is ‘two tiered’, consider the case of expansions which
  // occur in the element content context. The illegal codepoint would be the
  // "<" of "</" — but "<" is plausibly legal until we see the "/". So the first
  // call locks in the correct terminal ticket for "<", and we only call the
  // second function if it really was "</". Otherwise, &poop;/, where &poop;
  // ends with "<", would be legal.

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

  // Wraps a state iterator to permit parameter references at nearly any
  // position. This occurs when we are parsing the expansion of an external
  // entity reference — it turns into a fucking free-for-all and enforcing
  // boundary constraints becomes a huge, difficult problem (which helps explain
  // why the one public DTD validator I could find online actually gets this
  // wrong and permits illegal boundary crossings in this context).
  //
  // This is tentative code — I’m not sure yet if this is really a viable
  // solution. Kind of crossing my fingers, since the alternatives that come to
  // mind so far demand a horrifying amount of extra complexity.

  * chaoticNeutral(iter) {
    const parenBoundaries = [];

    let literalDelimiter;
    let cp;

    iter.next();

    while (true) {
      cp = yield;

      // When we’re not inside a literal string, a parameter reference is always
      // legal (even if there is no way it could *really* be legal, owing to the
      // added space padding).

      if (cp === PERCENT_SIGN && !literalDelimiter) {
        yield * this.PARAMETER_ENTITY_REFERENCE();
        continue;
      }

      // If we had a literal delimiter (", ') and match it, we can remove the
      // ban on special handling of parameter references. Otherwise, this is
      // the beginning of such a section. Thank god we don’t have to worry about
      // slash-style escapes.

      if (cp === literalDelimiter) {
        literalDelimiter = undefined;
      } else if (cp === QUOTE_DBL || cp === QUOTE_SNG) {
        literalDelimiter = cp;
      }

      // If we are not inside a literal, parentheses represent the other special
      // case, except these delimiters do not block interior parameter
      // references — instead they just demand hierarchical balance.

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

  // Sets an entity definition and makes it available for referencing.

  declareEntity(entity) {
    if (entity.notation) {
      // Validity constraint: Notation Declared
      // TODO — since this constraint requires specifically that the notation
      // was declared prior to this point, it drags notation declarations,
      // unfortunately, into the scope of things the tokenizer needs to have
      // knowledge of.
    }

    if (!this.entities.has(entity.name)) {
      this.entities.set(entity.name, entity);
    }
  }

  // Called to dereference external entities. It just wraps the user-provided
  // "opts.dereference" function so that it is always a promise.

  dereference(type, data) {
    return Promise.resolve(this._dereference(type, data));
  }

  // Called when an external reference to a DTD is parsed, but after the
  // internal DTD is parsed if applicable. Execution of the existing stream is
  // halted while we await the resolution and parsing of the external DTD, whose
  // events will be piped in.
  //
  // The availability of entities was a point of confusion for me. The spec
  // indicates that an internal subset must be parsed first before an external
  // subset, which is consistent with these facts:
  //
  // 1. The first declaration of an entity takes precedence
  // 2. Examples demonstrate using the internal DTD to define parameter entities
  //    which affect the processing of the external DTD — indeed, this is what
  //    makes them ‘parameter’ entities.
  //
  // But what had me confused for a while was this:
  //
  // 2.8 Prolog and Document Type Declaration
  //   [...] Like the internal subset, the external subset and any external
  //   parameter entities referenced in a DeclSep must consist of a series of
  //   complete markup declarations of the types allowed by the non-terminal
  //   symbol markupdecl, interspersed with white space or parameter-entity
  //   references. However, portions of the contents of the external subset or
  //   of these external parameter entities may conditionally be ignored by
  //   using the conditional section construct; this is not allowed in the
  //   internal subset but is allowed in external parameter entities referenced
  //   in the internal subset.
  //
  // Note the last clause. This led me to believe that entities declared in an
  // external subset were somehow available to the internal DTD, even though
  // this could lead to paradoxes like entities whose replacement text
  // successfully redefined the same entity. But on re-reading it a few times,
  // it finally clicked that the "external parameter entities" they are
  // describing are those which are declared in the internal subset but happen
  // to have an external source — not entities *declared* externally, which are
  // indeed unavailable back at home. At least, that’s my best understanding at
  // the moment!
  //
  // Ultimately though it just means we need to provide a copy of our ‘entity
  // directory’ to the external subset. I’m unclear still on whether we need to
  // do the same for notations — I suspect we do (TODO), but I don’t think it’s
  // necessary to share ELEMENT or ATTLIST stuff at least.

  dereferenceDTD() {
    if (!this.doctype || !this.doctype.systemID) {
      return;
    }

    this.haltAndCatchFire();

    const { doctype } = this;

    this
      .dereference('DTD', {
        name: doctype.name,
        publicID: doctype.publicID,
        systemID: doctype.systemID,
        systemIDEncoded: doctype.systemID && encodeURI(doctype.systemID)
      })
      .then(bufferOrStream => new Promise((resolve, reject) => {
        const dtdTokenizer = new Tokenizer(Object.assign({}, this._opts, {
          target: 'extSubset'
        }));

        dtdTokenizer.entities  = new Map(this.entities);

        dtdTokenizer.on('token', token => {
          if (token.type === 'XML_VERSION' || token.type === 'XML_ENCODING') {
            // These are ‘local’ events to the external DTD; they will not be
            // piped upwards.
            return;
          }

          // We will sometimes need to distinguish between tokens whose source
          // was local to the current target vs those brought in externally:

          token.external = true;

          this.emit('token', token);
        });

        dtdTokenizer.on('error', reject);

        dtdTokenizer.on('finish', () => {
          resolve();
        });

        if (bufferOrStream instanceof Buffer) {
          dtdTokenizer.end(bufferOrStream);
        } else if (bufferOrStream instanceof Readable) {
          bufferOrStream.pipe(dtdTokenizer);
        }
      }))
      .then(() => {
        this.unhalt();
      })
      .catch(err => {
        this.emit('error', err);
      });
  }

  // Given the CPs of an entity name, begins providing the replacement text and
  // returns an ‘expansion ticket’ representing the status of that expansion,
  // for use within the calling context to ensure boundary constraints are
  // satisfied by the result.

  expandEntity(type, entityCPs) {
    this.haltAndCatchFire();

    const entityName = String.fromCodePoint(...entityCPs);
    const expansionTicket = new ExpansionTicket(entityName, this);

    // Managing flow here is non-trivial. Expansions can include other
    // expansions, which may in turn need to resolve external resources
    // asynchronously, thereby halting our secondary iteration for a tertiary
    // iteration, and so on.

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

  // For a given type (GENERAL or PARAMETER), returns a promise which will
  // resolve to the codepoints of the replacement text.

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

    // If this is the first time we are accessing this entity, and it was an
    // external reference, then we must fetch the external reference (otherwise
    // the cps property will already be defined). In the case of entities which
    // has a literal ENTITY VALUE string, cps will always already be defined as
    // an artifact of having been parsed in the first place.

    if (entity.cps) {
      return Promise.resolve(entity);
    } else {
      return this.dereference('ENTITY', {
        publicID: entity.publicID,
        systemID: entity.systemID,
        systemIDEncoded: entity.systemID && encodeURI(entity.systemID)
      }).then(bufferOrStream => {
        const dtdTokenizer = new Tokenizer(Object.assign({}, this._opts, {
          target: 'extEntity'
        }));

        dtdTokenizer.on('token', token => {
          // We do not pipe through any tokens from external entities, but we do
          // need to pick up the REPLACEMENT_TEXT token.

          if (token.type === 'REPLACEMENT_TEXT') {
            resolve(token.value);
          }
        });

        dtdTokenizer.on('error', reject);

        if (bufferOrStream instanceof Buffer) {
          dtdTokenizer.end(bufferOrStream);
        } else if (bufferOrStream instanceof Readable) {
          bufferOrStream.pipe(dtdTokenizer);
        }
      }).then(cps => {
        entity.cps = cps;
        return entity;
      });
    }
  }

  // ERROR BARFING /////////////////////////////////////////////////////////////

  // Generic barf on bad continuation. Expects the offending CP & a description
  // of what would have been valid (`Expected ${ msg }`).

  _expected(cp, msg) {
    const prefix =
      cp === EOF ? `Tokenizer input ended abruptly` :
      cp         ? `Tokenizer failed at 0x${ cp.toString(16) }` :
                   `Tokenizer failed`;

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
  // inside the other. This pattern allows the actual tokenization state methods
  // to be focused on logic that is either about:
  //
  // - disjunctions (branching), where the next pathway depends on the last CP
  //   which was seen
  // - meta-poop, like emitting tokens, expanding entities, and applying
  //   constraints that cannot be readily described by these patterns
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
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Beginning immediately after "<!A".

  * ATTLIST_DECL() {
    // TODO
  }

  // CHARACTER REFERENCE ///////////////////////////////////////////////////////
  //
  // :: ✘ ARGUMENT CP
  // :: ✔ RETURN CP
  //
  // Beginning immediately after "&#".
  //
  // This is a somewhat special case: the returned codepoint is not a greediness
  // artifact, but rather the value resolved from the character reference.
  //
  // Excepting occurrences within the EXT_ENTITY state, any time a character
  // reference is encountered legally it is immediately transformed into the
  // value being escaped. This contrasts with how general entities work, as they
  // are not resolved as references until the time of in-document usage.
  //
  // >> CharRef ::= '&#' [0-9]+ ';' | '&#x' [0-9a-fA-F]+ ';'

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
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Starting from immediately after "<!-". Entered from various states.
  // Captures a single token:
  //
  // - COMMENT :: 1 (no delimiters)
  //
  // Note that it is not an error that "--" is considered terminal in all cases.
  // While it would seemingly be unambiguous if "--foo" appeared in comment
  // content, this constraint is nonetheless indicated by the grammar.
  //
  // Comment ::= '<!--' ((Char - '-') | ('-' (Char - '-')))* '-->'

  * COMMENT() {
    const commentCPs = [];

    let cp = yield * this.oneIs(HYPHEN);

    while (true) {
      cp = yield * this.zeroOrMoreWhere(isCommentChar, commentCPs);
      cp = yield * this.oneIs(HYPHEN, undefined, cp);
      cp = yield;

      if (cp === HYPHEN) {
        cp = yield * this.oneIs(GREATER_THAN);
        this.token('COMMENT', commentCPs);
        return;
      } else {
        cp = yield * this.oneWhere(isCommentChar, commentCPs, cp);
      }
    }
  }

  // CONDITIONAL SECTION ///////////////////////////////////////////////////////
  //
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Starting immediately after "<![".

  * CONDITIONAL_SECT() {
    // TODO
  }

  // DOCUMENT //////////////////////////////////////////////////////////////////
  //
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  //           ✨✨✨✨ TARGET STATE — UNDERSTANDS EOF ✨✨✨✨
  //
  // DOCUMENT is an entry state which takes no initial codepoint and understands
  // the EOF symbol. Directly captures only one token:
  //
  // - PROCESSING_INSTRUCTION_TARGET :: *
  //
  // >> document ::= prolog element Misc*
  // >> Misc     ::= Comment | PI | S
  // >> prolog   ::= XMLDecl? Misc* (doctypedecl Misc*)?
  // >> S        ::= (#x20 | #x9 | #xD | #xA)+

  * DOCUMENT() {
    let xmlDeclPossible     = true;
    let doctypeDeclPossible = true;
    let rootElementPossible = true;
    let cp;

    while (true) {
      cp = xmlDeclPossible
        ? yield
        : yield * this.zeroOrMoreWhere(isWhitespaceChar);

      // terminus

      if (cp === EOF) {
        if (rootElementPossible) {
          this._expected(cp, 'document element');
        }

        return;
      }

      // markup

      if (cp === LESS_THAN) {
        cp = yield;

        // disambiguation: <! can begin <!--comment or <!DOCTYPE

        if (cp === EXCLAMATION_POINT) {
          cp = yield;

          if (cp === HYPHEN) {
            yield * this.COMMENT();
            continue;
          }

          if (doctypeDeclPossible) {
            if (cp === D_UPPER) {
              yield * this.DOCUMENT_doctypeDecl();
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

          this.token('PROCESSING_INSTRUCTION_TARGET', targetCPs);
          yield * this.PROCESSING_INSTRUCTION_VALUE(cp);
          continue;
        }

        // root element
        if (rootElementPossible) {
          if (isNameStartChar(cp)) {
            doctypeDeclPossible = false;
            rootElementPossible = false;
            xmlDeclPossible     = false;

            yield * this.ELEMENT(cp);
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
  // Child of document, this state begins immediately after "<!D". Directly, it
  // can capture:
  //
  // - DOCTYPE_NAME :: 1
  // - DOCTYPE_SYSTEM_ID: 0 or 1
  // - DOCTYPE_PUBLIC_ID: 0 or 1
  //
  // The DTD is the source of all the world’s zalgo. It is is a hellgate to a
  // seething, hateful, alien dimension.
  //
  // DeclSep       ::= PEReference | S
  // doctypedecl   ::= '<!DOCTYPE' S Name (S ExternalID)? S?
  //                   ('[' intSubset ']' S?)? '>'
  // ExternalID    ::= 'SYSTEM' S SystemLiteral |
  //                   'PUBLIC' S PubidLiteral S SystemLiteral
  // PubidChar     ::= #x20 | #xD | #xA | [a-zA-Z0-9] | [-'()+,./:=?;!*#@$_%]
  // PubidLiteral  ::= '"' PubidChar* '"' | "'" (PubidChar - "'")* "'"
  // SystemLiteral ::= ('"' [^"]* '"') | ("'" [^']* "'")

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

    this.token('DOCTYPE_NAME', nameCPs);

    while (true) {
      // terminus

      if (cp === GREATER_THAN) {
        this.dereferenceDTD();
        return;
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

        this.token('DOCTYPE_PUBLIC_ID', publicIDCPs);

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

      this.token('DOCTYPE_SYSTEM_ID', systemIDCPs);

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
  // :: ✔ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Starting from "<?xml" + one cp which is not name continue. Through child
  // states, captures the following tokens:
  //
  // - XML_VERSION    :: 1
  // - XML_ENCODING   :: 0 or 1
  // - XML_STANDALONE :: 0 or 1
  //
  // Note that it is a distinct production from the text declaration which
  // appears in external entities.
  //
  // >> XMLDecl      ::= '<?xml' VersionInfo EncodingDecl? SDDecl? S? '?>'

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
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Starting after the "s" of "standalone". Captures the following token:
  //
  // - XML_STANDALONE :: 1
  //
  // >> SDDecl ::= S 'standalone' Eq
  //               ( ( "'" ( 'yes' | 'no' ) "'" )
  //               | ( '"' ( 'yes' | 'no' ) '"' ) )

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

    this.token('XML_STANDALONE', series);

    yield * this.oneIs(delimiter);
  }

  // ELEMENT ///////////////////////////////////////////////////////////////////
  //
  // :: ✔ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Starting from "<" + one name start character, this is the entry to a new
  // element (either a regular open tag or a self-closing element tag). It
  // captures the following tokens, either directly or through associated
  // child methods:
  //
  // - ELEM_OPEN_NAME  :: 1
  // - ATTR_KEY        :: 0 or more (always followed by ATTR_VALUE)
  // - ATTR_VALUE      :: 0 or more
  // - ELEM_CLOSE_NAME :: 0 or 1 (if self-closing)
  //
  // In addition, resolution of character references and expansion of general
  // entity references may occur during the processing of attribute values,
  // though in the latter case, special constraints are applied which would not
  // be applicable if the expansion were occurring in CDATA. Specifically, any
  // delimiting quotation character is "coerced" to its CDATA value regardless
  // of whether it would have been that or not according to normal rules. When
  // combined with the fact that "<" is an illegal character in attribute
  // values, the cumulative effect is that no general entity whose content would
  // have included non-CDATA were it dispatched in a CDATA context can ever be
  // validly used in an attribute value. This seems kind of clever to me — I’d
  // always wondered why "<" was illegal in attribute values, where it seemingly
  // would be unambiguously chardata; I think this explains it, they probably
  // did not want to permit the zalgo of allowing the same general entity to
  // expand to radically different results depending on context.
  //
  // >> CharRef      ::= '&#' [0-9]+ ';' | '&#x' [0-9a-fA-F]+ ';'
  // >> element      ::= EmptyElemTag | STag content ETag
  // >> EmptyElemTag ::= '<' Name (S Attribute)* S? '/>'
  // >> EntityRef    ::= '&' Name ';'
  // >> ETag         ::= '</' Name S? '>'
  // >> Reference    ::= EntityRef | CharRef
  // >> STag         ::= '<' Name (S Attribute)* S? '>'

  * ELEMENT(cp) {
    const nameCPs = [];

    cp = yield * this.oneWhere(isNameStartChar, nameCPs, cp);
    cp = yield * this.zeroOrMoreWhere(isNameContinueChar, nameCPs, cp);

    this.token('ELEM_OPEN_NAME', nameCPs);

    while (true) {
      const wsCPs = [];

      cp = yield * this.zeroOrMoreWhere(isWhitespaceChar, wsCPs, cp);

      if (cp === GREATER_THAN) {
        yield * this.ELEMENT_content();
        yield * this.seriesIs([ ...nameCPs ]);
        yield * this.oneIs(GREATER_THAN, undefined,
          yield * this.zeroOrMoreWhere(isWhitespaceChar)
        );

        this.token('ELEM_CLOSE_NAME', nameCPs);
        return;
      }

      if (cp === SLASH) {
        yield * this.oneIs(GREATER_THAN);
        this.token('ELEM_CLOSE_NAME', nameCPs);
        return;
      }

      if (!wsCPs.length) {
        this._expected(cp, '"/>", ">", or whitespace');
      }

      yield * ELEMENT_attribute(cp);

      cp = undefined;
    }
  }

  // ELEMENT: Attribute ////////////////////////////////////////////////////////
  //
  // :: ✔ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Starting from a character which should be name start, beginning the
  // attribute key. Will capture two tokens:
  //
  // - ATTR_KEY   :: 1
  // - ATTR_VALUE :: 1
  //
  // Note that while the production AttValue may also used in ATTLIST
  // declarations, this method is specific to appearances in elements because
  // the treatment of general entity references is different.
  //
  // >> Attribute    ::= Name Eq AttValue
  // >> AttValue     ::= '"' ([^<&"] | Reference)* '"'
  //                   | "'" ([^<&'] | Reference)* "'"

  * ELEMENT_attribute(cp) {
    const attrKeyCPs = [];
    const attrValCPs = [];

    let expansionTicket;

    cp = yield * this.oneWhere(isNameStartChar, attrKeyCPs, cp);
    cp = yield * this.zeroOrMoreWhere(isNameContinueChar, attrKeyCPs);

    this.token('ATTR_KEY', attrKeyCPs);

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

        this.token('ATTR_VALUE', attrValCPs);
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
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // From the immediately after the ">" of an element open tag. May capture
  // various tokens from child states, and one directly:
  //
  // - CDATA :: 1 or more
  //
  // The exit point is immediately after "</", returning control to the parent
  // ELEMENT state, which will be expecting the original element name.
  //
  // CDATA may be only whitespace — normalization and validation of content (and
  // therefore, whether such a whitespace sequence was or was not actually
  // CDATA) is not handled at this layer.
  //
  // Explicit CDATA sections are just CDATA. They are not unique structures,
  // only an alternative, explicit syntax for CDATA. HTML hacks have confused a
  // lot of people about what <![CDATA[ is I think; it seems to the common
  // assumption is that they represent sequences meant for a secondary
  // processor — in other words, a processing instruction. HTML, which is not
  // XML, considers (in most situations) "<![CDATA[" through "]]>" an invalid
  // sequence, which creates the false impression that it is actually ‘doing
  // something’ when in fact it’s just illegal junk content. In actual XML,
  // there is no difference at all between "<![CDATA[x]]>" and "x".
  //
  // CData    ::= (Char* - (Char* ']]>' Char*))
  // CDEnd    ::= ']]>'
  // CDSect   ::= CDStart CData CDEnd
  // CDStart  ::= '<![CDATA['
  // CharData ::=    [^<&]* - ([^<&]* ']]>' [^<&]*)
  // content  ::= CharData?
  //              ((element | Reference | CDSect | PI | Comment) CharData?)*

  * ELEMENT_content() {
    const contentBoundary = this.boundary();

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
              this.token('CDATA', cdataCPs);
              cdataCPs = [];
            }

            yield * this.COMMENT();
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
          this.token('CDATA', cdataCPs);
          cdataCPs = [];
        }

        // processing instruction

        if (cp === QUESTION_MARK) {
          yield * this.PROCESSING_INSTRUCTION();
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
          yield * this.ELEMENT(cp);
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
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Beginning immediately after "<!EL".

  * ELEMENT_DECL() {
    // TODO
  }

  // ENTITY DECLARATION ////////////////////////////////////////////////////////
  //
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Beginning immediately after "<!EN". It does not emit a token because
  // entity declarations are strictly information for the tokenizer and have no
  // meaning at higher levels (the exceptional case being unparsed entities, but
  // this is still dealt with elsewhere).
  //
  // >> EntityDecl  ::= GEDecl | PEDecl
  // >> EntityDef   ::= EntityValue | (ExternalID NDataDecl?)
  // >> EntityValue ::= '"' ([^%&"] | PEReference | Reference)* '"'
  //                  | "'" ([^%&'] | PEReference | Reference)* "'"
  // >> GEDecl      ::= '<!ENTITY' S Name S EntityDef S? '>'
  // >> NDataDecl   ::= S 'NDATA' S Name
  // >> PEDecl      ::= '<!ENTITY' S '%' S Name S PEDef S? '>'
  // >> PEDef       ::= EntityValue | ExternalID

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
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  //           ✨✨✨✨ TARGET STATE — UNDERSTANDS EOF ✨✨✨✨
  //
  // The external entity production is an odd case. There are actually two
  // possible productions, depending on whether the entity is general or
  // parameter. For general entities, it’s this:
  //
  // >> extParsedEnt ::= TextDecl? content
  //
  // Curiously, the other production is never given with a name (this caused me
  // a lot of confusion!). Rather it is described in the text like this:
  //
  // 4.3.2 [...] All external parameter entities are well-formed by definition.
  //
  // How mysterious. There is more information later on:
  //
  // 4.5 Construction of Entity Replacement Text
  //   [...] For an external entity, the replacement text is the content of the
  //   entity, after stripping the text declaration (leaving any surrounding
  //   whitespace) if there is one but without any replacement of character
  //   references or parameter-entity references.
  //
  // In other words, the missing production looks like this:
  //
  // >> ???? ::= TextDecl? Char*
  //
  // ...further, despite the explicit "extParsedEnt" production (which — more
  // confusion — does not, in its name, indicate that it is very specifically
  // describing external general entities only), the other implicit production
  // above seems to be sufficient for describing both cases.
  //
  // This is because the constraint on "Char*" in the case of general entities
  // (i.e., that it be "content", effectively a subset) is implicit in the rules
  // for usage of general entities, and parsed external entities are not
  // supposed to be parsed until they are referenced anyway.
  //
  // In fact I wonder if I’m not missing something, since it seems odd that they
  // would include an explicit rule for external general entities and have it be
  // redundant with replacement rules found in other places. As far as I can
  // tell, though, there is no good reason to attempt constraining the
  // replacement text in either case at the time of discovery. We do not even
  // need to confirm the validity of Char*.
  //
  // This production will directly emit one token:
  //
  // - REPLACEMENT_TEXT :: 1
  //
  // Uniquely, this token’s value will be the raw CP array, not converted yet to
  // string. It is not emitted externally like the tokens of an external DTD.

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
        this.emit('token', { type: 'REPLACEMENT_TEXT', value: replTextCPs });
        return;
      }

      textDeclPossible = false;
      replTextCPs.push(cp);
    }
  }

  // EXT_SUBSET ////////////////////////////////////////////////////////////////
  //
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  //           ✨✨✨✨ TARGET STATE — UNDERSTANDS EOF ✨✨✨✨
  //
  // EXT_SUBSET is an entry state which takes no initial codepoint and
  // understands the EOF symbol. It captures no tokens directly. Terminology can
  // be confusing in the spec surrounding ‘entities’. It helps to know that yes,
  // an external subset is just a kind of external entity, but it is not
  // accessed through dereferencing <!ENTITY; rather, it is accessed through
  // dereferencing the external ID of a <!DOCTYPE declaration. It has a specific
  // grammar to adhere to, whereas declared external entities are just
  // TEXT_DECL? ANYTHING; ANYTHING is the text which will be expanded, and
  // therefore cannot be parsed according to a specific grammar until it is
  // actually referenced in a specific context).
  //
  // The differences between EXT_SUBSET and INT_SUBSET (a similar production
  // which may occur between "[" and "]" in a DOCTYPE declaration) are:
  //
  // - being an external entity, it may begin with TEXT_DECL;
  // - it is a "file", like DOCUMENT and EXT_ENTITY, so we will only know it is
  //   complete when it gets EOF symbol;
  // - the CONDITIONAL_SECT (<!INCLUDE, <!IGNORE) productions are valid;
  // - most importantly, parameter references are permitted to occur in (almost)
  //   any position *within* markup declarations
  //
  // That last item is the primary case that makes decoupling the concepts of
  // lexing and parsing in XML difficult (well, I gave up on that fantasy,
  // anyway), though it is not the only example, just the most extreme one.
  //
  // When we are in INT_SUBSET, a special rule kicks in during expansion of
  // parameter references: the content of the parameter reference is parsed,
  // effectively, as "extSubsetDecl" below, and not as INT_SUBSET. This is the
  // only case where the unpacked content is not interpreted according to the
  // local context, so it is important to know about: INT_SUBSET "becomes"
  // EXT_SUBSET for the duration of the expansion.
  //
  // However!! This rule kicks in only for expansion of parameter references
  // which were, themselves, root "external" entities, as opposed to those
  // whose values were indicated with "EntityValue". This is part of why we must
  // maintain a record of this distinction about entity origin.
  //
  // For more information about all this, please see section 1.1 of the XML
  // specification, "Origin and Goals" — specifically:
  //
  // 4. It shall be easy to write programs which process XML documents.
  //
  // Nailed it, guys.
  //
  // >> conditionalSect    ::= includeSect | ignoreSect
  // >> extSubset          ::= TextDecl? extSubsetDecl
  // >> extSubsetDecl      ::= (markupdecl | conditionalSect | DeclSep)*
  // >> Ignore             ::= Char* - (Char* ('<![' | ']]>') Char*)
  // >> ignoreSect         ::= '<![' S? 'IGNORE' S?
  //                           '[' ignoreSectContents* ']]>'
  // >> ignoreSectContents ::= Ignore ('<![' ignoreSectContents ']]>' Ignore)*
  // >> includeSect        ::= '<![' S? 'INCLUDE' S? '[' extSubsetDecl ']]>'

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
            this.token('PROCESSING_INSTRUCTION_TARGET', targetCPs);
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
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Beginning immediately after "<!N".

  * NOTATION_DECL() {
    // TODO
  }

  // PARAMETER ENTITY REFERENCE ////////////////////////////////////////////////
  //
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP (returns expansion ticket instead)
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
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Starting immediately after "<?", this state may be entered from ELEMENT,
  // and DOCUMENT_doctypeDecl, where we do not need to disambiguate from text or
  // xml declarations. Will capture one token:
  //
  // - PROCESSING_INSTRUCTION_TARGET :: 1
  //
  // >> PI ::= '<?' PITarget (S (Char* - (Char* '?>' Char*)))? '?>'

  * PROCESSING_INSTRUCTION() {
    const targetCPs = [];

    let cp;

    yield * this.oneWhere(isNameStartChar, targetCPs);
    cp = yield * this.zeroOrMoreWhere(isNameContinueChar, targetCPs);

    if (isPITarget(targetCPs)) {
      this.token('PROCESSING_INSTRUCTION_TARGET', targetCPs);
      yield * this.PROCESSING_INSTRUCTION_VALUE(cp);
      return;
    }

    this._expected(cp, 'valid processing instruction target');
  }

  // PROCESSING_INSTRUCTION_VALUE //////////////////////////////////////////////
  //
  // :: ✔ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Starting from immediately after the processing instruction target. This
  // state may be entered from various states (because each root entity may need
  // to disambiguate PROCESSING_INSTRUCTION from an xml/text declaration).
  //
  // - PROCESSING_INSTRUCTION_VALUE :: 0 or 1

  * PROCESSING_INSTRUCTION_VALUE(cp) {
    if (cp === QUESTION_MARK) {
      yield * this.oneIs(GREATER_THAN);
      return;
    }

    const valueCPs = [];

    yield * this.oneWhere(isWhitespaceChar, undefined, cp);

    while (true) {
      const questionCPs = [];

      cp = yield * this.zeroOrMoreWhere(isProcInstValueChar, valueCPs);
      cp = yield * this.oneOrMoreIs(QUESTION_MARK, undefined, cp);

      if (cp === GREATER_THAN) {
        valueCPs.push(...questionCPs.slice(1));

        if (valueCPs.length) {
          this.token('PROCESSING_INSTRUCTION_VALUE', valueCPs);
        }

        return;
      } else {
        yield * this.oneWhere(isProcInstValueChar, undefined, cp);
        valueCPs.push(...questionCPs, cp);
      }
    }
  }

  // TEXT_DECL /////////////////////////////////////////////////////////////////
  //
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Starting from "<?xml ". Through child states, captures the following
  // tokens:
  //
  // - XML_VERSION    :: 0 or 1
  // - XML_ENCODING   :: 1
  //
  // >> TextDecl ::= '<?xml' VersionInfo? EncodingDecl S? '?>'

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
  // :: ✘ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Starting after the initial "e" in "encoding". Captures one token:
  //
  // - XML_ENCODING :: 1
  //
  // This is employed in both XML_DECLARATION (where it is optional) and
  // TEXT_DECLARATION (where it is mandatory).
  //
  // >> EncName      ::= [A-Za-z] ([A-Za-z0-9._] | '-')*
  // >> EncodingDecl ::= S 'encoding' Eq
  //                     ( '"' EncName '"'
  //                     | "'" EncName "'" )

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

    this.token('XML_ENCODING', encValueCPs);

    if (cp !== delimiter) {
      this._expected(cp, 'corresponding closing quotation mark');
    }
  }

  // XML_VERSION ///////////////////////////////////////////////////////////////
  //
  // :: ✔ ARGUMENT CP
  // :: ✘ RETURN CP
  //
  // Starting from expected "v", captures the following tokens:
  //
  // - XML_VERSION :: 1
  //
  // This is employed by both XML_DECLARATION (where it is a mandatory
  // production) and TEXT_DECLARATION (where it is not.)
  //
  // >> Eq          ::= S? '=' S?
  // >> VersionInfo ::= S 'version' Eq
  //                    ( "'" VersionNum "'"
  //                    | '"' VersionNum '"' )
  // >> VersionNum  ::= '1.' [0-9]+

  * XML_VERSION(cp) {
    cp = yield * this.seriesIs(VERSION_CPS, undefined, cp);
    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);
    cp = yield * this.oneIs(EQUALS_SIGN, undefined, cp);
    cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);

    const delimiter = cp;
    const versionNumCPs = [ ONE, PERIOD ];

    if (cp !== QUOTE_DBL && cp !== QUOTE_SNG) {
      this._expected(cp, 'quoted version value');
    }

    cp = yield * this.seriesIs(versionNumCPs);
    cp = yield * this.oneOrMoreWhere(isDecChar, versionNumCPs);

    this.token('XML_VERSION', versionNumCPs);

    if (cp !== delimiter) {
      this._expected(cp, 'corresponding closing quotation mark');
    }
  }
}
