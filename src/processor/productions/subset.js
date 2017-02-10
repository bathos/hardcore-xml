import {
  asterisk, one, oneOf, series
} from '../drivers';

import ATTLIST_DECL        from './attlist-decl';
import COMMENT             from './comment';
import ELEMENT_DECL        from './element-decl';
import ENTITY_DECL         from './entity-decl';
import IGNORE_SECT         from './ignore-sect';
import NOTATION_DECL       from './notation-decl';
import PARAMETER_REFERENCE from './parameter-reference';
import PROC_INST           from './proc-inst';

import {
  isWhitespaceChar,

  A_UPPER, BRACKET_LEFT, BRACKET_RIGHT, E_UPPER, EXCLAMATION_POINT, G_UPPER,
  GREATER_THAN, HYPHEN, I_UPPER, L_UPPER, LESS_THAN, N_UPPER, PERCENT_SIGN,
  QUESTION_MARK,

  IGNORE_CPS, INCLUDE_CPS
} from '../../data/codepoints';

export default function * SUBSET(nodes) {
  while (true) {
    const includeBoundaries = [];

    yield * asterisk(isWhitespaceChar);

    const cp = yield;

    if (cp === LESS_THAN) {
      const markupBoundary = yield { SIGNAL: 'EXPANSION_BOUNDARY' };

      const cp = yield * oneOf(EXCLAMATION_POINT, QUESTION_MARK);

      if (cp === QUESTION_MARK) {
        yield * PROC_INST(nodes);
        markupBoundary()();
        continue;
      }

      yield * one(EXCLAMATION_POINT);

      const possibleCPs = [ A_UPPER, E_UPPER, HYPHEN, N_UPPER ];

      if (yield { SIGNAL: 'CHAOS?' }) {
        possibleCPs.push(BRACKET_LEFT);
      }

      if (includeBoundaries.length) {
        possibleCPs.push(BRACKET_RIGHT);
      }

      switch (yield * oneOf(...possibleCPs)) {
        case HYPHEN:
          yield * COMMENT(nodes);
          break;
        case BRACKET_LEFT:
          yield * asterisk(isWhitespaceChar);
          yield * one(I_UPPER);
          switch (yield * oneOf(G_UPPER, N_UPPER)) {
            case G_UPPER:
              yield * series(IGNORE_CPS, 2);
              yield * asterisk(isWhitespaceChar);
              yield * one(BRACKET_LEFT);
              yield * IGNORE_SECT();
              break;
            case N_UPPER:
              yield * series(INCLUDE_CPS, 2);
              yield * asterisk(isWhitespaceChar);
              yield * one(BRACKET_LEFT);
              includeBoundaries.push(markupBoundary);
              continue;
          }
          break;
        case BRACKET_RIGHT:
          yield * series([ BRACKET_RIGHT, BRACKET_RIGHT, GREATER_THAN ], 1);
          includeBoundaries.pop()()(); // so bouncy
          break;
        case A_UPPER:
          yield * ATTLIST_DECL(nodes);
        case E_UPPER:
          switch (yield * oneOf(L_UPPER, N_UPPER)) {
            case L_UPPER:
              yield * ELEMENT_DECL(nodes);
              break;
            case N_UPPER:
              yield * ENTITY_DECL(nodes);
              break;
          }
          break;
        case N_UPPER:
          yield * NOTATION_DECL(nodes);
          break;
      }

      markupBoundary()();
      continue;
    }

    if (cp === PERCENT_SIGN) {
      yield * PARAMETER_REFERENCE(nodes, false);
      continue;
    }

    if (includeBoundaries.length) {
      yield `terminal "]]>" of included section`;
    }

    yield cp;
    return;
  }
}
