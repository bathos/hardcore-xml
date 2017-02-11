const CHILD_PARENT_MAPPING = new WeakMap();

const MAX_INDEX = 2 ** 32 - 2;

const isArrayIndex = key =>
  typeof key === 'string' &&
  key >= 0 &&
  String(Number.parseInt(key)) === key &&
  key < MAX_INDEX;

export default
class ASTNode extends Array {
  constructor() {
    super();

    const nonArrayShadow = {};

    const proxy = new Proxy(this, {
      get: (target, key, receiver) => {
        if (isArrayIndex(key) && !this.constructor.isArrayNode) {
          return Reflect.get(nonArrayShadow, key);
        }

        return Reflect.get(target, key, receiver);
      },
      ownKeys: target => {
        const keys = Reflect.ownKeys(target);

        if (!this.constructor.isArrayIndex) {
          return [ ...keys, ...Reflect.ownKeys(nonArrayShadow) ];
        }

        return keys;
      },
      set: (target, key, value, receiver) => {
        if (receiver[key] === value) {
          return true;
        }

        const isIndex = isArrayIndex(key);

        if (!isIndex && !this.constructor.childKeys().has(key)) {
          return Reflect.set(target, key, value, receiver);
        }

        if (isIndex && !this.constructor.isArrayNode) {
          Reflect.set(nonArrayShadow, key, value);
        }

        if (receiver[key] instanceof ASTNode) {
          const formerChild = receiver[key];
          CHILD_PARENT_MAPPING.delete(formerChild);
        }

        if (value instanceof ASTNode) {
          if (CHILD_PARENT_MAPPING.has(value)) {
            const { key, parent } = CHILD_PARENT_MAPPING.get(value);

            if (parent !== receiver) {
              value.remove();
            } else {
              parent[key] = undefined;
            }
          }

          CHILD_PARENT_MAPPING.set(value, { isIndex, key, parent: receiver });
        }

        const res = Reflect.set(target, key, value, receiver);

        while (this.includes(undefined)) {
          this.splice(this.indexOf(undefined), 1);
        }

        return res;
      }
    });

    // Additionally, splice() demands special handling because it is ‘atomic’;
    // enforcing sparseness after each assignment could make it go wonky. We
    // simply remove fill() since it will never make sense here.

    const target = this;

    Object.defineProperties(proxy, {
      fill: {
        value: undefined
      },
      splice: {
        value(index, count) {
          if (this !== proxy) {
            return Reflect.apply(Array.prototype.splice, this, arguments);
          }

          const oldMembers = target.slice(index, index + count);
          const sentinel   = Symbol();

          oldMembers
            .filter(oldMember => oldMember instanceof ASTNode)
            .forEach(oldMember => {
              const { key } = CHILD_PARENT_MAPPING.get(oldMember);
              CHILD_PARENT_MAPPING.delete(oldMember);
              target[key] = sentinel;
            });

          Reflect.apply(Array.prototype.splice, proxy, arguments);

          while (target.includes(sentinel)) {
            target.splice(target.indexOf(sentinel), 1);
          }

          return oldMembers;
        }
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

  // The typeName property provides an alternative way to introspect node type
  // without using instanceof.

  get typeName() {
    throw new Error('Not implemented');
  }

  get [Symbol.species]() {
    return Array;
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

  serialize() {
    return this.map(node => node.serialize());
  }

  toJSON() {
    const nodeType = this.constructor.typeName;
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
