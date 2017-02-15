import assert  from 'assert';
import ASTNode from '../ast-node';
import text    from '../text';

import {
  indent, isName, isString, isXMLString, noQMGT, notXML
} from '../ast-util';

export default
class ProcessingInstruction extends ASTNode {
  constructor({ instruction, target }={}) {
    super();

    this.target      = target;
    this.instruction = instruction;
  }

  static get isArrayNode() {
    return false;
  }

  get typeName() {
    return '#pi';
  }

  _serialize(opts) {
    return `${ indent(opts) }<?${
      this.target }${
      this.instruction ? ` ${ this.instruction }` : ''
    }?>`;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      instruction: this.instruction,
      target: this.target
    });
  }

  validate() {
    const { instruction, target } = this;

    assert(isString(target), text.isString('PI target'));
    assert(notXML(target),   text.targetNotXML);
    assert(isName(target),   text.isName('PI target'));

    if (instruction !== undefined) {
      assert(isString(instruction),    text.isString('PI instruction'));
      assert(noQMGT(instruction),      text.noQMGT);
      assert(isXMLString(instruction), text.invalidChar('PI instruction'));
    }
  }
}
