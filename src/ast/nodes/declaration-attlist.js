import assert            from 'assert';
import ASTNode           from '../ast-node';
import AttdefDeclaration from './declaration-attdef';
import text              from '../text';

import { compareAlpha, indent, isName, isString } from '../ast-util';

export default
class AttlistDeclaration extends ASTNode {
  constructor({ elementName }={}) {
    super();

    this.elementName = elementName;
  }

  get element() {
    return (
      this.elementName &&
      this.doctype &&
      this.doctype.getElement(this.elementName)
    );
  }

  get typeName() {
    return '#attlistDecl';
  }

  _serialize(opts) {
    const prefix = `${ indent(opts) }<!ATTLIST ${ this.elementName }`;

    if (!this.length) {
      return `${ prefix }>`;
    }

    const childOpts = Object.assign(Object.create(opts), {
      depth: opts.depth + 1
    });

    if (opts.attdefLone) {
      childOpts.depth = 0;
      return `${ prefix } ${ this[0]._serialize(childOpts) }>`;
    }

    const attdefs = opts.attrSort
      ? [ ...this ].sort(({ name: a }, { name: b }) => compareAlpha(a, b))
      : this;

    return `${ prefix }\n${
      attdefs.map(node => node._serialize(childOpts)).join('\n')
    }>`;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      elementName: this.elementName
    });
  }

  validate() {
    assert(this.elementName,           text.attlistNeedsElement);
    assert(isString(this.elementName), text.isString('Attlist element name'));
    assert(isName(this.elementName),   text.isName('Attlist element name'));

    // Note: it is not an error if the name does not match a declared element.
    // AFAICT, it is also not required that an element declaration precede the
    // attlist declaration for an attlist to ‘stick’(?)

    for (const node of this) {
      const isValidChild = node instanceof AttdefDeclaration;
      assert(isValidChild, text.validChild('Attlist', node));
    }

    super.validate();
  }
}
