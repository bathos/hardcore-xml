import ExtSubset from '../../ast/nodes/doctype-external';

import { one } from '../drivers';

import SUBSET from './subset';

import { EOF } from '../../data/codepoints';

export default function * (document) {
  const extSubset = new ExtSubset();

  yield extSubset;

  document.doctype.external = extSubset;

  // Being a terminal/entry production, we have not yet entered the main loop of
  // the grammar driver; to get the ball rolling, we need to bounce a CP before
  // we can start issuing signals.

  yield yield;
  yield { signal: 'CHAOS_PLEASE' };
  yield * SUBSET(extSubset, true);
  yield * one(EOF);
}
