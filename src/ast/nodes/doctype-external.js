import assert                from 'assert';
import ASTNode               from '../ast-node';
import AttlistDeclaration    from './declaration-attlist';
import Comment               from './comment';
import ElementDeclaration    from './declaration-element';
import EntityDeclaration     from './declaration-entity';
import NotationDeclaration   from './declaration-notation';
import ProcessingInstruction from './processing-instruction';
import text                  from '../text';

export default
class ExternalSubset extends ASTNode {

  get typeName() {
    return '#extSubset';
  }

  _serialize(opts) {
    return this.map(node => node._serialize(opts)).join('\n');
  }

  validate() {
    const VALID_CHILDREN = [
      AttlistDeclaration,
      Comment,
      ElementDeclaration,
      EntityDeclaration,
      NotationDeclaration,
      ProcessingInstruction
    ];

    for (const node of this) {
      const isValidChild = VALID_CHILDREN.some(Node => node instanceof Node);
      assert(isValidChild, text.validChild('DTD', node));
    }

    // Assertions regarding standalone="yes" are only made during parsing.

    super.validate();
  }
}
