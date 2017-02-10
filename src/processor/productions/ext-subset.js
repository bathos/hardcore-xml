import ExtSubset from '../../ast/nodes/doctype-external';

import { one } from '../drivers';

import SUBSET from './subset';

import { EOF } from '../../data/codepoints';

export default function * (document) {
  const extSubset = new ExtSubset();

  yield extSubset;

  document.doctype.external = extSubset;

  yield { SIGNAL: 'CHAOS_PLEASE' };

  yield * SUBSET(extSubset);
  yield * one(EOF);
}
