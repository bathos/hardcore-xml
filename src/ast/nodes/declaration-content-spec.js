import assert      from 'assert';
import ASTNode     from '../ast-node';
import text        from '../text';

import { isName, isString } from '../ast-util';

const CS_TYPES = new Set([ 'CHOICE', 'ELEMENT', 'SEQUENCE' ]);
const CS_QUALS = new Set([ '*', '+', '?', undefined ]);

export default
class ContentSpecDeclaration extends ASTNode {
  constructor({ name, qualifier, type }={}) {
    super();

    this.name      = name;
    this.qualifier = qualifier;
    this.type      = type;
  }

  get hasAmbiguousSequence() {
    return this
      .slice(0, -1)
      .filter(node => node.qualifier)
      .some(node => {
        const entryNames = node.entryNames();
        const nextEntryNames = new Set(node.nextSibling.entryNames());

        return entryNames.some(entryName => nextEntryNames.has(entryName));
      });
  }

  get _partialPattern() {
    if (this.type === 'SEQUENCE') {
      return `(${ this._pattern })*${
        this.reduceRight((acc, cs) =>
          `(${ cs._partialPattern }(${ acc._partialPattern || acc })?)`
        )
      }`;
    }

    return this._pattern;
  }

  get _pattern() {
    if (this.type === 'ELEMENT') {
      return `( ${ this.name })${ this.qualifier || '' }`;
    }

    if (this.type === 'SEQUENCE') {
      return (
        `(${ this.map(cs => cs._pattern).join('') })${ this.qualifier || '' }`
      );
    }

    if (this.type === 'CHOICE') {
      return (
        `(${ this.map(cs => cs._pattern).join('|') })${ this.qualifier || '' }`
      );
    }
  }

  get typeName() {
    return '#contentSpec';
  }

  entryNames() {
    if (this.type === 'ELEMENT') {
      return [ this.name ];
    }

    if (this.type === 'CHOICE') {
      return this.reduce((acc, node) => [ ...acc, ...node.entryNames() ], []);
    }

    if (this.type === 'SEQUENCE') {
      const names = [];

      for (const node of this) {
        names.push(...node.entryNames());

        if (node.qualifier !== '*' && node.qualifier !== '?') {
          break;
        }
      }

      return names;
    }

    return [];
  }

  partialPattern() {
    return new RegExp(`^${ this._partialPattern }$`);
  }

  pattern() {
    return new RegExp(`^${ this._pattern }$`);
  }

  serialize() {
    const sep = this.type === 'CHOICE' ? ',' : '|';

    return this.type === 'ELEMENT'
      ? `${ this.name }${ this.qualifier || '' }`
      : `(${ super.serialize().join(sep) })${ this.qualifier || '' }`;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      name:      this.name,
      qualifier: this.qualifier,
      type:      this.type
    });
  }

  validate() {
    assert(CS_TYPES.has(this.type),      text.csType);
    assert(CS_QUALS.has(this.qualifier), text.csQualifier);

    if (this.type === 'ELEMENT') {
      assert(this.name,           text.csElementNeedsName);
      assert(isString(this.name), text.isString('ContentSpec name'));
      assert(isName(this.name),   text.isName('ContentSpec name'));
      assert(this.length === 0,   text.csElementNoChildren);
    } else {
      assert(this.name === undefined, text.csNameOnlyElement);
      assert(this.length,             text.csNeedsChildren);

      if (this.type === 'CHOICE') {
        const entryNames       = this.entryNames();
        const uniqueEntryNames = new Set(entryNames);

        assert(entryNames.length === uniqueEntryNames.size, text.csDeterminism);
      } else {
        assert(!this.hasAmbiguousSequence, text.csDeterminism);
      }

      super.validate();
    }
  }
}
