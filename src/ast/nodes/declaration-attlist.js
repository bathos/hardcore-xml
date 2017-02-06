import assert            from 'assert';
import ASTNode           from '../ast-node';
import AttdefDeclaration from './declaration-attdef';
import text              from '../text';

import { isName, isString } from '../ast-util';

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

  serialize() {
    const attdefs = super.serialize();

    if (attdefs.length === 1) {
      return `<!ATTLIST ${ this.elementName } ${ attdefs[0] }>`;
    }

    return `<!ATTLIST ${ this.elementName }\n${
      attdefs.map(attDef => `  ${ attDef }`).join('\n')
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
