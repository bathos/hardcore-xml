import Element from '../../ast/nodes/element';

import { accreteName, asterisk, equals, one, oneOf, series } from '../drivers';

import CONTENT           from './content';
import GENERAL_REFERENCE from './general-reference';

import {
  isAttValueCharDbl,
  isAttValueCharSng,
  isNameStartChar,
  isWhitespaceChar,

  AMPERSAND, GREATER_THAN, QUOTE_DBL, QUOTE_SNG, SLASH

} from '../../data/codepoints';

export default function * (nodes, name) {
  if (nodes.doctype && !nodes.doctype.getElement(name)) {
    yield `element ${ name } to have been declared (document has DTD)`;
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
            if (!expansionTicket || !expansionTicket.active) {
              attValueCPs.push(nonValueCP);
            } else {
              break;
            }
          }

          const newExpansionTicket = yield * GENERAL_REFERENCE(nodes);

          if (!expansionTicket || !expansionTicket.active) {
            expansionTicket = newExpansionTicket;
          }
       }

       // xxxx
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
