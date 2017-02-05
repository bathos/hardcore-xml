import assert  from 'assert';
import ASTNode from '../ast-node';
import text    from '../text';

import { escapeCDATA, isString, isXMLString } from '../ast-util';

export default
class CDATA extends ASTNode {
  constructor({ text }={}) {
    super();
    this.text = text; // String (char+)
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
    return escapeCDATA(this.text || '');
  }

  toJSON() {
    return Object.assign(super.toJSON(), { text: this.text });
  }

  validate() {
    assert(isString(this.text),    text.isString('CDATA text'));
    assert(this.text,              text.cdataHasLength);
    assert(isXMLString(this.text), text.invalidChar('CDATA text'));
  }
}
