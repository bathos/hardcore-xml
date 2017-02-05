import assert                from 'assert';
import ASTNode               from '../ast-node';
import Comment               from './comment';
import Doctype               from './doctype';
import Element               from './element';
import ProcessingInstruction from './processing-instruction';
import text                  from '../text';

import { isBoolean } from '../ast-util';

const VALID_CHILDREN = [
  Comment,
  Doctype,
  Element,
  ProcessingInstruction
];

export default
class Document extends ASTNode {
  constructor({ standalone=false }={}) {
    super();

    this.standalone = standalone;
  }

  get doctype() {
    return this.find(node => node instanceof Doctype);
  }

  set doctype(doctype) {
    assert(doctype instanceof Doctype, 'Doctype must be a Doctype.');

    if (this.doctype) {
      this.splice(this.indexOf(this.doctype), 1, doctype);
    } else if (this.element) {
      this.splice(this.indexOf(this.element), 0, doctype);
    } else {
      this.push(doctype);
    }
  }

  get document() {
    return this;
  }

  get root() {
    return this.find(node => node instanceof Element);
  }

  set root(elem) {
    assert(elem instanceof Element, 'Root must be an Element.');

    if (this.root) {
      this.splice(this.indexOf(this.root), 1, elem);
    } else {
      this.push(elem);
    }
  }

  get typeName() {
    return '#document';
  }

  findDeepByID(id) {
    return this.findDeep(node => node instanceof Element && node.id === id);
  }

  serialize() {
    const xmlDecl = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>`;
    return [ xmlDecl, ...super.serialize() ].join('\n');
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      standalone: this.standalone
    });
  }

  validate() {
    const { doctype, root, standalone } = this;
    const doctypeCount = this.filter(node => node instanceof Doctype).length;
    const elementCount = this.filter(node => node instanceof Element).length;

    assert(root,                  text.needsRoot);
    assert(elementCount === 1,    text.oneRoot);
    assert(doctypeCount <= 1,     text.oneDoctype);
    assert(isBoolean(standalone), text.isBoolean('Document standalone'));

    if (doctype) {
      assert(doctype.name === root.name, text.doctypeMatchesRoot);
      assert(doctype.index < root.index, text.doctypeFirst);
    }

    for (const node of this) {
      const isValidChild = VALID_CHILDREN.some(Node => node instanceof Node);
      assert(isValidChild, text.validChild('Document', node.constructor.name));
    }

    super.validate();
  }
}
