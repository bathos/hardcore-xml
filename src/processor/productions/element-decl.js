import ContentSpec        from '../../ast/nodes/declaration-content-spec';
import ElementDeclaration from '../../ast/nodes/declaration-element';

import { accreteName, asterisk, one, oneOf, plus, series } from '../drivers';

import CONTENT_SPEC from './content-spec';

import {
  isWhitespaceChar,

  A_UPPER, ASTERISK, E_UPPER, GREATER_THAN, HASH_SIGN, PARENTHESIS_LEFT,
  PARENTHESIS_RIGHT, PIPE,

  ANY_CPS, ELEMENT_CPS, EMPTY_CPS, PCDATA_CPS
} from '../../data/codepoints';

export default function * (nodes) {
  yield * series(ELEMENT_CPS, 3);
  yield * plus(isWhitespaceChar);

  const name = yield * accreteName();

  if (nodes.doctype.getElement(name)) {
    yield `element ${ name } to be declared only once`;
  }

  const elemDecl = new ElementDeclaration({ name });

  yield * plus(isWhitespaceChar);

  const cp = yield * oneOf(A_UPPER, E_UPPER, PARENTHESIS_LEFT);

  if (cp === A_UPPER) {
    yield * series(ANY_CPS, 1);
    elemDecl.contentSpec = 'ANY';
  } else if (cp === E_UPPER) {
    yield * series(EMPTY_CPS, 1);
    elemDecl.contentSpec = 'EMPTY';
  } else {
    yield * asterisk(isWhitespaceChar);
    const cp = yield * oneOf(HASH_SIGN, PARENTHESIS_LEFT);

    if (cp === HASH_SIGN) {
      yield * series(PCDATA_CPS, 1);

      elemDecl.mixed = true;

      elemDecl.contentSpec = new ContentSpec({
        qualifier: '*',
        type: 'CHOICE'
      });

      while (true) {
        yield * asterisk(isWhitespaceChar);
        const cp = yield * oneOf(PARENTHESIS_RIGHT, PIPE);

        if (cp === PARENTHESIS_RIGHT) {
          break;
        }

        yield * asterisk(isWhitespaceChar);

        const name = yield * accreteName();

        if (elemDecl.contentSpec.some(cs => cs.name === name)) {
          yield `element ${ name } not to appear twice in choice content spec`;
        }

        elemDecl.contentSpec.push(new ContentSpec({ name, type: 'ELEMENT' }));
      }

      yield * one(ASTERISK);
    } else {
      elemDecl.contentSpec = yield * CONTENT_SPEC(cp);
    }
  }

  yield * asterisk(isWhitespaceChar);
  yield * one(GREATER_THAN);

  nodes.push(elemDecl);
}
