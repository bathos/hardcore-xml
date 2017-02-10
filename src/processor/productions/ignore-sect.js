import { asterisk } from '../drivers';

import {
  isXMLChar,
  BRACKET_LEFT, BRACKET_RIGHT, EXCLAMATION_POINT, GREATER_THAN, LESS_THAN
} from '../../data/codepoints';

export default function * IGNORE_SECT() {
  while (true) {
    const bracketRightCPs = yield * asterisk(BRACKET_RIGHT, []);

    if (bracketRightCPs.length > 2) {
      const cp = yield;

      if (cp === GREATER_THAN) {
        return;
      }

      yield cp;
      continue;
    }

    const lessThanCPs = yield * asterisk(LESS_THAN, []);

    if (lessThanCPs.length) {
      const sectionBoundary = yield { SIGNAL: 'EXPANSION_BOUNDARY' };

      const cp = yield;

      if (cp === EXCLAMATION_POINT) {
        const cp = yield;

        if (cp === BRACKET_LEFT) {
          yield * IGNORE_SECT();
          sectionBoundary()();
          continue;
        }

        yield cp;
        continue;
      }

      yield cp;
      continue;
    }

    if (!isXMLChar(cp)) {
      yield `valid xml content character within IGNORE section`;
    }
  }
};
