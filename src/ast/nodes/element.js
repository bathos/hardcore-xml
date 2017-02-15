import assert                from 'assert';
import ASTNode               from '../ast-node';
import CDATA                 from './cdata';
import Comment               from './comment';
import ProcessingInstruction from './processing-instruction';
import text                  from '../text';

import {
  compareAlpha,
  indent,
  isArrayIndex,
  isName,
  isNmtoken,
  isString,
  isXMLString,
  quote
} from '../ast-util';

export default
class Element extends ASTNode {
  constructor({ name }={}) {
    super();

    this.name = name;

    this.allAttributes = function() {
      if (this === proxy) {
        return new Map(attr);
      }
    };

    const attr = new Map();

    const toAttrKey = key => {
      if (typeof key === 'string') {
        if (key.startsWith('$')) {
          return key.slice(1);
        }

        if (!(key in this) && !isArrayIndex(key)) {
          return key;
        }
      }
    };

    const proxy = new Proxy(this, {
      deleteProperty: (target, key) => {
        const attrKey = toAttrKey(key);

        if (attrKey) {
          attr.delete(attrKey);
          return true;
        }

        return Reflect.deleteProperty(target, key);
      },

      get: (target, key, receiver) => {
        const attrKey = toAttrKey(key);

        if (attrKey) {
          return attr.get(attrKey);
        }

        return Reflect.get(target, key, receiver);
      },

      has: (target, key) =>
        key in target || attr.has(toAttrKey(key)),

      ownKeys: target =>
        [ ...Reflect.ownKeys(target), ...attr.keys() ],

      set: (target, key, value, receiver) => {
        const attrKey = toAttrKey(key);

        if (attrKey) {
          attr.set(attrKey, value);
          return true;
        }

        return Reflect.set(target, key, value, receiver);
      }
    });

    return proxy;
  }

  get definition() {
    return this.name && this.doctype && this.doctype.getElement(this.name);
  }

  get id() {
    const elemDecl = this.definition;

    if (elemDecl) {
      const attDef = [ ...elemDecl.getAttDefs().values() ]
        .find(def => def.type === 'ID');

      if (attDef) {
        return this.getAttribute(attDef.name);
      }
    }
  }

  set id(value) {
    const elemDecl = this.definition;

    if (elemDecl) {
      const attDef = [ ...elemDecl.getAttDefs().values() ]
        .find(def => def.type === 'ID');

      if (attDef) {
        this.setAttribute(attDef.name, value);
        return;
      }
    }
  }

  get notation() {
    const elemDecl = this.definition;

    if (elemDecl) {
      const attDef = [ ...elemDecl.getAttDefs().values() ]
        .find(def => def.type === 'NOTATION');

      if (attDef) {
        const name = this.getAttribute(attDef.name);

        if (attDef.enumeration.has(name)) {
          return this.doctype.getNotation(name);
        }
      }
    }
  }

  get typeName() {
    return '#element';
  }

  clone() {
    const clone = super.clone();

    for (const attr of this.allAttributes()) {
      clone.setAttribute(...attr);
    }

    return clone;
  }

  getAttribute(key) {
    return this[`$${ key }`];
  }

  getReference(key) {
    const elemDecl = this.definition;
    const attDef   = elemDecl && elemDecl.getAttDef(key);
    const value    = this.getAttribute(key);

    if (!attDef || !value || !isString(value) || !isName(value)) {
      return;
    }

    if (attDef.type === 'ENTITY') {
      const entity = this.doctype.getEntity(value);

      if (entity.type === 'UNPARSED') {
        return entity;
      }
    }

    if (attDef.type === 'IDREF') {
      return this.document.findDeepByID(value);
    }

    if (attDef.type === 'NOTATION') {
      return this.doctype.getNotation(value);
    }
  }

  getReferences(key) {
    const elemDecl = this.definition;
    const attDef   = elemDecl && elemDecl.getAttDef(key);
    const value    = this.getAttribute(key);

    if (!attDef || !value || !isString(value)) {
      return [];
    }

    const names = value.split(/[\n\r\t ]+/g);

    if (!names.every(isName) || new Set(names).size !== names.length) {
      return [];
    }

    if (attDef.type === 'ENTITIES') {
      const entities = names.map(name => this.doctype.getEntity(name));

      if (entities.every(entity => entity && entity.type === 'UNPARSED')) {
        return entities;
      }
    }

    if (attDef.type === 'IDREFS') {
      const elems = names.map(name => this.document.findDeepByID(name));

      if (elems.every(Boolean)) {
        return elems;
      }
    }

    return [];
  }

  getTokenSet(key) {
    const elemDecl = this.definition;
    const attDef   = elemDecl && elemDecl.getAttDef(key);
    const value    = this.getAttribute(key);

    if (!attDef || !value || !isString(value)) {
      return [];
    }

    if ([ 'ENTITIES', 'IDREFS', 'NMTOKENS' ].includes(attDef.type)) {
      const tokensArr = value.split(/[\n\r\t ]+/g);
      const tokensSet = new Set(tokensArr);

      if (tokensArr.every(isNmtoken) && tokensSet.size === tokensArr.length) {
        return tokensSet;
      }
    }

    return [];
  }

  hasAttribute(key) {
    return `$${ key }` in this;
  }

  resetAttribute(key) {
    const elemDecl = this.definition;
    const attDef   = elemDecl && elemDecl.getAttDef(key);

    if (attDef) {
      this.setAttribute(key, attDef.defaultValue);
    }
  }

  _serialize(opts) {
    // This is the most complex serialization method, mostly because we’ve made
    // it quite customizable, but also because element declarations may
    // influence change the semantics of interior whitespace.

    const prefix =
      `${ indent(opts) }<${ this.name }`;

    const isEmpty =
      (this.definition || {}).contentSpec === 'EMPTY';

    const hasCDATA =
      (this.definition || {}).mixed ||
      this.some(node => node instanceof CDATA);

    const attrs =
      [ ...this.allAttributes() ];

    const unrendered = [
      !opts.comments && Comment,
      !opts.pis      && ProcessingInstruction
    ].filter(Boolean);

    const childOpts = Object.assign(Object.create(opts), {
      depth: opts.depth + 1
    });

    // Note that when the element is mixed but we’re not formatting CDATA
    // (either due to user option or the xml:space attribute), the effect
    // prevents positional formatting of element children as well, since adding
    // indentation or linebreaks would represent alteration of CDATA content.

    switch (this.getAttribute('xml:space')) {
      case 'default':
        childOpts.formatCDATA = opts._formatCDATA;
        break;
      case 'preserve':
        childOpts.formatCDATA = false;
        break;
    }

    let contentJoin = '\n';
    let terminus = `\n${ indent(opts) }</${ this.name }>`;

    const changeNothing = hasCDATA && !childOpts.formatCDATA;

    if (changeNothing) {
      opts.depth = 0;
      contentJoin = '';
      terminus = `</${ this.name }>`;
    }

    const content = this
      .filter(node => unrendered.every(Node => !(node instanceof Node)))
      .map(node => node._serialize(childOpts))
      .join(contentJoin);

    // 1st case: no attributes, no contents

    if (!attrs.length && !content) {
      if (opts.selfClose) {
        return `${ prefix }/>`;
      }

      const len = prefix.length + this.name.length + 3;

      if (isEmpty || len <= opts.wrapColumn || changeNothing) {
        return `${ prefix }></${ this.name }>`;
      }

      return `${ prefix }>\n${ indent(opts) }</${ this.name }>`;
    }

    // 2nd case: no attributes; contents

    if (!attrs.length) {
      `${ prefix }>${ contentJoin }${ content }${ terminus }`;
    }

    // Attributes in the mix...

    let prefixWithAttrs;

    if (opts.attrSort) {
      attrs.sort(([ a ], [ b ]) => compareAlpha(a, b));
    }

    const attrStrs = attrs
      .map(([ key, value ]) => `${ key }=${ quote(value, opts) }`);

    if (attrStrs.length <= opts.attrInlineMax) {
      const inlineAttrs = attrStrs.map(attrStr => ` ${ attrStr }`).join('');

      const len =
        prefix.length +
        inlineAttrs.length +
        Boolean(content || !opts.selfClose);

      if (len <= opts.wrapColumn) {
        prefixWithAttrs = `${ prefix }${ inlineAttrs }`;
      }
    }

    if (!prefixWithAttrs) {
      prefixWithAttrs = prefix + attrStrs
        .map(attrStr => `\n${ indent(childOpts) }${ attrStr }`)
        .join('');
    }

    // 3rd case: attributes and no content

    if (!content) {
      return opts.selfClose
        ? `${ prefixWithAttrs }/>`
        : `${ prefixWithAttrs }>${ terminus }`;
    }

    // 4th case: attributes and content

    return `${ prefixWithAttrs }>${ contentJoin }${ content }${ terminus }`;
  }

  setAttribute(key, value) {
    this[`$${ key }`] = value;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      attr: [ ...this.allAttributes() ]
        .reduce((acc, [ key, value ]) =>
          Object.assign(acc, { [key]: value }),
          {}
        ),
      name: this.name
    });
  }

  validate() {
    assert(isString(this.name), text.isString('Element name'));
    assert(isName(this.name),   text.isString('Element name'));

    for (const node of this) {
      const isValidChild = VALID_CHILDREN.some(Node => node instanceof Node);
      assert(isValidChild, text.validChild('Element', node));
    }

    if (this.doctype) {
      const elemDecl = this.doctype.getElement(this.name);

      assert(elemDecl, text.declared(`Element "${ this.name }"`));
      assert(elemDecl.matchesContent(this), text.matchesContent);

      const attDefs = elemDecl.getAttDefs();

      for (const [ key, value ] of this.allAttributes()) {
        assert(attDefs.has(key),   text.declared(`Attribute "${ key }"`));
        assert(isString(value),    text.isString('Attribute value'));
        assert(isXMLString(value), text.invalidChar('Attribute value'));
      }

      for (const [ key, attDef ] of attDefs) {
        assert(
          attDef.matchesValue(this.getAttribute(key)),
          text.conformsToAttDef
        );
      }
    }

    super.validate();
  }
}

const VALID_CHILDREN = [
  CDATA,
  Comment,
  Element,
  ProcessingInstruction
];
