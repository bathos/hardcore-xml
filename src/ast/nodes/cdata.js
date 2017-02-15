import assert  from 'assert';
import ASTNode from '../ast-node';
import text    from '../text';

import {
  escapeCDATA,
  format,
  indent,
  isBoolean,
  isString,
  isXMLString,
  noSectionTerminus,
  ws
} from '../ast-util';

export default
class CDATA extends ASTNode {
  constructor({ section=false, text='' }={}) {
    super();
    this.section = section;
    this.text    = text;
  }

  static get isArrayNode() {
    return false;
  }

  get typeName() {
    return '#text';
  }

  _serialize(opts) {
    if (this.section) {
      return `${ indent(opts) }<![CDATA[${ this.text }]]>`;
    }

    const baseText = escapeCDATA(this.text);

    return opts.formatCDATA ? format(ws(baseText), opts) : baseText;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      section: this.section,
      text: this.text
    });
  }

  validate() {
    assert(isString(this.text),       text.isString('CDATA text'));
    assert(isBoolean(this.section),   text.isBoolean('CDATA section'));
    assert(this.section || this.text, text.cdataHasLength);
    assert(isXMLString(this.text),    text.invalidChar('CDATA text'));

    if (this.section) {
      assert(noSectionTerminus(this.text), text.noSectionTerminus);
    }
  }
}
