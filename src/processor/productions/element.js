import Element from '../../ast/nodes/element';

import { asterisk, one, oneOf, series } from '../drivers';

import ATT_VALUE from './att-value';
import CONTENT   from './content';
import EQUALS    from './equals';
import NAME      from './name';

import {
  isNameStartChar, isWhitespaceChar,
  GREATER_THAN, QUOTE_DBL, QUOTE_SNG, SLASH
} from '../../data/codepoints';

export default function * (nodes, name) {
  const decl = nodes.doctype && nodes.doctype.getElement(name);

  if (nodes.doctype && !decl) {
    yield `element ${ name } to have been declared`;
  }

  const element = new Element({ name });

  let cp;

  while (true) {
    cp = yield * oneOf(GREATER_THAN, SLASH, isWhitespaceChar);

    if (isWhitespaceChar(cp)) {
      yield * asterisk(isWhitespaceChar);

      cp = yield * oneOf(GREATER_THAN, SLASH, isNameStartChar);

      if (isNameStartChar(cp)) {
        const key = yield * NAME(cp);

        const attdef = decl && decl.getAttDef(key);

        if (decl && !attdef) {
          yield `attribute ${ key } of element ${ name } to have been declared`;
        }

        if (element.hasAttribute(key)) {
          yield `not to see attribute ${ key } repeated`;
        }

        yield * EQUALS();

        const delim = yield * oneOf(QUOTE_DBL, QUOTE_SNG);
        const value = yield * ATT_VALUE(delim, key, attdef, nodes);

        element.setAttribute(key, value);

        continue;
      }
    }

    // At this point, we can do two things:
    //
    // - Confirm that all required attributes have appeared
    // - Artificially add any attributes with default values
    //
    // The simplest way to achieve the latter in a way that stays uniform with
    // other logic is fabricate the would-be source text and inject it into the
    // incoming stream. This dovetails nicely with a notable processing rule,
    // which is that aside from token grammar, the validity of a default value
    // in an attdef is not confirmed until and unless that default value is
    // actually used.

    if (decl) {
      const allAttdefs =
        [ ...decl.getAttDefs().values() ];

      const requiredDefs =
        allAttdefs.filter(attdef => attdef.required || attdef.fixed);

      const defaultDefs =
        allAttdefs.filter(attdef => attdef.hasDefault);

      for (const requiredDef of requiredDefs) {
        if (!element.hasAttribute(requiredDef.name)) {
          yield `element ${ name } to have attribute ${ requiredDef.name }`;
        }
      }

      const artificialText = defaultDefs
        .filter(defaultDef => !element.hasAttribute(defaultDef.name))
        .map(defaultDef => {
          const defaultValue = defaultDef
            .defaultValue
            .replace(/"/g, '&quot;');

          return ` ${ defaultDef.name }="${ defaultValue }"`;
        })
        .join('');

      const artificialCPs = Array
        .from(artificialText)
        .map(char => char.codePointAt(0));

      if (artificialCPs.length) {
        artificialCPs.push(cp);
        yield artificialCPs;
        continue;
      }
    }

    break;
  }

  nodes.push(element);

  if (cp === GREATER_THAN) {
    yield * CONTENT(element, decl);
    yield * series([ ...name ].map(char => char.codePointAt(0)));
    yield * asterisk(isWhitespaceChar);
  }

  yield * one(GREATER_THAN);

  if (decl && !decl.matchesContent(element)) {
    yield `content of ${ name } element to conform to declared content spec`;
  }

  return;
}
