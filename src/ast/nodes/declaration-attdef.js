import assert  from 'assert';
import ASTNode from '../ast-node';
import text    from '../text';

import { isName, isNmtoken, isSetOf, isString } from '../ast-util';

const NUM_TYPES = new Set([
  'ENUMERATION', 'NOTATION'
]);

const REF_TYPES = new Set([
  'ENTITY', 'ENTITIES', 'IDREF', 'IDREFS', 'NOTATION'
]);

const TOK_TYPES = new Set([
  ...REF_TYPES, 'ENUMERATION', 'ID', 'NMTOKEN', 'NMTOKENS'
]);

const MUL_TYPES = new Set([
  'ENTITIES', 'IDREFS', 'NMTOKENS'
]);

const NAM_TYPES = new Set([
  ...REF_TYPES, 'ID'
]);

const ALL_TYPES = new Set([
  ...TOK_TYPES, 'CDATA'
]);

export default
class AttdefDeclaration extends ASTNode {
  constructor({ defaultValue, enumeration, fixed, name, required, type }={}) {
    super();

    this.defaultValue = defaultValue;
    this.enumeration  = enumeration;
    this.fixed        = fixed;
    this.name         = name;
    this.required     = required;
    this.type         = type;
  }

  static get isArrayNode() {
    return false;
  }

  get element() {
    return this.parent && this.parent.element;
  }

  get isReference() {
    return REF_TYPES.has(this.type);
  }

  get isTokenized() {
    return TOK_TYPES.has(this.type);
  }

  get typeName() {
    return '#attdef';
  }

  matchesValue(value) {
    try {
      this.validate();
    } catch (err) {
      return false;
    }

    if (this.fixed && value !== this.defaultValue) {
      return false;
    }

    if (value === undefined) {
      return !this.required && !this.fixed;
    }

    if (!isString(value)) {
      return false;
    }

    switch (this.type) {
      case 'CDATA':
        return true;

      case 'NOTATION':
        if (!this.doctype.getNotation(value)) {
          return false;
        }
      case 'ENUMERATION':
        return this.enumeration.has(value);

      case 'ID':
        return isName(value) && this.document.findDeepByID(value) === this;

      case 'IDREF':
        return isName(value) && Boolean(this.document.findDeepByID(value));

      case 'ENTITY':
        return (
          isName(value) &&
          (this.doctype.getEntity(value) || {}).type === 'UNPARSED'
        );

      case 'NMTOKEN':
        return isNmtoken(value);
    }

    const tokens = value.split(/ /g);

    if (new Set(tokens).size !== tokens.length) {
      return false;
    }

    switch (this.type) {
      case 'IDREFS':
        return tokens.every(isName) && tokens.every(name =>
          this.document.findDeepByID(name)
        );
      case 'ENTITIES':
        return tokens.every(isName) && tokens.every(name =>
          (this.doctype.getEntity(name) || {}).type === 'UNPARSED'
        );
      case 'NMTOKENS':
        return tokens.every(isNmtoken);
    }
  }

  serialize() {
    // TODO: wait on this, it’s complicated if we want to format these sanely
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      defaultValue: this.defaultValue,
      enumeration:  this.enumeration,
      fixed:        this.fixed,
      name:         this.name,
      required:     this.required,
      type:         this.type
    });
  }

  validate() {
    const {
      defaultValue,
      doctype,
      element,
      enumeration,
      fixed,
      name,
      required,
      type
    } = this;

    assert(doctype,             text.requireDTD('Element declaration'));
    assert(isString(name),      text.isString('Attdef key'));
    assert(isName(name),        text.isName('Attdef key'));
    assert(ALL_TYPES.has(type), text.attDefType);

    if (defaultValue !== undefined) {
      assert(isString(defaultValue), text.isString('Attdef default value'));
    }

    assert(!fixed || defaultValue,     text.fixedNeedsDefault);
    assert(!required || !defaultValue, text.requiredNoDefault);

    if (type === 'CDATA') {
      return;
    }

    if (type === 'ID') {
      if (element) {
        const idDef = element
          .getAttDefs()
          .find(([ , attdef ]) => attdef.type === 'ID');

        assert(idDef === this, text.attDefDupe('ID'));
      }

      assert(!defaultValue && !fixed, text.idNoDefault);

      return;
    }

    if (type === 'NOTATION' && element) {
      const notationDef = element
        .getAttDefs()
        .find(([ , attdef ]) => attdef.type === 'NOTATION');

      assert(notationDef === this, text.attDefDupe('NOTATION'));
      assert(element.contentSpec !== 'EMPTY', text.noNotationEmpty);
    }

    const pred = NAM_TYPES.has(type) ? isName : isNmtoken;

    const dvArr = defaultValue ? defaultValue.split(/ /g) : [];

    assert(dvArr.every(pred), text.defaultValMatch);

    if (MUL_TYPES.has(type)) {
      assert(!defaultValue || dvArr.length, text.defaultValMatch);
    } else {
      assert(!defaultValue || dvArr.length === 1, text.defaultValMatch);
    }

    if (NUM_TYPES.has(type)) {
      assert(isSetOf(enumeration, pred), text.validEnum(type));
      assert(enumeration.size,           text.validEnum(type));

      if (defaultValue) {
        assert(enumeration.has(defaultValue), text.defaultValMatch);
      }
    } else {
      assert(enumeration === undefined, text.notEnumType(type));
    }
  }
}
