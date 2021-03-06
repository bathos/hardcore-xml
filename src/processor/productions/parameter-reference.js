import { one } from '../drivers';

import NAME from './name';

import { SEMICOLON } from '../../data/codepoints';

export default function * (nodes, inEntityValue) {
  const referenceBoundary = yield { signal: 'EXPANSION_BOUNDARY' };

  const name = yield * NAME();

  yield * one(SEMICOLON);

  referenceBoundary()();

  const entity = nodes.doctype.getEntity(name);

  if (!entity) {
    yield `parameter entity "${ name }" to have been defined`;
  }

  if (entity.type !== 'PARAMETER') {
    yield `entity "${ name }" to be a parameter entity`;
  }

  return yield {
    signal: 'EXPAND_ENTITY',
    value: {
      entity,
      pad: !inEntityValue
    }
  };
}
