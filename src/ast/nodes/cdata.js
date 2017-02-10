import assert  from 'assert';
import ASTNode from '../ast-node';
import text    from '../text';

import {
  escapeCDATA, isBoolean, isString, isXMLString, noSectionTerminus
} from '../ast-util';

export default
class CDATA extends ASTNode {
  constructor({ section=false, text }={}) {
    super();
    this.section = section;
    this.text    = text;
  }

  static get isArrayNode() {
    return false;
  }

  get isContent() {
    return true;
  }

  get typeName() {
    return '#text';
  }

  serialize() {
    if (this.section) {
      return `<![CDATA[${ this.text }]]>`;
    }

    return escapeCDATA(this.text || '');
  }

  toJSON() {
    return Object.assign(super.toJSON(), { text: this.text });
  }

  validate() {
    assert(isString(this.text),        text.isString('CDATA text'));
    assert(isBoolean(this.section),    text.isBoolean('CDATA section'));
    assert(!this.section || this.text, text.cdataHasLength);
    assert(isXMLString(this.text),     text.invalidChar('CDATA text'));

    if (this.section) {
      assert(noSectionTerminus(this.text), text.noSectionTerminus);
    }
  }
}
