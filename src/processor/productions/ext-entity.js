import XML_DECL from './xml-decl';

import {
  isWhitespaceChar,
  EOF, L_LOWER, LESS_THAN, M_LOWER, QUESTION_MARK, X_LOWER
} from '../../data/codepoints';

const initTextDeclSequence = [
  LESS_THAN,
  QUESTION_MARK,
  X_LOWER,
  M_LOWER,
  L_LOWER
];

export default function * () {
  const cps = [];

  yield cps;

  const candidateCPs = [];

  for (const expectedCP of initTextDeclSequence) {
    const cp = yield;

    candidateCPs.push(cp);

    if (cp !== expectedCP) {
      cps.push(...candidateCPs);
      break;
    }
  }

  if (candidateCPs.length === initTextDeclSequence.length) {
    const cp = yield;

    if (!isWhitespaceChar(cp)) {
      cps.push(...candidateCPs, cp);
    } else {
      yield cp;
      yield * XML_DECL(undefined, true);
    }
  }

  while (true) {
    const cp = yield;

    if (cp === EOF) {
      return;
    }

    cps.push(cp);
  }
}
