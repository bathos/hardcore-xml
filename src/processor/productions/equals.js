import { asterisk, one } from '../drivers';
import { isWhitespaceChar, EQUALS_SIGN } from '../../data/codepoints';

export default function * () {
  yield * asterisk(isWhitespaceChar);
  yield * one(EQUALS_SIGN);
  yield * asterisk(isWhitespaceChar);
}
