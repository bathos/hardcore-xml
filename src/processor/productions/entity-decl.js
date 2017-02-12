import EntityDeclaration from '../../ast/nodes/declaration-entity';

import {
  accreteName, asterisk, externalID, one, oneOf, plus, series
} from '../drivers';

import GENERAL_REFERENCE   from './general-reference';
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

  opts.name = yield * accreteName(cp);

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
        const newExpansionTicket = yield * PARAMETER_REFERENCE(nodes, true);
        expansionTicket = expansionTicket || newExpansionTicket;
        continue;
      }

      value.push(cp);
    }

    opts.value = value;
  } else {
    Object.assign(opts, yield * externalID(cp));

    if (opts.type === 'GENERAL') {
      const wsCPs = yield * asterisk(isWhitespaceChar, []);

      if (wsCPs.length) {
        const cp = yield * oneOf(N_UPPER, GREATER_THAN);

        if (cp === N_UPPER) {
          yield * series(NDATA_CPS, 1);
          yield * plus(isWhitespaceChar);

          opts.notationName = yield * accreteName();
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
