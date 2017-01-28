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
  SEMICOLON, SLASH, T_LOWER, T_UPPER, U_UPPER, V_LOWER, X_LOWER, X_UPPER,
  Y_LOWER, Y_UPPER,

  // CODEPOINT SEQUENCES

  ANY_CPS,
  ATTLIST_CPS,
  CDATA_CPS,
  DOCTYPE_CPS,
  ELEMENT_CPS,
  EMPTY_CPS,
  ENCODING_CPS,
  ENTITY_CPS,
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
  VERSION_CPS,
  YES_CPS
} from '../data/codepoints';

import entities from '../data/entities';

const CONTEXT_LEN = 30;
const EOF         = Symbol();
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

// Some information about the implementation:
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
// contain and more than CDATA...
//
// Someone more clever than myself might see a way to have all these things
// while still maintaining clean separation between lexing and parsing. I could
// not. It seemed to me that entity expansion in particular made the the two
// concepts truly inextricable.
//
// That said, at this level we are emitting ‘tokens’. That makes it,
// superficially, kinda lexy, even though inside it’s really parsing syntactic
// as well as lexical productions.

export default
class Tokenizer extends Decoder {
  constructor(opts={}) {
    super(opts);

    const $opts = this._opts = Object.assign({}, DEFAULT_OPTS, opts);

    // Position

    this.line             = 0;
    this.column           = -1;
    this.textContext      = new Uint32Array(CONTEXT_LEN);
    this.textContextIndex = 0;

    // Entity expansion options and state

    this.entities          = new Map(entities.xml);
    this.expansionCount    = 0;
    this.expansionSize     = undefined;
    this.maxExpansionCount = $opts.maxExpansionCount;
    this.maxExpansionSize  = $opts.maxExpansionSize;
    this.activeExpansions  = [];

    this.__expansionPromise__ = undefined; // Last deepest expansion promise

    // Root context

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

    // Halt on errors

    this.on('error', err => {
      console.log(err);
      this.haltAndCatchFire();
    });

    // Token event

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
          this.dereferenceDTD();
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
  }

  // INPUT AND OUTPUT //////////////////////////////////////////////////////////

  // Called by decoder with each codepoint from input stream — calls eat() but
  // also advances position markers of source text for error reporting. Note
  // that newlines have already been normalized.

  codepoint(cp) {
    this.column++;

    this.eat(cp);

    this.textContext[this.textContextIndex] = cp;
    this.textContextIndex = (this.textContextIndex + 1) % CONTEXT_LEN;

    if (cp === LF) {
      this.line++;
    }
  }

  // Emits a token, serializing the string value if applicable.

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
  // "<" of "</" — but "<" might be legal until we see the "/". So the first
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
              `it did not begin.`
            );
          } else {
            this._expected(undefined,
              `that, when dereferencing the ‘${ terminalTicket.name }’ ` +
              `entity, it would not violate hierarchical boundaries. A ` +
              `single entity must terminate any markup structures that it ` +
              `begins.`
            );
          }
        }
      };
    };
  }

  // Called to dereference external entities; returns a promise. Overwritten by
  // user options.

  dereference(type, data) {
    // TODO: fake for testing.
    return Promise.resolve(Buffer.from('<?xml encoding="wat"?>', 'utf8'));
  }

  // Called when an external reference to a DTD is parsed. Execution of the
  // existing stream is halted while we await the resolution and parsing of the
  // external DTD, whose events will be piped in.

  dereferenceDTD() {
    this.haltAndCatchFire();

    this
      .dereference('DTD', this.doctype)
      .then(bufferOrStream => new Promise((resolve, reject) => {
        const dtdTokenizer = new Tokenizer(Object.assign({}, this._opts, {
          target: 'extSubset'
        }));

        dtdTokenizer.on('token', token => {
          if (token.type === 'XML_VERSION' || token.type === 'XML_ENCODING') {
            // These are ‘local’ events to the external DTD; they will not be
            // piped upwards.
            return;
          }

          // It is important to be able to distinguish between internal and
          // external tokens up until all DTD processing is complete:

          token.external = true;

          // Although the external DTD must be parsed before an internal DTD,
          // because the internal DTD may reference entities declared in the
          // external DTD, the rules state that the processor must behave as if
          // internal rules were declared first (e.g., for ATTLIST precedence).
          // Tagging the tokens as external helps us jump through this hoop
          // later, by retroactively treating internal markup declarations as if
          // they had been the ones seen first.

          this.emit('token', token);
        });

        dtdTokenizer.on('error', reject);

        dtdTokenizer.on('finish', () => {
          dtdTokenizer.eat(EOF);
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

    const expansionPromise = this._expansionPromise__ = this
      .resolveEntityText(type, entityName)
      .then(entity => new Promise((resolve, reject) => {
        const iter = entity.cps[Symbol.iterator]();

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
        systemID: entity.systemID
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

        dtdTokenizer.on('finish', () => {
          dtdTokenizer.eat(EOF);
        });

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
                   `Tokenizer failed.`;

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
      `       ${ ellipsis }${ contextStr }\n` +
      `       Expected ${ msg }.`
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
  // Alternatively, this could be written more linearly:
  //
  // cp = yield * this.oneOrMoreWhere('...', isDecChar, numberCPs);
  // cp = yield * this.oneIs('...', PERIOD, numberCPs, cp);
  // cp = yield * this.zeroOrMoreWhere('...', isDecChar, numberCPs, cp);
  //
  // Each method can be considered equivalent to applying an EBNF/regex
  // quantifier (*, +, none) to either literal characters ("is") or character
  // classes ("where"). Not every possible combination is represented since some
  // would never be used (e.g. oneOrNoneIs) — plus some would imply the need for
  // backtracking, which fortunately is entirely avoidable in XML.

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

  // CHARACTER REFERENCE ///////////////////////////////////////////////////////
  //
  // :: ✘ ARGUMENT CP
  // :: ✔ RETURN CP
  //
  // Beginning immediately after "&#".
  //
  // This is a somewhat special case: the resolve character is not a greediness
  // artifact, but rather the resolved codepoint represented by the character
  // reference.
  //
  // Anywhere they may appear, character references resolve to the codepoint
  // they describe at the time of initial evaluation. This contrasts with how
  // general entities work, as they are not resolved as references until the
  // time of in-document usage.
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
      cp = yield;

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
        cp = yield * this.zeroOrMoreWhere(isWhitespaceChar);
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
  // intSubset     ::= (markupdecl | DeclSep)*
  // markupdecl    ::= elementdecl | AttlistDecl | EntityDecl | NotationDecl
  //                 | PI | Comment
  // PEReference   ::= '%' Name ';'
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
        return;
      }

      // internal subset

      if (!internalSubsetPossible) {
        this._expected(cp, '">"');
      }

      if (cp === BRACKET_LEFT) {
        externalIDPossible = false;
        internalSubsetPossible = false;

        while (false) {
          // TODO
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
  // CDSect  ::= CDStart CData CDEnd
  // CDStart ::= '<![CDATA['
  // CData   ::= (Char* - (Char* ']]>' Char*))
  // CDEnd   ::= ']]>'

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

      if (textDeclPossible && cp === GREATER_THAN) {
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
  // >> extSubset     ::= TextDecl? extSubsetDecl
  // >> extSubsetDecl ::= (markupdecl | conditionalSect | DeclSep)*

  * EXT_SUBSET() {
    let textDeclPossible = true;
    let cp, x;

    // TODO

    while (cp = yield) {
      if (!x) this.token('EXAMPLE', [ P_UPPER, O_UPPER, O_UPPER, P_UPPER ]);
      x = true;
    }
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
