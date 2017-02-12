
import { asterisk, oneOf } from '../drivers';

import {
  isAttValueCharDbl,
  isAttValueCharSng,
  isWhitespaceChar,

  AMPERSAND, QUOTE_DBL, SPACE
} from '../../data/codepoints';

import GENERAL_REFERENCE from './general-reference';

export default function * (delim, key, attdef, nodes) {
  const inMarkup = attdef !== nodes;

  const pred = delim === QUOTE_DBL
    ? isAttValueCharDbl
    : isAttValueCharSng;

  const attValueCPs = [];

  let expansionTicket;

  while (true) {
    // Attribute values have special normalization rules which are, like
    // everything in XML, made "extra special" by references.

    const newAttValueCPs = yield * asterisk(pred, []);

    attValueCPs.push(...newAttValueCPs.map(cp =>
      isWhitespaceChar(cp) ? SPACE: cp
    ));

    const nonValueCP = yield * oneOf(delim, AMPERSAND);

    if (nonValueCP === delim) {
      // During expansion, values of " or ' are always treated as CDATA.

      if (expansionTicket && expansionTicket.active) {
        attValueCPs.push(nonValueCP);
        continue;
      }

      break;
    }

    const res = yield * GENERAL_REFERENCE(nodes);

    if (typeof res === 'object') {
      if (!expansionTicket || !expansionTicket.active) {
        expansionTicket = res;
      }
    } else {
      attValueCPs.push(res);
    }
  }

  let normalizedValue = String.fromCodePoint(...attValueCPs);

  // The spec text for how tokenized attribute normalization occurs might
  // be considered a little ambiguous. The initial normalization process
  // treats all literal whitespace as SPACE, but not whitespace introduced
  // via character reference. They make this part very clear, and the
  // procedure is outlined step by step. After that, it says:
  //
  //   3.3.3 Attribute-Value Normalization
  //
  //   [...]
  //
  //   If the attribute type is not CDATA, [...] [you] must further
  //   process the normalized attribute value by discarding any leading
  //   and trailing space (#x20) characters, and by replacing sequences of
  //   space (#x20) characters by a single space (#x20) character.
  //
  // Note "further process the normalized...", making it clear that we’re
  // doing this afterwards. But then it goes on to say the following:
  //
  //   Note that if the unnormalized attribute value contains a character
  //   reference to a white space character other than space (#x20), the
  //   normalized value contains the referenced character itself (#xD, #xA
  //   or #x9). This contrasts with the case where the unnormalized value
  //   contains a white space character (not a reference), which is
  //   replaced with a space character (#x20) in the normalized value and
  //   also contrasts with the case where the unnormalized value contains
  //   an entity reference whose replacement text contains a white space
  //   character; being recursively processed, the white space character
  //   is replaced with a space character (#x20) in the normalized value.
  //
  // What’s unclear to me is whether a character reference to SPACE, which
  // became a regular space after the first pass, is meant to be treated
  // by the tokenization normalization procedure as literal and retained
  // or if it is captured (potentially) when trimming like other spaces
  // which were originally literal. The examples they give do not
  // illustrate this case, focusing instead on the behavior of the other
  // three space characters, which is not ambiguous in the text anyway. I
  // have opted to assume they do get normalized in the second pass, based
  // on the "further process" language in the first passage, but depending
  // on your interpretation, I may be accepting illegal values by doing
  // so.

  if (attdef) {
    if (attdef.isTokenized) {
      normalizedValue = normalizedValue
        .replace(/^ +/, '')
        .replace(/ +$/, '')
        .replace(/ {2,}/, ' ');
    }

    // VC application (selective, since we can’t validate things like
    // IDREF yet). This is kind of ugly, but I’ve tried to make a point of
    // throwing as early as I reasonably can so that the expectation
    // messages give correct context for where the error was encountered.

    if (!attdef.matchesValueGrammatically(normalizedValue)) {
      yield (
        `value of ${ key } to conform to grammar or acceptable values ` +
        `specified by the attribute definition type (${ attdef.type })`
      );
    }

    if (inMarkup) {
      if (attdef.type.startsWith('ENTIT')) {
        const entities = normalizedValue
          .split(/ /g)
          .map(name => [ name, nodes.doctype.getEntity(name) ]);

        for (const [ name, entity ] of entities) {
          if (!entity) {
            yield `entity ${ name } to have been declared`;
          }

          if (entity.type !== 'UNPARSED') {
            yield (
              `value of attribute ${ key } not to refer to a parsed ` +
              `entity (${ name })`
            );
          }
        }
      }

      if (attdef.fixed && normalizedValue !== attdef.defaultValue) {
        yield (
          `value of attribute ${ key } to only have the #FIXED value ` +
          `of "${ attdef.defaultValue }"`
        );
      }
    }
  }

  return normalizedValue;
}
