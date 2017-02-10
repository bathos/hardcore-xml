import Doctype from '../../ast/nodes/doctype';

import SUBSET from './subset';

import {
  accreteName,
  asterisk,
  externalID,
  one,
  oneOf,
  plus,
  series
} from '../drivers';

import {
  isWhitespaceChar,

  BRACKET_LEFT, BRACKET_RIGHT, GREATER_THAN, P_UPPER, S_UPPER,

  DOCTYPE_CPS
} from '../../data/codepoints';

export default function * (document) {
  yield * series(DOCTYPE_CPS, 3);
  yield * plus(isWhitespaceChar);

  const name    = yield * accreteName();
  const doctype = new Doctype({ name });
  const wsCPs   = [];

  yield * asterisk(isWhitespaceChar, wsCPs);

  const nextCPs = wsCPs.length
    ? [ BRACKET_LEFT, GREATER_THAN, P_UPPER, S_UPPER ]
    : [ BRACKET_LEFT, GREATER_THAN ];

  let cp = yield * oneOf(...nextCPs);

  if (cp === P_UPPER || cp === S_UPPER) {
    const { publicID, systemID } = yield * externalID(cp, false);
    doctype.publicID = publicID;
    doctype.systemID = systemID;
    yield * asterisk(isWhitespaceChar);
    cp = yield;
  }

  document.push(doctype);

  if (cp === BRACKET_LEFT) {
    yield * SUBSET(doctype);
    yield * one(BRACKET_RIGHT);
    yield * asterisk(isWhitespaceChar);
    cp = yield;
  }

  if (cp === GREATER_THAN) {
    if (doctype.systemID) {
      yield {
        signal: 'DEREFERENCE_DTD',
        value: {
          name:            doctype.name,
          publicID:        doctype.publicID,
          systemID:        doctype.systemID,
          systemIDEncoded: encodeURI(doctype.systemID)
        }
      };
    }
    return;
  }
}
