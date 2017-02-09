import Element from '../../ast/nodes/element';

import { accreteName, asterisk, equals, one, oneOf, series } from '../drivers';

import CONTENT           from './content';
import GENERAL_REFERENCE from './general-reference';

import {
  isAttValueCharDbl,
  isAttValueCharSng,
  isNameStartChar,
  isWhitespaceChar,

  AMPERSAND, GREATER_THAN, QUOTE_DBL, QUOTE_SNG, SLASH, SPACE

} from '../../data/codepoints';

export default function * (nodes, name) {
  const decl = nodes.doctype && nodes.doctype.getElement(name);

  if (nodes.doctype && !decl) {
    yield `element ${ name } to have been declared`;
  }

  const element = new Element({ name });

  let cp;

  while (true) {
    cp = yield * oneOf(GREATER_THAN, SLASH, isWhitespaceChar);

    if (isWhitespaceChar(cp)) {
      yield * asterisk(isWhitespaceChar);

      cp = yield * oneOf(GREATER_THAN, SLASH, isNameStartChar);

      if (isNameStartChar) {
        const key = yield * accreteName(cp);

        const attdef = decl && decl.getAttDef(key);

        if (decl && !attdef) {
          yield `attribute ${ key } of element ${ name } to have been declared`;
        }

        if (element.hasAttribute(key)) {
          yield `not to see attribute ${ key } repeated`;
        }

        yield * equals();

        const delim = yield * oneOf(QUOTE_DBL, QUOTE_SNG);

        const pred = delim === QUOTE_DBL
          ? isAttValueCharDbl
          : isAttValueCharSng;

        const attValueCPs = [];

        let expansionTicket;

        while (true) {
          // Attribute values have special normalization rules which are, like
          // everything in XML, made "extra special" by references.

          const newAttValueCPs = yield * asterisk(pred, newAttValueCPs);

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

          if (attdef.type === 'NOTATION') {
            const notation = nodes.doctype.getNotation(normalizedValue);

            if (!notation) {
              yield `notation ${ normalizedValue } to have been declared`;
            }
          }

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

        element.setAttribute(key, String.fromCodePoint(...attValueCPs));

        continue;
      }
    }

    // At this point, we can do two things:
    //
    // - Confirm that all required attributes have appeared
    // - Artificially add any attributes with default values
    //
    // The simplest way to achieve the latter in a way that stays uniform with
    // other logic is fabricate the would-be source text and inject it into the
    // incoming stream. This dovetails nicely with a notable processing rule,
    // which is that aside from token grammar, the validity of a default value
    // in an attdef is not confirmed until and unless that default value is
    // actually used.

    if (decl) {
      const allAttdefs = [ ...decl.getAttDefs().values() ];
      const requiredDefs = allAttdefs.filter(attdef => attdef.required);
      const defaultDefs = allAttdefs.filter(attdef => attdef.hasDefault);

      for (const requiredDef of requiredDefs) {
        if (!element.hasAttribute(requiredDef.name)) {
          yield `element ${ name } to have attribute ${ requiredDef.name }`;
        }
      }

      const artificialText = defaultDefs
        .filter(defaultDef => !element.hasAttribute(defaultDef.name))
        .map(defaultDef => {
          const defaultValue = defaultDef
            .defaultValue
            .replace(/"/g, '&quot;');

          return ` ${ defaultDef.name }="${ defaultValue }"`;
        })
        .join('');

      const artificialCPs = Array
        .from(artificialText)
        .map(char => char.codePointAt(0));

      if (artificialCPs.length) {
        artificialCPs.push(cp);
        yield artificialCPs;
        continue;
      }
    }

    break;
  }

  nodes.push(element);

  if (cp === GREATER_THAN) {
    yield * CONTENT(element, decl);
    yield * series([ ...name ].map(char => char.codePointAt(0)));
    yield * asterisk(isWhitespaceChar);
  }

  yield * one(GREATER_THAN);

  if (decl && !decl.matchesContent(element)) {
    yield `content of ${ name } element to conform to declared content spec`;
  }

  return;
}
