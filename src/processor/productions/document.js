import Document from '../../ast/nodes/document';

import { accreteName, asterisk } from '../drivers';

import COMMENT      from './comment';
import DOCTYPE_DECL from './doctype-decl';
import ELEMENT      from './element';
import PROC_INST    from './proc-inst';
import XML_DECL     from './xml-decl';

import {
  isNameStartChar,
  isWhitespaceChar,
  D_UPPER, EOF, EXCLAMATION_POINT, HYPHEN, LESS_THAN, QUESTION_MARK
} from '../../data/codepoints';

export default function * () {
  const document = new Document();

  yield document;

  let xmlDeclPossible = true;

  while (true) {
    if (!xmlDeclPossible) {
      yield * asterisk(isWhitespaceChar);
    }

    const cp = yield;

    if (cp === EOF) {
      if (!document.root) {
        return 'document to have root element';
      }

      return;
    }

    if (cp === LESS_THAN) {
      const cp = yield;

      if (cp === QUESTION_MARK) {
        if (xmlDeclPossible) {
          const name = yield * accreteName();

          xmlDeclPossible = false;

          if (name === 'xml') {
            yield * XML_DECL(document, false);
            continue;
          } else {
            yield * PROC_INST(document, name);
            continue;
          }
        } else {
          yield * PROC_INST(document);
          continue;
        }
      }

      xmlDeclPossible = false;

      if (cp === EXCLAMATION_POINT) {
        const cp = yield;

        if (cp === HYPHEN) {
          yield * COMMENT(document);
          continue;
        }

        if (cp === D_UPPER && !document.doctype) {
          yield * DOCTYPE_DECL(document);
          continue;
        }

        return document.doctype || document.root
          ? 'first "-" of comment ("<!--")'
          : 'first "-" of comment ("<!--") or "D" ("<!DOCTYPE")';
      }

      if (isNameStartChar(cp) && !document.root) {
        const name = yield * accreteName(cp);

        if (document.doctype && document.doctype.name !== name) {
          return `root element to be named ${ document.doctype.name }`;
        }

        yield * ELEMENT(document, name);
        continue;
      }

      return xmlDeclPossible
        ? '"?" (xml decl, PI), "!" (comment, doctype decl), or element name'
        : document.root
          ? '"?" (PI) or "!" (comment)'
          : document.doctype
            ? '"?" (PI), "!" (comment), or element name'
            : '"?" (PI), "!" (comment, doctype decl), or element name';
    }

    if (isWhitespaceChar(cp)) {
      xmlDeclPossible = false;
      continue;
    }

    return xmlDeclPossible
      ? '"<" (xml decl, PI, comment, doctype decl, element) or whitespace'
      : document.root
        ? '"<" (PI, comment) or whitespace'
        : document.doctype
          ? '"<" (PI, comment, root element) or whitespace'
          : '"<" (PI, comment, root element, doctype decl) or whitespace';
  }
}
