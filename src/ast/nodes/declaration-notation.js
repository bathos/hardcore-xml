import assert  from 'assert';
import ASTNode from '../ast-node';
import text    from '../text';

import {
  isName,
  isPublicID,
  isString,
  isXMLString,
  oneQuoteOnly,
  serializeExternalID
} from '../ast-util';

export default
class NotationDeclaration extends ASTNode {
  constructor({ name, publicID, systemID }={}) {
    super();

    this.name     = name;
    this.publicID = publicID;
    this.systemID = systemID;
  }

  static get isArrayNode() {
    return false;
  }

  get typeName() {
    return '#notationDecl';
  }

  serialize() {
    return `<!NOTATION ${ this.name } ${ serializeExternalID(this) }>`;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      name:     this.name,
      publicID: this.publicID,
      systemID: this.systemID
    });
  }

  validate() {
    const {
      doctype,
      document,
      name,
      publicID,
      systemID
    } = this;

    assert(document,       text.requireDoc('Notation declaration'));
    assert(doctype,        text.requireDTD('Notation declaration'));
    assert(isString(name), text.isString('Notation name'));
    assert(isName(name),   text.isName('Notation name'));

    if (publicID) {
      assert(isString(publicID),   text.isString('Notation public ID'));
      assert(isPublicID(publicID), text.isPublicID('Notation'));
    }

    if (systemID) {
      assert(isString(systemID),     text.isString('Notation system ID'));
      assert(isXMLString(systemID),  text.invalidChar('Notation system ID'));
      assert(oneQuoteOnly(systemID), text.systemQuotes('Notation'));
    }

    const notation = doctype.getNotation(name);
    assert(notation === this, text.redeclared('Notation', name));
  }
}
