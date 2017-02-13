import assert         from 'assert';
import ASTNode        from '../ast-node';
import ExternalSubset from './doctype-external';
import text           from '../text';

import {
  isCodepoints,
  isString,
  isName,
  isPublicID,
  isXMLString,
  oneQuoteOnly,
  serializeExternalID
} from '../ast-util';

const TYPES = new Set([ 'GENERAL', 'PARAMETER', 'UNPARSED' ]);

export default
class EntityDeclaration extends ASTNode {
  constructor(opts={}) {
    const { name, notationName, path, publicID, systemID, type, value } = opts;

    super();

    this.name         = name;
    this.notationName = notationName;
    this.path         = path;
    this.publicID     = publicID;
    this.systemID     = systemID;
    this.type         = type;
    this.value        = value;
  }

  static get isArrayNode() {
    return false;
  }

  get hasExternalOrigin() {
    return Boolean(this.systemID || this.parent instanceof ExternalSubset);
  }

  get notation() {
    return this.doctype && this.doctype.getNotation(this.notationName);
  }

  get typeName() {
    return '#entityDecl';
  }

  serialize() {
    const { name, notationName, publicID, systemID, type, value } = this;

    const symbol =
      type === 'PARAMETER' &&
      '%';

    const externalID =
      systemID &&
      serializeExternalID({ publicID, systemID });

    const valueLit =
      !externalID.length &&
      `"${ String.fromCodePoints(value) }"`;

    const ndata =
      notationName && `NDATA ${ notationName }`;

    return `<!ENTITY ${
      [ symbol, name, externalID, valueLit, ndata ].filter(Boolean).join(' ')
    }>`;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      name:         this.name,
      notationName: this.notationName,
      publicID:     this.publicID,
      systemID:     this.systemID,
      type:         this.type,
      value:        !this.systemID && String.fromCodePoints(...this.value)
    });
  }

  validate() {
    const {
      doctype,
      document,
      index,
      name,
      notation,
      notationName,
      publicID,
      systemID,
      type,
      value
    } = this;

    assert(document,       text.requireDoc('Entity declaration'));
    assert(doctype,        text.requireDTD('Entity declaration'));
    assert(isString(name), text.isString('Entity name'));
    assert(isName(name),   text.isName('Entity name'));

    if (publicID) {
      assert(isString(publicID),   text.isString('Entity public ID'));
      assert(isPublicID(publicID), text.isPublicID('Entity'));
      assert(systemID,             text.alsoSystem('Entity'));
    }

    if (systemID) {
      assert(isString(systemID),     text.isString('Entity system ID'));
      assert(isXMLString(systemID),  text.invalidChar('Entity system ID'));
      assert(oneQuoteOnly(systemID), text.systemQuotes('Entity'));
    }

    assert(TYPES.has(type),               text.entityType);
    assert(value || systemID,             text.entityIntOrExt);
    assert(!value || isCodepoints(value), text.entityValue);

    assert((type !== 'UNPARSED') === !notationName, text.entityNotationType);

    if (notationName) {
      assert(systemID,               text.entityNotationID);
      assert(notation,               text.notationDecl('Unparsed entity'));
      assert(notation.index < index, text.notationDecl('Unparsed entity'));
    }
  }
}
