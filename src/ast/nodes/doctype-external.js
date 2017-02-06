import assert                from 'assert';
import ASTNode               from '../ast-node';
import AttlistDeclaration    from './declaration-attlist';
import Comment               from './comment';
import ElementDeclaration    from './declaration-element';
import EntityDeclaration     from './declaration-entity';
import NotationDeclaration   from './declaration-notation';
import ProcessingInstruction from './processing-instruction';
import text                  from '../text';

const VALID_CHILDREN = [
  AttlistDeclaration,
  Comment,
  ElementDeclaration,
  EntityDeclaration,
  NotationDeclaration,
  ProcessingInstruction
];

export default
class ExternalSubset extends ASTNode {

  get typeName() {
    return '#extSubset';
  }

  serialize() {
    return super.serialize().join('\n');
  }

  validate() {
    for (const node of this) {
      const isValidChild = VALID_CHILDREN.some(Node => node instanceof Node);
      assert(isValidChild, text.validChild('DTD', node));
    }

    // TODO: Assertions that confirm standalone="yes" isn’t being violated.

    super.validate();
  }
}
