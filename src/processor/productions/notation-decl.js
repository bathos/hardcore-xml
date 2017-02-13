import NotationDeclaration from '../../ast/nodes/declaration-notation';

import EXT_ID from './ext-id';
import NAME   from './name';

import { asterisk, one, plus, series } from '../drivers';

import {
  isWhitespaceChar,
  GREATER_THAN,
  NOTATION_CPS
} from '../../data/codepoints';

export default function * (nodes) {
  yield * series(NOTATION_CPS, 1);
  yield * plus(isWhitespaceChar);

  const name = yield * NAME();

  if (nodes.doctype.getNotation(name)) {
    yield `notation ${ name } to be declared only one time`;
  }

  yield * plus(isWhitespaceChar);

  const { publicID, systemID } = yield * EXT_ID(undefined, true);

  yield * asterisk(isWhitespaceChar);
  yield * one(GREATER_THAN);

  nodes.push(new NotationDeclaration({ name, publicID, systemID }));
}
