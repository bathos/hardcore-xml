import ExtSubset from '../../ast/nodes/doctype-external';

import { one } from '../drivers';

import SUBSET from './subset';

import { EOF } from '../../data/codepoints';

export default function * (document) {
  const extSubset = new ExtSubset();

  yield extSubset;

  document.doctype.external = extSubset;

  yield { SIGNAL: 'CHAOS_MODE_START' };

  yield * SUBSET(extSubset);

  yield { SIGNAL: 'CHAOS_MODE_END' };

  yield * one(EOF);
}
