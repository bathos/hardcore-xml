import Element from '../../ast/nodes/element';

import { accreteName, asterisk, equals, one, oneOf, series } from '../drivers';

import CONTENT           from './content';
import GENERAL_REFERENCE from './general-reference';

import {
  isAttValueCharDbl,
  isAttValueCharSng,
  isNameStartChar,
  isWhitespaceChar,
  isXMLChar,

  AMPERSAND, GREATER_THAN, QUOTE_DBL, QUOTE_SNG, SLASH

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
          yield * asterisk(pred, attValueCPs);

          const nonValueCP = yield * oneOf(delim, AMPERSAND);

          if (nonValueCP === delim) {
            if (expansionTicket && expansionTicket.active) {
              attValueCPs.push(nonValueCP);
            } else {
              break;
            }
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

        element.setAttribute(key, String.fromCodePoint(...attValueCPs));

        continue;
      }
    }

    break;
  }

  if (cp === GREATER_THAN) {
    yield * CONTENT(element);
    yield * series([ ...name ].map(char => char.codePointAt(0)));
    yield * asterisk(isWhitespaceChar);
    yield * one(GREATER_THAN);
    nodes.push(element);
    element.validate();
    return;
  }

  if (cp === SLASH) {
    yield * one(GREATER_THAN);
    nodes.push(element);
    element.validate();
    return;
  }
}
