import AttdefDeclaration  from '../../ast/nodes/declaration-attdef';
import AttlistDeclaration from '../../ast/nodes/declaration-attlist';

import { accreteName, asterisk, one, oneOf, plus, series } from '../drivers';

import ATT_VALUE from './att-value';

import {
  isNameContinueChar, isNameStartChar, isWhitespaceChar,

  C_UPPER, E_UPPER, F_UPPER, GREATER_THAN, HASH_SIGN, I_UPPER, M_UPPER, N_UPPER,
  O_UPPER, PARENTHESIS_LEFT, PARENTHESIS_RIGHT, PIPE, QUOTE_DBL, QUOTE_SNG,
  R_UPPER, S_UPPER, Y_UPPER,

  ATTLIST_CPS, CDATA_CPS, ENTIT_CPS, ENTITIES_CPS, FIXED_CPS, ID_CPS, IDREF_CPS,
  IMPLIED_CPS, NMTOKEN_CPS, NOTATION_CPS, REQUIRED_CPS
} from '../../data/codepoints';

const typeCPs = [ C_UPPER, E_UPPER, I_UPPER, N_UPPER, PARENTHESIS_LEFT ];

export default function * (nodes) {
  yield * series(ATTLIST_CPS, 1);
  yield * plus(isWhitespaceChar);

  const attlist = new AttlistDeclaration({
    elementName: yield * accreteName()
  });

  nodes.push(attlist);

  while (true) {
    let cp;

    cp = yield * oneOf(isWhitespaceChar, GREATER_THAN);

    if (cp !== GREATER_THAN) {
      yield * asterisk(isWhitespaceChar);

      cp = yield * oneOf(isNameStartChar, GREATER_THAN);
    }

    if (cp === GREATER_THAN) {
      break;
    }

    const attdef = new AttdefDeclaration({
      name: yield * accreteName(cp)
    });

    attlist.push(attdef);

    yield * plus(isWhitespaceChar);

    switch (yield * oneOf(...typeCPs)) {
      case C_UPPER:
        yield * series(CDATA_CPS, 1);
        attdef.type = 'CDATA';
        break;

      case E_UPPER:
        yield * series(ENTIT_CPS, 1);

        switch (yield * oneOf(I_UPPER, Y_UPPER)) {
          case I_UPPER:
            yield * series(ENTITIES_CPS, 6);
            attdef.type = 'ENTITIES';
            break;
          case Y_UPPER:
            attdef.type = 'ENTITY';
            break;
        }

        break;

      case I_UPPER:
        yield * series(ID_CPS, 1);

        cp = yield * oneOf(R_UPPER, isWhitespaceChar);

        if (cp === R_UPPER) {
          yield * series(IDREF_CPS, 2);
          cp = yield;

          if (cp === S_UPPER) {
            attdef.type = 'IDREFS';
          } else {
            attdef.type = 'IDREF';
            yield cp;
          }
        } else {
          attdef.type = 'ID';
          yield cp;
        }

        break;

      case N_UPPER:
        switch (yield * oneOf(M_UPPER, O_UPPER)) {
          case M_UPPER:
            yield * series(NMTOKEN_CPS, 2);
            cp = yield;

            if (cp === S_UPPER) {
              attdef.type = 'NMTOKENS';
            } else {
              attdef.type = 'NMTOKEN';
              yield cp;
            }

            break;

          case O_UPPER:
            yield * series(NOTATION_CPS);
            yield * plus(isWhitespaceChar);
            yield * one(PARENTHESIS_LEFT);

            attdef.type = 'NOTATION';
            attdef.enumeration = new Set();

            while (true) {
              yield * asterisk(isWhitespaceChar);

              const name = yield * accreteName();

              if (attdef.enumeration.has(name)) {
                yield `notation ${ name } not to appear twice in attdef enum`;
              }

              if (!nodes.doctype.getNotation(name)) {
                yield `notation ${ name } to have been declared`;
              }

              attdef.enumeration.add(name);

              yield * asterisk(isWhitespaceChar);

              cp = yield * oneOf(PARENTHESIS_RIGHT, PIPE);

              if (cp === PARENTHESIS_RIGHT) {
                break;
              }
            }

            break;
        }

        break;

      case PARENTHESIS_LEFT:
        attdef.type = 'ENUMERATION';
        attdef.enumeration = new Set();

        while (true) {
          yield * asterisk(isWhitespaceChar);

          const token = yield * plus(isNameContinueChar);

          if (attdef.enumeration.has(token)) {
            yield `nmtoken ${ token } not to appear twice in attdef enum`;
          }

          attdef.enumeration.add(token);

          cp = yield * oneOf(PARENTHESIS_RIGHT, PIPE);

          if (cp === PARENTHESIS_RIGHT) {
            break;
          }
        }
    }

    yield * plus(isWhitespaceChar);

    cp = yield * oneOf(HASH_SIGN, QUOTE_DBL, QUOTE_SNG);

    if (cp === HASH_SIGN) {
      switch (yield * oneOf(F_UPPER, I_UPPER, R_UPPER)) {
        case F_UPPER:
          yield * series(FIXED_CPS, 1);
          yield * plus(isWhitespaceChar);
          cp = yield * oneOf(QUOTE_DBL, QUOTE_SNG);
          attdef.fixed = true;
          break;
        case I_UPPER:
          yield * series(IMPLIED_CPS, 1);
          continue;
        case R_UPPER:
          yield * series(REQUIRED_CPS, 1);
          attdef.required = true;
          continue;
      }
    }

    attdef.defaultValue = yield * ATT_VALUE(cp, attdef.name, attdef, nodes);
  }
}
