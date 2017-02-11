import Comment from '../../ast/nodes/comment';

import { asterisk, one } from '../drivers';

import {
  isCommentChar,
  GREATER_THAN, HYPHEN
} from '../../data/codepoints';

export default function * (nodes) {
  yield * one(HYPHEN, 'second "-" of comment start "<!--"');

  const commentCPs = [];

  while (true) {
    yield * asterisk(isCommentChar, commentCPs);
    yield * one(HYPHEN, 'valid comment content character or "-->"');

    const cp = yield;

    if (cp === HYPHEN) {
      yield * one(GREATER_THAN, '">" of "-->" ("--" is not valid in comment)');

      nodes.push(new Comment({
        content: String.fromCodePoint(...commentCPs)
      }));

      return;
    } else if (isCommentChar(cp)) {
      commentCPs.push(HYPHEN, cp);
    } else {
      yield 'valid comment content character or "->" completion of "-->"';
    }
  }
}
