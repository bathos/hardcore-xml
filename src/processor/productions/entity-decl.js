import EntityDeclaration from '../../ast/nodes/declaration-entity';

import { asterisk, one, oneOf, plus, series } from '../drivers';

import EXT_ID              from './ext-id';
import GENERAL_REFERENCE   from './general-reference';
import NAME                from './name';
import PARAMETER_REFERENCE from './parameter-reference';

import {
  isNameContinueChar, isNameStartChar, isWhitespaceChar, isXMLChar,

  AMPERSAND, GREATER_THAN, HASH_SIGN, N_UPPER, P_UPPER, PERCENT_SIGN, QUOTE_DBL,
  QUOTE_SNG, S_UPPER, SEMICOLON,

  ENTITY_CPS, NDATA_CPS
} from '../../data/codepoints';

export default function * (nodes) {
  const opts = { type: 'GENERAL' };

  let cp;

  yield * series(ENTITY_CPS, 2);
  yield * plus(isWhitespaceChar);

  cp = yield * oneOf(PERCENT_SIGN, isNameStartChar);

  if (cp === PERCENT_SIGN) {
    opts.type = 'PARAMETER';
    yield * plus(isWhitespaceChar);
    cp = yield;
  }

  opts.name = yield * NAME(cp);

  yield * plus(isWhitespaceChar);

  cp = yield * oneOf(P_UPPER, QUOTE_DBL, QUOTE_SNG, S_UPPER);

  if (cp === QUOTE_DBL || cp === QUOTE_SNG) {
    const delim = cp;
    const value = [];

    let expansionTicket;

    while (true) {
      const cp = yield * oneOf(delim, PERCENT_SIGN, AMPERSAND, isXMLChar);

      if (cp === delim && (!expansionTicket || !expansionTicket.active)) {
        break;
      }

      if (cp === AMPERSAND) {
        const cp = yield * oneOf(HASH_SIGN, isNameStartChar);

        if (cp === HASH_SIGN) {
          value.push(yield * GENERAL_REFERENCE(undefined, true));
          continue;
        } else {
          value.push(AMPERSAND, cp);
          yield * asterisk(isNameContinueChar, value);
          yield * one(SEMICOLON, undefined, value);
          continue;
        }
      }

      if (cp === PERCENT_SIGN) {
        const cp = yield;
        yield cp;

        if (isWhitespaceChar(cp)) {
          value.push(PERCENT_SIGN);
        } else {
          const newExpansionTicket = yield * PARAMETER_REFERENCE(nodes, true);
          expansionTicket = expansionTicket || newExpansionTicket;
        }

        continue;
      }

      value.push(cp);
    }

    opts.value = value;
  } else {
    Object.assign(opts, yield * EXT_ID(cp));

    opts.path = yield { signal: 'GET_PATH', value: opts.systemID };

    if (opts.type === 'GENERAL') {
      const wsCPs = yield * asterisk(isWhitespaceChar, []);

      if (wsCPs.length) {
        const cp = yield * oneOf(N_UPPER, GREATER_THAN);

        if (cp === N_UPPER) {
          yield * series(NDATA_CPS, 1);
          yield * plus(isWhitespaceChar);

          opts.notationName = yield * NAME();
          opts.type = 'UNPARSED';

          if (!nodes.doctype.getNotation(opts.notationName)) {
            yield `notation ${ opts.notationName } to have been declared`;
          }
        } else {
          yield cp;
        }
      }
    }
  }

  yield * asterisk(isWhitespaceChar);
  yield * one(GREATER_THAN);

  nodes.push(new EntityDeclaration(opts));
}
