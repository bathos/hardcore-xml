import NotationDeclaration from '../../ast/nodes/declaration-notation';

import {
  accreteName, asterisk, externalID, one, plus, series
} from '../drivers';

import {
  isWhitespaceChar,
  GREATER_THAN,
  NOTATION_CPS
} from '../../data/codepoints';

export default function * (nodes) {
  yield * series(NOTATION_CPS, 1);
  yield * plus(isWhitespaceChar);

  const name = yield * accreteName();

  if (nodes.doctype.getNotation(name)) {
    yield `notation ${ name } to be declared only one time`;
  }

  yield * plus(isWhitespaceChar);

  const { publicID, systemID } = yield * externalID(undefined, true);

  yield * asterisk(isWhitespaceChar);
  yield * one(GREATER_THAN);

  nodes.push(new NotationDeclaration({ name, publicID, systemID }));
}
