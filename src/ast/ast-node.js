const CHILD_PARENT_MAPPING = new WeakMap();

import { isArrayIndex } from './ast-util';

const SERIALIZATION_DEFAULTS = {
  attrInlineMax: 1,
  attrSort:      true,
  comments:      true,
  depth:         0,
  dtd:           true,
  formatCDATA:   true,
  formatComment: true,
  indent:        2,
  minWidth:      30,
  pis:           true,
  preferSingle:  false,
  selfClose:     true,
  wrapColumn:    80,
  xmlDecl:       true
};

export default
class ASTNode extends Array {
  constructor() {
    super();

    const nonArray       = !this.constructor.isArrayNode;
    const nonArrayShadow = {};
    const childKeys      = this.constructor.childKeys();

    const compact = () => {
      while (this.includes(undefined)) {
        this.splice(this.findIndex(member => member === undefined), 1);
      }
    };

    const isChildKey = key =>
      (!nonArray && isArrayIndex(key)) || childKeys.has(key);

    const proxy = new Proxy(this, {
      deleteProperty: (target, key) => {
        if (isChildKey(key)) {
          CHILD_PARENT_MAPPING.delete(target[key]);
        }

        Reflect.deleteProperty(target, key);
        compact();
        return true;
      },

      get: (target, key, receiver) => {
        if (nonArray && isArrayIndex(key)) {
          return Reflect.get(nonArrayShadow, key);
        }

        if (nonArray && key === 'length') {
          return 0;
        }

        return Reflect.get(target, key, receiver);
      },

      has: (target, key) =>
        Reflect.has(target, key) || Reflect.has(nonArrayShadow, key),

      ownKeys: target => {
        const keys = Reflect.ownKeys(target);

        if (nonArray) {
          return [ ...keys, ...Reflect.ownKeys(nonArrayShadow) ];
        }

        return keys;
      },

      set: (target, key, value, receiver) => {
        if (receiver[key] === value) {
          return true;
        }

        if (key === 'length') {
          if (nonArray || value > target.length) {
            return true;
          }

          target
            .slice(value)
            .forEach(node => CHILD_PARENT_MAPPING.delete(node));

          return Reflect.set(target, key, value, receiver);
        }

        const isIndex = isArrayIndex(key);

        if (!isIndex && !childKeys.has(key)) {
          return Reflect.set(target, key, value, receiver);
        }

        if (isIndex && nonArray) {
          return Reflect.set(nonArrayShadow, key, value);
        }

        CHILD_PARENT_MAPPING.delete(receiver[key]);

        if (value instanceof ASTNode) {
          if (CHILD_PARENT_MAPPING.has(value)) {
            const { key, parent } = CHILD_PARENT_MAPPING.get(value);

            if (parent !== receiver) {
              value.remove();
            } else {
              this[key] = undefined;
            }
          }

          CHILD_PARENT_MAPPING.set(value, { isIndex, key, parent: receiver });
        }

        Reflect.set(target, key, value, receiver);

        compact();

        return true;
      }
    });

    return proxy;
  }

  // While ASTNode inherits from Array, ‘leaf’ nodes do not have indexed
  // children. To keep things simple, I wanted "instanceof ASTNode" to be
  // predictable and it is also helpful (e.g. for reducers) that methods like
  // "filter" can be expected to exist and not throw, regardless of node type.
  // This static property determines whether index keys are actually treated as
  // array keys — if it is false, assignment is still permitted, but it will not
  // actually add to membership or change the length, etc.

  static get isArrayNode() {
    return true;
  }

  // Another static property that influences the proxy layer’s behavior,
  // childKeys provides a means to declare which non-index keys are also to be
  // considered as part of a parent-child relationship on this node class.

  static childKeys() {
    return new Set();
  }

  static get [Symbol.species]() {
    return Array;
  }

  // The typeName property provides an alternative way to introspect node type
  // without using instanceof.

  get typeName() {
    throw new Error('Not implemented');
  }

  // Hierarchical accessors

  get index() {
    const { key, isIndex } = CHILD_PARENT_MAPPING.get(this) || {};
    return isIndex ? Number.parseInt(key) : -1;
  }

  get nextSibling() {
    const { key, isIndex, parent } = CHILD_PARENT_MAPPING.get(this);

    if (isIndex && key < (parent.length - 1)) {
      return parent[Number(key) + 1];
    }
  }

  get parent() {
    return (CHILD_PARENT_MAPPING.get(this) || {}).parent;
  }

  get prevSibling() {
    const { key, isIndex, parent } = CHILD_PARENT_MAPPING.get(this);

    if (isIndex && key > 0) {
      return parent[Number(key) - 1];
    }
  }

  // Special hierachical accessors.

  get doctype() {
    return (this.document || {}).doctype;
  }

  get document() {
    return this.parent && this.parent.document;
  }

  get root() {
    return (this.document || {}).root;
  }

  // Mutative (inserting) array method intercept

  push() {
    if (this.constructor.isArrayNode) {
      return super.push(...arguments);
    }
  }

  splice() {
    if (!this.constructor.isArrayNode) {
      return;
    }

    // Not efficient ... but not painful & mysterious. Maybe I will revisit this
    // later, but splice is really overloaded and we have a lot of behavior we
    // need to follow it (atomically).

    const newMembership = [ ...this ];
    const oldMembership = newMembership.splice(...arguments);

    this.length = 0;
    this.push(...newMembership);

    return oldMembership;
  }

  unshift() {
    if (this.constructor.isArrayNode) {
      return super.unshift(...arguments);
    }
  }

  // The clone() method creates a new (orphaned) node with the same properties
  // and children (also cloned). Note that an orphaned element has no definition
  // until it is reinserted into a document that has a DTD — thus validation
  // will always pass until it is reattached.

  clone() {
    const clone = new this.constructor(this);
    clone.push(...this.map(node => node.clone()));
  }

  // Variation on `find` that performs a depth-first search of descendents.

  findDeep(pred) {
    for (const node of this) {
      if (pred(node)) {
        return node;
      }

      const descendent = node.findDeep(pred);

      if (descendent) {
        return descendent;
      }
    }
  }

  // Variation on `filter` that performs a depth-first search of descendents.

  filterDeep(pred) {
    return this.reduce((acc, node) => {
      if (pred(node)) {
        acc.push(node);
      }

      return acc.concat(node.filterDeep(pred));
    }, []);
  }

  // The remove() method divorces this node from its current context in the
  // document hierarchy.

  remove() {
    if (CHILD_PARENT_MAPPING.has(this)) {
      const { key, isIndex, parent } = CHILD_PARENT_MAPPING.get(this);

      if (isIndex) {
        parent.splice(key, 1);
      } else {
        parent[key] = undefined;
      }

      CHILD_PARENT_MAPPING.delete(this);
    }

    return this;
  }

  // Transformation operations. These are augmented or overwritten in subclasses
  // for more specific behavior.

  serialize(opts={}) {
    const $opts = Object.assign({}, SERIALIZATION_DEFAULTS, opts);

    const dtd = this.doctype;

    if (dtd) {
      const attlists = dtd
        .getAll()
        .filter(node => node.typeName === '#attlistDecl');

      if (attlists.every(attlist => attlist.length < 2)) {
        $opts.attdefLone = true;
      } else {
        const attdefs = attlists
          .reduce((acc, node) => [ ...acc, ...node ], []);

        $opts.attdefCols = [
          Math.max(0, ...attdefs.map(attdef => attdef.name.length)),
          Math.max(0, ...attdefs.map(attdef => attdef._attTypeCol)),
          Math.max(0, ...attdefs.map(attdef => attdef._defaultTypeCol))
        ];
      }
    }

    opts._formatCDATA = opts.formatCDATA;

    return this._serialize($opts);
  }

  toJSON() {
    const nodeType = this.typeName;
    const children = this.map(node => node.toJSON());

    if (this.constructor.isArrayNode) {
      return { children, nodeType };
    }

    return { nodeType };
  }

  // The validate() method is implemented in subclasses to confirm
  // well-formedness and validity constraints. If it fails, it should throw.

  validate() {
    this.forEach(node => node.validate());
  }
}

ASTNode.prototype.copyWithin = undefined;
ASTNode.prototype.fill = undefined;
