import assert         from 'assert';
import ASTNode        from '../ast-node';
import ExternalSubset from './doctype-external';
import text           from '../text';

import {
  extID,
  indent,
  isCodepoints,
  isString,
  isName,
  isPublicID,
  isXMLString,
  oneQuoteOnly,
  quote,
  refOut
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

  _serialize(opts) {
    const { name, notationName, systemID, type, value } = this;

    // If the entity is internal, the value needs to have certain codepoints
    // converted to character references. The result may not be identical to the
    // original input (parameter refs remain dereffed), but will yield the same
    // result. Specifically, '<', quotes, and percent signs are transformed to
    // char references, while '&' is transformed only if the next character is
    // '#' (implying that originally there was a double escape which must now be
    // restored).
    //
    // Note that any external entity which was used could be converted to an
    // internal entity just by removing the external ID properties.

    const symbol     = type === 'PARAMETER' && '%';
    const externalID = systemID && extID(this, opts);
    const valueEsc   = value && refOut(String.fromCodePoint(...value));
    const valueLit   = !externalID && quote(valueEsc, opts);
    const ndata      = notationName && `NDATA ${ notationName }`;

    return `${ indent(opts) }<!ENTITY ${
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
      value:        !this.systemID && String.fromCodePoint(...this.value)
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
