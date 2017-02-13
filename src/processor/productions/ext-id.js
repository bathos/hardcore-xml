import { asterisk, one, oneOf, plus, series } from '../drivers';

import {
  isPublicIDCharDbl,
  isPublicIDCharSng,
  isSystemIDCharDbl,
  isSystemIDCharSng,
  isWhitespaceChar,

  P_UPPER, QUOTE_DBL, QUOTE_SNG, S_UPPER,

  PUBLIC_CPS, SYSTEM_CPS
} from '../../data/codepoints';

export default function * (initCP, permitPublicAlone) {
  let publicID;

  const cp = initCP || (yield * oneOf(P_UPPER, S_UPPER));

  if (cp === P_UPPER) {
    const publicCPs = [];

    yield * series(PUBLIC_CPS, 1);
    yield * plus(isWhitespaceChar);

    const delim = yield * oneOf(QUOTE_DBL, QUOTE_SNG);
    const pred = delim === QUOTE_DBL ? isPublicIDCharDbl : isPublicIDCharSng;

    yield * asterisk(pred, publicCPs);
    yield * one(delim);

    publicID = String
      .fromCodePoint(...publicCPs)
      .replace(/[\n\r\t ]{2,}/g, ' ')
      .replace(/(?:^ +| +$)/g, '');

    const afterCP = yield;

    if (!isWhitespaceChar(afterCP)) {
      if (permitPublicAlone) {
        yield afterCP;
        return { publicID };
      }

      yield 'whitespace before systemID literal';
    }

    yield * asterisk(isWhitespaceChar);

    const nextCP = yield;

    if (nextCP === QUOTE_DBL || nextCP === QUOTE_SNG) {
      yield nextCP;
    } else if (permitPublicAlone) {
      yield nextCP;
      return { publicID };
    } else {
      yield '""" or "\'" beginning systemID literal';
      return;
    }
  } else {
    yield * series(SYSTEM_CPS, 1);
    yield * plus(isWhitespaceChar);
  }

  const systemCPs = [];

  const delim = yield * oneOf(QUOTE_DBL, QUOTE_SNG);
  const pred = delim === QUOTE_DBL ? isSystemIDCharDbl : isSystemIDCharSng;

  yield * asterisk(pred, systemCPs);
  yield * one(delim);

  const systemID = String.fromCodePoint(...systemCPs);

  return { publicID, systemID };
}
