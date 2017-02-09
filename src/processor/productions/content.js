import CDATA from '../../ast/nodes/cdata';

import { accreteName, asterisk, one, oneOf, plus, series } from '../drivers';

import COMMENT           from './comment';
import GENERAL_REFERENCE from './general-reference';
import ELEMENT           from './element';
import PROC_INST         from './proc-inst';

import {
  isCDATAChar, isCDATASectionChar, isNameStartChar, isWhitespaceChar,

  AMPERSAND, BRACKET_LEFT, BRACKET_RIGHT, EXCLAMATION_POINT, GREATER_THAN,
  HYPHEN, LESS_THAN, QUESTION_MARK, SLASH,

  CDATA_CPS
} from '../../data/codepoints';

const entryCPs = [ AMPERSAND, LESS_THAN, BRACKET_RIGHT, isCDATAChar ];

export default function * (elem, elemDecl) {
  const contentBoundary = yield { signal: 'EXPANSION_BOUNDARY' };
  const cdataCPs = [];

  while (true) {
    const cp = yield * oneOf(...entryCPs);

    if (cp === LESS_THAN) {
      if (cdataCPs.length) {
        const cdata = new CDATA({ text: String.fromCodePoint(...cdataCPs) });
        elem.push(cdata);
        cdataCPs.length = 0;
      }

      const contentBoundaryConfirm = contentBoundary();
      const markupBoundary = yield { signal: 'EXPANSION_BOUNDARY' };

      const cp = yield * oneOf(
        EXCLAMATION_POINT,
        QUESTION_MARK,
        SLASH,
        isNameStartChar
      );

      if (cp === SLASH) {
        contentBoundaryConfirm();
        return;
      }

      if (elemDecl && elemDecl.type === 'EMPTY') {
        yield `no content in EMPTY-type element ${ elem.name }`;
      }

      if (cp === EXCLAMATION_POINT) {
        const cp = yield * oneOf(BRACKET_LEFT, HYPHEN);

        if (cp === HYPHEN) {
          yield * COMMENT(elem);
          markupBoundary()();
          continue;
        }

        if (elemDecl && !elemDecl.allowsCDATA) {
          yield `no CDATA content in element ${ elem.name }`;
        }

        yield * series(CDATA_CPS);
        yield * one(BRACKET_LEFT);

        while (true) {
          yield * asterisk(isCDATASectionChar, cdataCPs);

          const bracketCPs = yield * plus(BRACKET_RIGHT, undefined, []);

          if (bracketCPs.length === 1) {
            cdataCPs.push(...bracketCPs);
            continue;
          }

          cdataCPs.push(...bracketCPs.slice(0, -2));

          const cp = yield * oneOf(GREATER_THAN, isCDATASectionChar);

          if (cp === GREATER_THAN) {
            break;
          }

          cdataCPs.push(cp);
        }

        markupBoundary()();

        const cdata = new CDATA({
          section: true,
          text: String.fromCodePoint(...cdataCPs)
        });

        elem.push(cdata);
        cdataCPs.length = 0;
        continue;
      }

      if (cp === QUESTION_MARK) {
        yield * PROC_INST(elem);
        markupBoundary()();
        continue;
      }

      const name = yield * accreteName(cp);

      if (elemDecl && !elemDecl.matchesContent(elem, name)) {
        yield (
          `not to see element ${ name } in this position (disallowed by the ` +
          `content specification of element ${ elem.name }`
        );
      }

      yield * ELEMENT(elem, name);

      markupBoundary()();

      continue;
    }

    if (cp === AMPERSAND) {
      const res = yield * GENERAL_REFERENCE(elem);

      if (typeof res === 'number') {
        if (elemDecl && !elemDecl.allowsCDATA) {
          yield `no CDATA content in element ${ elem.name }`;
        }

        cdataCPs.push(res);
      }

      continue;
    }

    if (elemDecl && !elemDecl.allowsCDATA) {
      if (elemDecl.contentSpec !== 'EMPTY' && isWhitespaceChar(cp)) {
        continue;
      }

      yield `no CDATA content in element ${ elem.name }`;
    }

    if (cp === BRACKET_RIGHT) {
      const bracketCPs = asterisk(BRACKET_RIGHT, [ cp ]);
      const cp = yield * oneOf(...entryCPs);

      if (bracketCPs.length > 1 && cp === GREATER_THAN) {
        yield `valid element content (sequence "]]>" may not appear in CDATA)`;
      }

      cdataCPs.push(...bracketCPs);

      yield cp;
      continue;
    }

    cdataCPs.push(cp);
  }
}
