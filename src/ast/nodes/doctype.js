import assert                from 'assert';
import ASTNode               from '../ast-node';
import AttlistDeclaration    from './declaration-attlist';
import Comment               from './comment';
import ElementDeclaration    from './declaration-element';
import EntityDeclaration     from './declaration-entity';
import ExternalSubset        from './doctype-external';
import NotationDeclaration   from './declaration-notation';
import ProcessingInstruction from './processing-instruction';
import text                  from '../text';

import {
  extID,
  indent,
  isName,
  isPublicID,
  isString,
  isXMLString,
  oneQuoteOnly
} from '../ast-util';

const VALID_CHILDREN = [
  AttlistDeclaration,
  Comment,
  ElementDeclaration,
  EntityDeclaration,
  NotationDeclaration,
  ProcessingInstruction
];

export default
class DoctypeDeclaration extends ASTNode {
  constructor({ external, name, publicID, systemID }={}) {
    super();

    this.name     = name;
    this.publicID = publicID;
    this.systemID = systemID;

    this.external =
      external instanceof ExternalSubset && external.parent
        ? external.clone()
        : external;
  }

  static childKeys() {
    return new Set([ 'external' ]);
  }

  get doctype() {
    return this;
  }

  get typeName() {
    return '#doctypeDecl';
  }

  getAll() {
    return [ ...this, ...this.external || [] ];
  }

  getElement(name) {
    return this.getAll().find(node =>
      node instanceof ElementDeclaration &&
      node.name === name
    );
  }

  getEntity(name) {
    return this.getAll().find(node =>
      node instanceof EntityDeclaration &&
      node.name === name
    );
  }

  getNotation(name) {
    return this.getAll().find(node =>
      node instanceof NotationDeclaration &&
      node.name === name
    );
  }

  _serialize(opts) {
    const unrendered = [
      !opts.comments && Comment,
      !opts.pis      && ProcessingInstruction
    ].filter(Boolean);

    const childOpts = Object.assign(Object.create(opts), {
      depth: opts.depth + 1
    });

    const childStrings = this
      .filter(node => unrendered.every(Node => !(node instanceof Node)))
      .map(node => node._serialize(childOpts));

    const prefix = `${ indent(opts) }<!DOCTYPE ${ this.name }`;
    const externalID = this.systemID ? ` ${ extID(this, opts) }` : '';
    const suffix = childStrings.length
      ? ` [\n${ childStrings.join('\n') }\n${ indent(opts) }]>`
      : '>';

    return `${ prefix }${ externalID }${ suffix }`;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      external: this.external && this.external.toJSON(),
      name:     this.name,
      publicID: this.publicID,
      systemID: this.systemID
    });
  }

  validate() {
    const { external, name, publicID, systemID } = this;

    assert(isName(name), text.isName('Doctype declaration name'));

    if (publicID) {
      assert(isString(publicID),   text.isString('Notation public ID'));
      assert(isPublicID(publicID), text.isPublicID('Notation'));
      assert(systemID,             text.alsoSystem('Doctype'));
    }

    if (systemID) {
      assert(isString(systemID),     text.isString('Notation system ID'));
      assert(isXMLString(systemID),  text.invalidChar('Notation system ID'));
      assert(oneQuoteOnly(systemID), text.systemQuotes('Notation'));
    }

    for (const node of this) {
      const isValidChild = VALID_CHILDREN.some(Node => node instanceof Node);
      assert(isValidChild, text.validChild('Doctype', node));
    }

    super.validate();

    if (external !== undefined) {
      assert(external instanceof ExternalSubset, text.externalSubset);
      external.validate();
    }
  }
}
