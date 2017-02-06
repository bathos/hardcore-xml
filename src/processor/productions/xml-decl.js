import { asterisk, equals, one, oneOf, plus, series } from '../drivers';

import {
  isDecChar,
  isEncContinueChar,
  isEncStartChar,
  isWhitespaceChar,

  E_LOWER, GREATER_THAN, N_LOWER, ONE, PERIOD, QUESTION_MARK, QUOTE_DBL,
  QUOTE_SNG, S_LOWER, V_LOWER, Y_LOWER,

  ENCODING_CPS, NO_CPS, STANDALONE_CPS, VERSION_CPS, YES_CPS

} from '../../data/codepoints';

export default function * (document, isTextDecl) {
  let cp;

  yield * plus(isWhitespaceChar);

  cp = yield;

  if (cp === V_LOWER) {
    yield * series(VERSION_CPS, 1);
    yield * equals();

    const delim = yield * oneOf(QUOTE_DBL, QUOTE_SNG);

    yield * one(ONE);
    yield * one(PERIOD);
    yield * plus(isDecChar);
    yield * one(delim);

    const after = yield * oneOf(isWhitespaceChar, QUESTION_MARK);

    if (after === QUESTION_MARK) {
      yield * one(GREATER_THAN);
      return;
    }

    yield * asterisk(isWhitespaceChar);

    cp = yield;

  } else if (!isTextDecl) {
    yield '"v" of "version"';
    return;
  }

  if (isTextDecl && cp !== E_LOWER) {
    yield `"e" of "encoding"`;
  }

  if (cp === E_LOWER) {
    yield * series(ENCODING_CPS, 1);
    yield * equals();

    const delim = yield * oneOf(QUOTE_DBL, QUOTE_SNG);

    const encodingCPs = [];

    yield * one(isEncStartChar, undefined, encodingCPs);
    yield * asterisk(isEncContinueChar, encodingCPs);
    yield * one(delim);

    yield {
      signal: 'SET_ENCODING',
      value: String.fromCodePoint(...encodingCPs)
    };

    const after = yield * oneOf(isWhitespaceChar, QUESTION_MARK);

    if (after === QUESTION_MARK) {
      yield * one(GREATER_THAN);
      return;
    }

    yield * asterisk(isWhitespaceChar);

    cp = yield;
  }

  if (!isTextDecl && cp === S_LOWER) {
    yield * series(STANDALONE_CPS, 1);
    yield * equals();

    const delim = yield * oneOf(QUOTE_DBL, QUOTE_SNG);
    const sddCP = yield * oneOf(N_LOWER, Y_LOWER);

    if (sddCP === Y_LOWER) {
      yield * series(YES_CPS, 1);
    } else {
      yield * series(NO_CPS, 1);
    }

    yield * one(delim);

    document.standalone = sddCP === Y_LOWER;

    yield * asterisk(isWhitespaceChar);

    cp = yield;
  }

  yield cp;

  yield * one(QUESTION_MARK, '"?" of "?>"');
  yield * one(GREATER_THAN, '">" of "?>"');
}
