import ContentSpec from '../../ast/nodes/declaration-content-spec';

import { asterisk, oneOf } from '../drivers';

import NAME from './name';

import {
  isNameStartChar, isWhitespaceChar,

  ASTERISK, COMMA, PARENTHESIS_LEFT, PARENTHESIS_RIGHT, PIPE, PLUS_SIGN,
  QUESTION_MARK
} from '../../data/codepoints';

export default function * CONTENT_SPEC(cp) {
  const contentSpec = new ContentSpec();

  if (cp === PARENTHESIS_LEFT) {
    while (true) {
      yield * asterisk(isWhitespaceChar);

      const cp = yield * oneOf(PARENTHESIS_LEFT, isNameStartChar);

      contentSpec.push(yield * CONTENT_SPEC(cp));

      if (contentSpec.hasAmbiguousSequence) {
        yield (
          `not to encounter content spec grammar that the XML spec ` +
          `considers non-deterministic`
        );
      }

      yield * asterisk(isWhitespaceChar);

      const seps =
        contentSpec.type === 'SEQUENCE' ? [ COMMA ] :
        contentSpec.type === 'CHOICE'   ? [ PIPE ] :
                                          [ COMMA, PIPE ];

      const nextCP = yield * oneOf(PARENTHESIS_RIGHT, ...seps);

      if (nextCP === PARENTHESIS_RIGHT) {
        if (!contentSpec.type) {
          contentSpec.type = 'SEQUENCE';
        }

        break;
      }

      contentSpec.type = nextCP === PIPE ? 'CHOICE' : 'SEQUENCE';
    }
  } else {
    contentSpec.type = 'ELEMENT';
    contentSpec.name = yield * NAME(cp);
  }

  const lastCP = yield;

  if (lastCP === ASTERISK || lastCP === PLUS_SIGN || lastCP === QUESTION_MARK) {
    contentSpec.qualifier = String.fromCodePoint(lastCP);
  } else {
    yield lastCP;
  }

  return contentSpec;
}
