import assert                from 'assert';
import ASTNode               from '../ast-node';
import Attdef                from './declaration-attdef';
import Attlist               from './declaration-attlist';
import CDATA                 from './cdata';
import Comment               from './comment';
import ContentSpec           from './declaration-content-spec';
import Element               from './element';
import ProcessingInstruction from './processing-instruction';
import text                  from '../text';

import { indent, isBoolean, isName, isString } from '../ast-util';

const STRING_CS = new Set([ 'ANY', 'EMPTY' ]);

export default
class ElementDeclaration extends ASTNode {
  constructor({ contentSpec='ANY', mixed=false, name }={}) {
    super();

    this.name  = name;
    this.mixed = mixed;

    this.contentSpec =
      contentSpec instanceof ContentSpec && contentSpec.parent
        ? contentSpec.clone()
        : contentSpec;
  }

  static get isArrayNode() {
    return false;
  }

  static childKeys() {
    return new Set([ 'contentSpec' ]);
  }

  get allowsCDATA() {
    return this.mixed || this.contentSpec === 'ANY';
  }

  get typeName() {
    return '#elemDecl';
  }

  getAttDef(name) {
    if (!this.name || !this.doctype) {
      return;
    }

    for (const node of this.doctype.getAll()) {
      if (node instanceof Attlist && node.elementName === this.name) {
        const def = node.find(node =>
          node instanceof Attdef &&
          node.name === name
        );

        if (def) {
          return def;
        }
      }
    }
  }

  getAttDefs() {
    return new Map(
      this.name &&
      this.doctype &&
      this.doctype
        .getAll()
        .filter(node =>
          node instanceof Attlist &&
          node.elementName === this.name
        )
        .reduce((acc, node) => [ ...acc, ...node ], [])
        .filter(node => node instanceof Attdef)
        .filter((n1, i, arr) => arr.find(n2 => n2.name === n1.name) === n1)
        .map(node => [ node.name, node ])
    );
  }

  matchesContent(nodes, partialAddition) {
    if (this.contentSpec === 'ANY') {
      return true;
    }

    if (this.contentSpec === 'EMPTY') {
      return !nodes.length;
    }

    if (this.mixed) {
      const permittedNames = this.contentSpec.map(node => node.name);

      return nodes.every(node =>
        node instanceof CDATA ||
        node instanceof Comment ||
        node instanceof ProcessingInstruction ||
        (node instanceof Element && permittedNames.includes(node.name))
      );
    }

    const hasBadChildren = !nodes.every(node =>
      node instanceof Comment ||
      node instanceof ProcessingInstruction ||
      node instanceof Element
    );

    if (hasBadChildren) {
      return false;
    }

    const contentImage = nodes
      .filter(node => node instanceof Element)
      .map(node => ` ${ node.name }`)
      .join('');

    if (partialAddition) {
      return this.contentSpec
        .partialPattern()
        .test(`${ contentImage } ${ partialAddition }`);
    }

    return this.contentSpec.pattern().test(contentImage);
  }

  _serialize(opts) {
    return `${ indent(opts) }<!ELEMENT ${ this.name } ${
      this.contentSpec instanceof ContentSpec
        ? this.mixed
          ? `(#PCDATA|${ this.contentSpec._serialize().slice(1) }`
          : this.contentSpec._serialize()
        : this.contentSpec
    }>`;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      contentSpec: this.contentSpec instanceof ContentSpec
        ? this.contentSpec.toJSON()
        : this.contentSpec,
      mixed: this.mixed,
      name: this.name
    });
  }

  validate() {
    const {
      contentSpec,
      doctype,
      document,
      mixed,
      name
    } = this;

    assert(document,         text.requireDoc('Element declaration'));
    assert(doctype,          text.requireDTD('Element declaration'));
    assert(isString(name),   text.isString('Element declaration name'));
    assert(isName(name),     text.isName('Element declaration name'));
    assert(isBoolean(mixed), text.isBoolean('Element declaration "mixed"'));

    assert(doctype.getElement(name) === this, text.redeclared('Element', name));

    if (isString(contentSpec)) {
      assert(STRING_CS.has(contentSpec), text.csValue);
      assert(!mixed,                     text.mixedNeedsCSN);
    } else {
      assert(contentSpec instanceof ContentSpec, text.csValue);

      if (mixed) {
        const validOwnQual = contentSpec.qualifier === '*';
        const validType    = 'CHOICE';
        const validTypes   = contentSpec.every(node => node.type === 'ELEMENT');
        const validQuals   = contentSpec.every(node => !node.qualifier);

        assert(validType,    text.mixedType);
        assert(validOwnQual, text.mixedQualifier);
        assert(validTypes,   text.mixedChildrenType);
        assert(validQuals,   text.mixedChildrenQual);
      }

      contentSpec.validate();
    }
  }
}
