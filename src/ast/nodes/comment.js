import assert  from 'assert';
import ASTNode from '../ast-node';
import text    from '../text';

import { isString, isXMLString, noDoubleHyphen } from '../ast-util';

export default
class Comment extends ASTNode {
  constructor({ content='' }={}) {
    super();
    this.content = content; // String (char* minus "--")
  }

  static get isArrayNode() {
    return false;
  }

  get typeName() {
    return '#comment';
  }

  serialize() {
    return `<!--${ this.content }-->`;
  }

  toJSON() {
    return Object.assign(super.toJSON(), { content: this.content });
  }

  validate() {
    assert(isString(this.content),      text.isString('Comment content'));
    assert(noDoubleHyphen(this.content), text.commentNoDoubleHyphen);
    assert(isXMLString(this.content),    text.invalidChar('Comment content'));
  }
}
