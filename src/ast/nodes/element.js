import assert                from 'assert';
import ASTNode               from '../ast-node';
import CDATA                 from './cdata';
import Comment               from './comment';
import ProcessingInstruction from './processing-instruction';
import text                  from '../text';

import { isName, isNmtoken, isString, isXMLString } from '../ast-util';

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

        if (!(key in this)) {
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
        key in this || attr.has(key),

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
      const attDef = elemDecl.getAttDefs().find(def => def.type === 'ID');

      if (attDef) {
        return this.getAttribute(attDef.name);
      }
    }
  }

  set id(value) {
    const elemDecl = this.definition;

    if (elemDecl) {
      const attDef = elemDecl.getAttDefs().find(def => def.type === 'ID');

      if (attDef) {
        this.setAttribute(attDef.name, value);
        return;
      }
    }
  }

  get isContent() {
    return true;
  }

  get notation() {
    const elemDecl = this.definition;

    if (elemDecl) {
      const attDef = elemDecl.getAttDefs().find(def => def.type === 'NOTATION');

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

  setAttribute(key, value) {
    this[`$${ key }`] = value;
  }

  serialize() {
    // TODO — not worth doing till we land on what serialization options will be
    // since it’s more complex than the other ones.
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      attr: this
        .allAttributes()
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
