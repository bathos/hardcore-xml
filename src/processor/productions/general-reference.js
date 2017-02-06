import { accreteName, one, oneOf, plus } from '../drivers';

import standardEntities from '../../data/entities';

import {
  isDecChar,
  isHexChar,
  isNameStartChar,
  isXMLChar,

  HASH_SIGN, SEMICOLON, X_LOWER

} from '../../data/codepoints';

export default function * (node) {
  const referenceBoundary = yield { signal: 'EXPANSION_BOUNDARY' };

  const cp = yield * oneOf(HASH_SIGN, isNameStartChar);

  if (cp === HASH_SIGN) {
    const cp = yield * oneOf(X_LOWER, isDecChar);

    const [ cps, pred, base ] = cp === X_LOWER
      ? [ [    ], isHexChar, 16 ]
      : [ [ cp ], isDecChar, 10 ];

    yield * plus(pred, undefined, cps);

    const resolvedCP = Number.parseInt(String.fromCodePoint(...cps), base);

    if (!isXMLChar(resolvedCP)) {
      yield `character reference to resolve to a legal XML character`;
    }

    yield * one(SEMICOLON);

    referenceBoundary()();

    return resolvedCP;
  }

  const entityName = yield * accreteName(cp);

  yield * one(SEMICOLON);

  referenceBoundary()();

  let entity = node.doctype && node.doctype.getEntity(entityName);

  if (!entity) {
    if (standardEntities.has(entityName)) {
      entity = standardEntities.get(entityName);
    } else {
      yield `general entity "${ entityName }" to have been defined`;
    }
  }

  if (entity.type !== 'GENERAL') {
    yield `entity "${ entityName }" to be a general entity`;
  }

  return yield {
    signal: 'EXPAND_ENTITY',
    value: entity
  };
}
