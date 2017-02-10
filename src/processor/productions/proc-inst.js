import ProcessingInstruction from '../../ast/nodes/processing-instruction';
import { notXML } from '../../ast/ast-util';
import { accreteName, asterisk, one } from '../drivers';

import {
  isProcInstValueChar,
  isWhitespaceChar,

  GREATER_THAN, QUESTION_MARK

} from '../../data/codepoints';

export default function * (nodes, providedName) {
  const name = providedName || (yield * accreteName());

  if (!notXML(name)) {
    yield 'processing instruction target not to be "xml" (case insensitive)';
  }

  const cp = yield;

  if (cp === QUESTION_MARK) {
    yield * one(GREATER_THAN);

    nodes.push(new ProcessingInstruction({
      target: name
    }));

    return;
  }

  if (isWhitespaceChar(cp)) {
    const instructionCPs = [];

    while (true) {
      yield * asterisk(isProcInstValueChar, instructionCPs);
      yield * one(QUESTION_MARK);

      while (true) {
        const cp = yield;

        if (cp === GREATER_THAN) {
          nodes.push(new ProcessingInstruction({
            target: name,
            instruction: String.fromCodePoint(...instructionCPs)
          }));

          return;
        } else if (isProcInstValueChar(cp)) {
          instructionCPs.push(QUESTION_MARK, cp);
          break;
        } else if (cp === QUESTION_MARK) {
          instructionCPs.push(QUESTION_MARK);
          continue;
        } else {
          yield 'valid processing instruction characters or ">" of "?>"';
          return;
        }
      }
    }
  }

  yield '"?>" or whitespace';
}
