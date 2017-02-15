import assert  from 'assert';
import ASTNode from '../ast-node';
import text    from '../text';

import {
  format, indent, isString, isXMLString, noDoubleHyphen, ws
} from '../ast-util';

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

  _serialize(opts) {
    if (!opts.formatComment) {
      return `${ indent(opts) }<!--${ this.content }-->`;
    }

    const comment = `<!-- ${ ws(this.content) } -->`;

    const singleLine = `${ indent(opts) }${ comment }`;

    if (singleLine.length <= opts.wrapColumn) {
      return singleLine;
    }

    return format(comment, opts, true);
  }

  toJSON() {
    return Object.assign(super.toJSON(), { content: this.content });
  }

  validate() {
    assert(isString(this.content),       text.isString('Comment content'));
    assert(noDoubleHyphen(this.content), text.commentNoDoubleHyphen);
    assert(isXMLString(this.content),    text.invalidChar('Comment content'));
  }
}
