import { asterisk, one } from '../drivers';
import { isNameContinueChar, isNameStartChar } from '../../data/codepoints';

export default function * (initCP) {
  if (initCP) {
    yield initCP;
  }

  const cps = [];

  yield * one(isNameStartChar, undefined, cps);
  yield * asterisk(isNameContinueChar, cps);

  return String.fromCodePoint(...cps);
}
