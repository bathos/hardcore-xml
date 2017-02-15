import assert  from 'assert';
import ASTNode from '../ast-node';
import text    from '../text';

import {
  indent, isName, isNmtoken, isSetOf, isString, quote
} from '../ast-util';

import padEnd from 'string.prototype.padend'; // Node 7 still lacks w/o flag

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

  get _attTypeCol() {
    return NUM_TYPES.has(this.type) ? 0 : this.type.length;
  }

  get _defaultTypeCol() {
    return (
      this.fixed        ? 6 :
      this.required     ? 9 :
      this.defaultValue ? 0 :
                          8
    );
  }

  get element() {
    return this.parent && this.parent.element;
  }

  get hasDefault() {
    return !this.required && !this.fixed && this.defaultValue !== undefined;
  }

  get isList() {
    return MUL_TYPES.has(this.type);
  }

  get isName() {
    return NAM_TYPES.has(this.type);
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

    if (!this.matchesValueGrammatically(value)) {
      return false;
    }

    if (this.type === 'NOTATION') {
      return Boolean(this.doctype.getNotation(value));
    }

    if (this.type === 'ID') {
      return this.document.filterDeep(node => node.id === value).length === 1;
    }

    const values = value.split(/ /g);

    if (this.type.startsWith('IDREF')) {
      return values.every(value => this.document.findDeepByID(value));
    }

    if (this.type.startsWith('ENTIT')) {
      return values
        .map(value => this.doctype.getEntity(value))
        .every(entity => entity && entity.type === 'UNPARSED');
    }

    return true;
  }

  matchesValueGrammatically(value) {
    if (this.type === 'CDATA') {
      return true;
    }

    const values = value.split(/ /g);

    if (!values.length) {
      return true;
    }

    if (new Set(values).size !== values.length) {
      return false;
    }

    if (!this.isList && values.length > 1) {
      return false;
    }

    if (this.enumeration) {
      return values.every(value => this.enumeration.has(value));
    }

    if (this.isName) {
      return values.every(isName);
    }

    return values.every(isNmtoken);
  }

  _serialize(opts) {
    const numz =
      this.enumeration && `(${ [ ...this.enumeration ].join('|') })`;

    const name =
      this.name;

    const type =
      this.type === 'NOTATION' ? `NOTATION ${ numz }` : (numz || this.type);

    const defaultType =
      this.fixed        ? `#FIXED` :
      this.required     ? `#REQUIRED` :
      this.defaultValue ? `` :
                          `#IMPLIED`;

    const defaultValue =
      this.defaultValue && quote(this.defaultValue, opts);

    if (opts.attdefLone) {
      const defaultTypeFull = [ defaultType, defaultValue ]
        .filter(Boolean)
        .join(' ');

      return `${ indent(opts) }${ name } ${ type } ${ defaultTypeFull }`;
    }

    const { value } = [ name, type, defaultType ]
      .reduce((acc, value, index) => {
        const targetWidth = opts.attdefCols[index];

        if (value.length > targetWidth) {
          acc.value += ` ${ value }`;
          acc.offset += targetWidth - value.length;
        } else {
          const padWidth = targetWidth - acc.offset;
          const paddedValue = padEnd(value, padWidth);

          acc.value += ` ${ paddedValue }`;
          acc.offset = Math.max(0, paddedValue.length - padWidth);
        }

        return acc;
      }, { value: '', offset: 0 });

    if (defaultValue) {
      return `${ indent(opts) }${ value.slice(1) } ${ defaultValue }`;
    }

    return `${ indent(opts) }${ value.trimRight().slice(1) }`;
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
        const [ , idDef ] = [ ...element.getAttDefs() ]
          .find(([ , attdef ]) => attdef.type === 'ID');

        assert(idDef === this, text.attDefDupe('ID'));
      }

      assert(!defaultValue && !fixed, text.idNoDefault);

      return;
    }

    if (type === 'NOTATION' && element) {
      const [ , notationDef ] = [ ...element.getAttDefs() ]
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
