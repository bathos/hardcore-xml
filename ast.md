# AST Nodes

All objects in the AST are instances of subclasses of `ASTNode`, which in turn
inherits from `Array`. First, the notable common properties, methods and
behaviors shared by all nodes.

<!-- MarkdownTOC autolink=true bracket=round depth=4 -->

- [ASTNode prototype properties](#astnode-prototype-properties)
  - [`ASTNode.prototype.doctype`](#astnodeprototypedoctype)
  - [`ASTNode.prototype.document`](#astnodeprototypedocument)
  - [`ASTNode.prototype.index`](#astnodeprototypeindex)
  - [`ASTNode.prototype.length`](#astnodeprototypelength)
  - [`ASTNode.prototype.nextSibling`](#astnodeprototypenextsibling)
  - [`ASTNode.prototype.parent`](#astnodeprototypeparent)
  - [`ASTNode.prototype.prevSibling`](#astnodeprototypeprevsibling)
  - [`ASTNode.prototype.root`](#astnodeprototyperoot)
- [ASTNode prototype methods](#astnode-prototype-methods)
  - [`ASTNode.prototype.clone\(\)`](#astnodeprototypeclone)
  - [`ASTNode.prototype.findDeep\(\)`](#astnodeprototypefinddeep)
  - [`ASTNode.prototype.filterDeep\(\)`](#astnodeprototypefilterdeep)
  - [`ASTNode.prototype.remove\(\)`](#astnodeprototyperemove)
  - [`ASTNode.prototype.serialize\(\)`](#astnodeprototypeserialize)
  - [`ASTNode.prototype.toJSON\(\)`](#astnodeprototypetojson)
  - [`ASTNode.prototype.validate\(\)`](#astnodeprototypevalidate)
  - [Additional methods from `Array.prototype`](#additional-methods-from-arrayprototype)
- [Node Context and Membership](#node-context-and-membership)
- [Node Constructors](#node-constructors)
- [General Nodes](#general-nodes)
  - [CDATA](#cdata)
    - [`cdata.section`](#cdatasection)
    - [`cdata.text`](#cdatatext)
  - [Comment](#comment)
    - [`comment.content`](#commentcontent)
  - [Document](#document)
    - [`document.findDeepByID\(id\)`](#documentfinddeepbyidid)
  - [Element](#element)
    - [`element.definition`](#elementdefinition)
    - [`element.id`](#elementid)
    - [`element.name`](#elementname)
    - [`element.notation`](#elementnotation)
    - [`element.allAttributes\(\)`](#elementallattributes)
    - [`element.getAttribute\(key\)`](#elementgetattributekey)
    - [`element.getReference\(key\)`](#elementgetreferencekey)
    - [`element.getReferences\(key\)`](#elementgetreferenceskey)
    - [`element.getTokenSet\(key\)`](#elementgettokensetkey)
    - [`element.hasAttribute\(key\)`](#elementhasattributekey)
    - [`element.resetAttribute\(key\)`](#elementresetattributekey)
    - [`element.setAttribute\(key, value\)`](#elementsetattributekey-value)
    - [Attributes are Properties of Element](#attributes-are-properties-of-element)
  - [ProcessingInstruction](#processinginstruction)
    - [`pi.target`](#pitarget)
    - [`pi.instruction`](#piinstruction)
- [Declaration Nodes](#declaration-nodes)
  - [AttdefDeclaration](#attdefdeclaration)
    - [`attDef.defaultValue`](#attdefdefaultvalue)
    - [`attDef.element`](#attdefelement)
    - [`attDef.enumeration`](#attdefenumeration)
    - [`attDef.fixed`](#attdeffixed)
    - [`attdef.hasDefault`](#attdefhasdefault)
    - [`attdef.isList`](#attdefislist)
    - [`attdef.isName`](#attdefisname)
    - [`attdef.isReference`](#attdefisreference)
    - [`attdef.isTokenized`](#attdefistokenized)
    - [`attdef.name`](#attdefname)
    - [`attDef.required`](#attdefrequired)
    - [`attDef.type`](#attdeftype)
    - [`attDef.matchValue\(value\)`](#attdefmatchvaluevalue)
    - [`attDef.matchValueGrammatically\(value\)`](#attdefmatchvaluegrammaticallyvalue)
  - [AttlistDeclaration](#attlistdeclaration)
    - [`attlistDecl.element`](#attlistdeclelement)
    - [`attlistDecl.elementName`](#attlistdeclelementname)
  - [ContentSpecDeclaration](#contentspecdeclaration)
    - [`contentSpec.hasAmbiguousSequences`](#contentspechasambiguoussequences)
    - [`contentSpec.name`](#contentspecname)
    - [`contentSpec.qualifier`](#contentspecqualifier)
    - [`contentSpec.type`](#contentspectype)
    - [`contentSpec.entryNames\(\)`](#contentspecentrynames)
    - [`contentSpec.pattern\(\)`](#contentspecpattern)
  - [DoctypeDeclaration](#doctypedeclaration)
    - [`doctype.external`](#doctypeexternal)
    - [`doctype.name`](#doctypename)
    - [`doctype.publicID`](#doctypepublicid)
    - [`doctype.systemID`](#doctypesystemid)
    - [`doctype.getAll\(\)`](#doctypegetall)
    - [`doctype.getElement\(name\)`](#doctypegetelementname)
    - [`doctype.getEntity\(name\)`](#doctypegetentityname)
    - [`doctype.getNotation\(name\)`](#doctypegetnotationname)
  - [ElementDeclaration](#elementdeclaration)
    - [`elementDecl.allowsCDATA`](#elementdeclallowscdata)
    - [`elementDecl.contentPattern`](#elementdeclcontentpattern)
    - [`elementDecl.contentSpec`](#elementdeclcontentspec)
    - [`elementDecl.mixed`](#elementdeclmixed)
    - [`elementDecl.name`](#elementdeclname)
    - [`elementDecl.getAttdef\(name\)`](#elementdeclgetattdefname)
    - [`elementDecl.getAttdefs\(\)`](#elementdeclgetattdefs)
    - [`elementDecl.matchesContent\(elem\)`](#elementdeclmatchescontentelem)
    - [`elementDecl.matchesContent\(elem, name\)`](#elementdeclmatchescontentelem-name)
  - [EntityDeclaration](#entitydeclaration)
    - [`entityDecl.name`](#entitydeclname)
    - [`entityDecl.notation`](#entitydeclnotation)
    - [`entityDecl.notationName`](#entitydeclnotationname)
    - [`entityDecl.publicID`](#entitydeclpublicid)
    - [`entityDecl.systemID`](#entitydeclsystemid)
    - [`entityDecl.type`](#entitydecltype)
    - [`entityDecl.value`](#entitydeclvalue)
    - [The Thing About Entity Declarations](#the-thing-about-entity-declarations)
  - [NotationDeclaration](#notationdeclaration)
    - [`notationDecl.name`](#notationdeclname)
    - [`notationDecl.publicID`](#notationdeclpublicid)
    - [`notationDecl.systemID`](#notationdeclsystemid)

<!-- /MarkdownTOC -->

## ASTNode prototype properties

All of these properties are unassignable.

### `ASTNode.prototype.doctype`

The `Doctype` node of the `Document` where this node lives, if applicable.

### `ASTNode.prototype.document`

The `Document` node within which this node lives, if applicable.

### `ASTNode.prototype.index`

The index position of this node within its parent, if applicable.

### `ASTNode.prototype.length`

Inherited from `Array`, but always 0 for "leaf" nodes like `Comment`.

### `ASTNode.prototype.nextSibling`

The next adjacent node within the same parent node, if applicable.

### `ASTNode.prototype.parent`

The immediate parent of this node, if applicable.

### `ASTNode.prototype.prevSibling`

The previous adjacent node within the same parent node, if applicable.

### `ASTNode.prototype.root`

The root `Element` node of the `Document` where this node lives, if applicable.

## ASTNode prototype methods

### `ASTNode.prototype.clone()`

Returns a new node of the same type with the same properties and descendents
(also cloned). Note that the clone does not have a context (no `parent`, etc)
until it is added as a child of another node. More on this below.

### `ASTNode.prototype.findDeep()`

Variation of `find` that operates as a depth-first search of descendents

### `ASTNode.prototype.filterDeep()`

Variation of `filter` that operates as a depth-first search of descendents.

### `ASTNode.prototype.remove()`

Detaches the node from its parent. As with `clone()`, afterwards the element
will not have a "context" unless it is added somewhere again. This can be useful
to do things like mutative filtering, e.g.

```
node
  .filter(node => node instanceof Comment)
  .forEach(node => node.remove());
```

### `ASTNode.prototype.serialize()`

Returns an XML string. This may not be the same as the original source text. In
addition to normalizing formatting and whitespace, XML is, in some sense, a
lossy format in that entity references cannot be ‘restored’ (you could pull it
off with general entities maybe, but parameter entities are especially
problematic when you have a mutable AST).

If called at the `Document` level, the xml declaration will always specify its
encoding as "UTF8", its version as "1.0" (this is an XML 1.0 processor) and its
standalone status as "yes", regardless of the original value, because the DTD
will be rendered in its ‘synthesized’ form. I expect to refine this further in
the future by accepting an options object.

### `ASTNode.prototype.toJSON()`

Returns a POJO representation of the node. Each object will have a "nodeType"
property and any additional properties specific to the node. If it is a non-leaf
node, it will have a "children" property as well to represent its content.

### `ASTNode.prototype.validate()`

Throws an error if the node (including its descendents) is found in an invalid
state. Expects to only be called when the node is within a `Document` context.

### Additional methods from `Array.prototype`

All regular methods you expect from `Array` are present, except `fill` (which
makes no sense here). Methods like `map` return regular arrays, not `ASTNode`.
Mutative operations that alter membership, like `splice`, have custom
implementations on account of special needs concerning unique parentage and
non-sparseness (explained below).

## Node Context and Membership

As in the DOM, a given node may only have a single parent. The `Document`
context is just determined by looking up the chain, and this determines quite a
bit in turn. For example, if a `Document`’s `Doctype` specifies that `Element`
"foo" has a content type of "EMPTY", calling `validate()` will only apply this
constraint if the element is actually a descendent of that document. Once
detached, the element no longer has a definition until reattached.

> Unless you have no DTD to worry about, generally you will only want to call
> `validate()` on nodes that are attached to a `Document`.

Unlike the DOM, I wanted to keep the API familiar and intuitive, so nodes are
just arrays and you can move stuff around with `push`, `pop`, `splice`, indexed
assignment, etc. Validity is not enforced as you do this; you must call
`validate()` to confirm when you’re ready. This is to help keep things flexible.
Trying to enforce constraints at the level of small operations would make it
awkward to perform broad mutations, since the order the changes were made might
end up mattering. You’d need to know that and think about it and some cascading
effects are not always intuitive, especially if you edit things like markup
declarations.

What is enforced though is that ‘one parent’ rule (more precisely: one ‘slot’ on
one parent).

```
nodeA.length; // 3
nodeB.push(nodeA[0]);
nodeA.length; // 2
```

Closely related is that the nodes can never be sparse — which has potential
implications for doing membership mutation within a `for` loop (though that’s
always a bad idea anyway) — and although something like the following is not an
error, it doesn’t make much sense:

```
nodeA.length; // 0
nodeA.push(nodeB, nodeB, nodeB);
nodeA.length; // 1
```

Most likely if someone did that, they really wanted something like:

```
nodeA.length; // 0
nodeA.push(nodeB, nodeB.clone(), nodeB.clone());
nodeA.length; // 3
```

## Node Constructors

The subclasses of `ASTNode` share a common constructor pattern where the unique
assignable properties associated with that class can be provided in an options
object at construction time.

```
new NotationDeclaration({ name: 'foo', publicID: 'bar' });
```

## General Nodes

### CDATA

Leaf node representing chardata (text). After parsing, the distinction between
explicit _CDATA sections_ and implicit CDATA is generally not important, but we
do preserve that knowledge for the sake of consistent reserialization. The text
may not be empty unless `section` is true (it would be a paradox, sort of).

#### `cdata.section`

Boolean, default false. If true, `text` must not contain the sequence "]]>".

#### `cdata.text`

String, any valid xml characters. Remember that, after parsing, entity
references are replaced by their replacement text. CDATA is literal text by
definition. If calling serialize(), ‘escaping’ any characters or character
sequences that would be interpreted as markup is automatic if `section` is
false.

```
cdata.text = 'M&Ms';
cdata.serialize(); // 'M&amp;Ms'
cdata.section = true;
cdata.serialize(); // '<![CDATA[M&Ms]]>'
```

### Comment

Leaf node representing a comment.

#### `comment.content`

String, any valid xml characters — but it must not contain the illegal
sequence "--".

### Document

The `Document` node can have, as children, any number of `Comment` and
`ProcessingInstruction` nodes, one `Element` node (required) and one
`DoctypeDeclaration` node (optional). If present, the `DoctypeDeclaration` node
must precede the `Element` node.

Like all nodes, `Document.prototype` has `doctype` and `root` properties, but
here, they are also assignable.

If there is a `DoctypeDeclaration`, it is an error if the root `Element` does
not have the same name.

#### `document.findDeepByID(id)`

Returns element which has an attribute of type `ID` whose value matches `id`.

### Element

The `Element` node can have, as children, `CDATA`, `Comment`, `Element`, and
`ProcessingInstruction` nodes; however, the specific content permitted and its
sequence may be constrained by a corresponding `ElementDeclaration`.

#### `element.definition`

Reference to corresponding `ElementDeclaration` if applicable.

#### `element.id`

An element may have at most one attribute of type `ID`. Regardless of its name,
if such an attribute exists, it is also available via the alias `elem.id`. An ID
must always be unique. Note that this means _across the whole document_, not
"per element with this ID-typed attdef".

This could probably use extra detail. An `ID` attdef can be thought of as
exposing what’s really an intrinsic XML element feature. The attdef exposes this
feature and permits customization of the name by which it will be exposed. In
other words, the `ID` type should not be used to model data which just happens
to ‘be an ID’ in some other sense that has nothing to do with identifying
elements in a document.

An element with an `ID` attribute can be referenced by other nodes that have
`IDREF` or `IDREFS` attributes. These three together comprise a significant
feature of the language, I think. For one, it is one of the few ‘constructive’
things you can do with a DTD; most of a DTD can be summed up as a ‘list of what
else is also an error now, actually’. I don’t think it’s very well known that
XML has a native mechanism for defining relationships between nodes that are
non-hierachical (even cyclic).

#### `element.name`

String, a valid name. If there is a `DoctypeDeclaration`, must have a
corresponding `ElementDeclaration`.

#### `element.notation`

If an element has an attribute of type `NOTATION` (like `ID`, there can be only
one such attribute per element), the property `elem.notation` will be a
reference to the associated `NotationDeclaration`. Access only.

#### `element.allAttributes()`

Returns map of attributes (key => value).

#### `element.getAttribute(key)`

Returns an attribute value (as string).

#### `element.getReference(key)`

Returns a node referenced by an attribute of type `ENTITY` or `IDREF`.

#### `element.getReferences(key)`

Returns an array of referenced nodes for attributes of type `ENTITIES` or
`IDREFS`.

#### `element.getTokenSet(key)`

Returns a set of token strings for an attribute whose type is `NMTOKENS`,
`ENTITIES`, or `IDREFS`.

#### `element.hasAttribute(key)`

Returns boolean indicating whether the attribute exists.

#### `element.resetAttribute(key)`

Default attribute values from attdefs are provisioned initially. If you remove
an attribute that had a default it is actually removed, not reset. You must call
this method explicitly to restore the default.

#### `element.setAttribute(key, value)`

Assigns `value` (as a string) to an attribute.

#### Attributes are Properties of Element

Attributes can be gotten and sotten as arbitrary additional properties of the
element. In cases where the name would collide with an existing property, prefix
the key with `$`.

If the document has a doctype, the `name` of each attribute must have a
corresponding `AttdefDeclaration` to be valid, and the value must meet any
constraints specified by that declaration. Unlike most markup declarations,
though, `AttdefDeclarations` do not just declare constraints or reference stuff.
They also may define the behaviors and, grammar productions, and in some cases,
the meanings of attributes. These can be called the ‘tokenized’ types, since
what they all have in common is that their values are composed of one or more
distinct tokens, not arbitrary chardata.

In the absence of a DTD, any attribute is legal and all attribute values are
treated as type CDATA.

### ProcessingInstruction

Leaf node. Processing instructions are like formatted comments that target
specific agents: `<?foo poop?>`. I have never seen these in practice. The case
most people are familiar with is PHP, but those are not really PIs, they just
look like them; a real PI is parsed and included in the document itself, and has
nothing in particular to do with templating. Perhaps they selected this syntax
as a safety mechanism for cases where a template is accidentally rendered to the
client without being processed?

#### `pi.target`

String, a Name (but not "xml" — case insensitive).

#### `pi.instruction`

String, any valid xml characters (but not including the sequence "?>").

## Declaration Nodes

Declaration nodes define the behaviors of validating documents.

Since support for these aspects of XML is the primary distinguishing feature of
this library, I’ll go into a little extra depth here and try to badly explain
what each of these actually _do_ in addition to just the AST interface.

Several constructs related to DTD source text ‘dissolve’ during parsing. These
include conditional sections and parameter references — the actual AST does not
have knowledge of these, as they are essentially directives for the parser.

Content from an external DTD is treated as if the internal subset had had a
parameter entity reference as its final source text: `%ext_dtd;`.

### AttdefDeclaration

Leaf node. An `AttlistDeclaration` has, as its children, one or more of these as
its child nodes. Each defines an attribute of the element referenced by
`AttlistDeclaration`. Somewhat surprisingly, this is the most involving kind of
declaration in a DTD, by far. Some of the effects of different attribute types
are explained more in `Element` above.

#### `attDef.defaultValue`

String. If `fixed` is false and `defaultValue` is absent, that corresponds to
the `#IMPLIED` keyword. If `fixed` is true the attribute *must* have this value,
otherwise it is supplied only if absent.

#### `attDef.element`

Reference to corresponding `ElementDeclaration`; access only.

#### `attDef.enumeration`

A `Set` of strings, applicable only if `type` is `ENUMERATION` or `NOTATION`.
If type is `ENUMERATION`, the strings must conform to the `Nmtoken` production.
If type is `NOTATION`, the strings must all correspond to the names of declared
notations.

#### `attDef.fixed`

Boolean. If true, corresponds to the `#FIXED` keyword. This makes the default
value the only permitted value, and further, it demands that it is explicitly
included. I don’t know why you would ever want this, it doesn’t make any sense.
When true, `required` is implied (this takes precedence).

#### `attdef.hasDefault`

Boolean, access only. True if the attribute has a `defaultValue` which is
*really* the default value (i.e., not a fixed value).

#### `attdef.isList`

Boolean, access only. True if the type is a list of space-delimited tokens.

#### `attdef.isName`

Boolean, access only. True if the type’s grammar is NAME or NAMES.

#### `attdef.isReference`

Boolean, access only. True if the type is `IDREF`, `IDREFS`, or `NOTATION`.

#### `attdef.isTokenized`

Boolean, access only. True if the type is a valid type which is not CDATA.

#### `attdef.name`

String, any `Name`. If two `AttdefDeclaration` nodes specify the the same
attribute name for the same element, it is not an error, but only the first is
observed.

#### `attDef.required`

Boolean. If true and `fixed` is false, corresponds to the `#REQUIRED` keyword.
Always true if `fixed` is true.

#### `attDef.type`

String, one of: `CDATA`, `ENUMERATION`, `ID`, `IDREF`, `IDREFS`, `ENTITY`,
`ENTITIES`, `NMTOKEN`, `NMTOKENS`, or `NOTATION`. Note that unlike the others,
`ENUMERATION` is not a keyword in the grammar. When there is no doctype, all
attributes behave as if their type is `CDATA`. The rest of these are _tokenized
attributes_.

#### `attDef.matchValue(value)`

Returns boolean; used internally during `Element` validation to confirm that an
attribute value fully conforms to the attribute definition.

#### `attDef.matchValueGrammatically(value)`

Returns boolean; this is a subset of `matchValue` which confirms only that the
grammar conforms. The distinction is useful because the complete check cannot be
performed until the entire document has been parsed, while the grammatical check
can be performed immediately.

### AttlistDeclaration

Though logically you’d expect attribute definitions to be hierarchically part of
`ElementDeclaration`, they are given as a distinct top-level markup declaration.
Each `AttlistDeclaration` specifies an associated element and has one or more
`AttdefDeclaration` children that describe individual attributes.

One `ElementDeclaration` may have multiple associated `AttlistDeclaration`
nodes.

It is an error for an `AttlistDeclaration` to have no children. If an
`AttlistDeclaration` specifies an element which was not previously declared, it
is not an error, but the `AttlistDeclaration` will be ignored.

#### `attlistDecl.element`

A reference to the associated `ElementDeclaration`, if applicable.

#### `attlistDecl.elementName`

String, the `Name` of an `ElementDeclaration`

### ContentSpecDeclaration

A `ContentSpecDeclaration` is either a property of `ElementDeclaration` (as
`elemDecl.contentSpec`) or is the child of another `ContentSpecDeclaration`
whose type is not "ELEMENT".

#### `contentSpec.hasAmbiguousSequences`

Boolean, access only. True if content spec is non-deterministic according to the
XML spec.

#### `contentSpec.name`

String, element name. Should only be populated if type is `ELEMENT`.

#### `contentSpec.qualifier`

String, may be `*`, `+`, `?` or undefined.

#### `contentSpec.type`

May be "CHOICE", "SEQUENCE", or "ELEMENT". If `type` is "ELEMENT", there can be
no children; otherwise, there _must_ be children.

#### `contentSpec.entryNames()`

Returns an array of the names which could be the first elements matched by this
contentSpec tree/subtree. This is used internally during validation to enforce
what the spec calls ‘determinism’.

> What is referred as ‘deterministic’ in the XML spec did not match my personal
> idea of what constitutes determinism (which may just be wrong; not sure). I’ll
> explain it a bit in case anybody else also finds this unintuitive.
>
> The spec provides `((a,b)|a,c))` as an example of invalidity. If I am
> interpreting the text correctly, `(a+,a)`, which also implies backtracking,
> is disallowed as well, and even `(a*,a*)` — which does not imply backtracking,
> but still makes it ambiguous *which* `a` was matched, as if that actually
> could matter.
>
> This is all for the sake of SGML, but unfortunately it is marked ‘for
> compatibility’ rather than ‘for interoperability’, so we have to try to
> enforce it (the former indicates a formal requirement of XML processors while
> the latter items are ‘non-binding’). It’s actually a lot more work to disallow
> such patterns than to allow them, and the constraint seems to be an unnatural
> nuisance to authors, since none of these patterns are actually ambiguous in
> terms of meaning and effect.

#### `contentSpec.pattern()`

Returns a RegExp pattern which is employed when validating an element against
the content spec.

> This was a fun realization — the spec refers to ‘language generated by the
> regular expression in the content model’ in discussing the application of
> content specifications to content. While they meant this in an abstract sense,
> it stuck in my head and I realized there was no need to implement the matching
> logic as such since we really _can_ take advantage of a RegExp object. All we
> need to do is map the child elements to a testable string. Saves quite a bit
> of work!

### DoctypeDeclaration

A `DoctypeDeclaration` may be the child of `Document` and may have any number of
the following nodes as children: `AttlistDeclaration`, `Comment`,
`ElementDeclaration`, `EntityDeclaration`, `NotationDeclaration`, and
`ProcessingInstruction`.

#### `doctype.external`

If the DTD includes an external reference (publicID/systemID), this will be the
`ExternalSubset` node representing the external content.

#### `doctype.name`

String, a `Name`; should correspond to root `Element` name. Required.

#### `doctype.publicID`

String with restricted character set. If present, `systemID` is required.

#### `doctype.systemID`

String, any valid xml characters but `'` and `"` cannot _both_ appear.

#### `doctype.getAll()`

Returns an array of the children of both the doctype declaration and (if
applicable) the external subset, in that order.

#### `doctype.getElement(name)`

Returns the child `ElementDeclaration` whose name is `name`.

#### `doctype.getEntity(name)`

Returns the child `EntityDeclaration` whose name is `name`.

#### `doctype.getNotation(name)`

Returns the child `NotationDeclaration` whose name is `name`.

### ElementDeclaration

Leaf node, though it may have a `ContentSpecDeclaration` as a property.
`ElementDeclaration` is used to define an element and what kinds of content it
may contain. Element attributes are declared outside of `ElementDeclaration`.

#### `elementDecl.allowsCDATA`

Boolean, access only. True if the element declaration permits CDATA child nodes.

#### `elementDecl.contentPattern`

RegExp, access only. This is used internally when validating whether an element
conforms to its declared content spec. Attempted access will throw if the
`ElementDeclaration` is in an invalid state.

#### `elementDecl.contentSpec`

This may be one of the following: the string "ANY", the string "EMPTY", or a
`ContentSpecDeclaration` node. In a document without a doctype, all elements
behave as if they had the `contentSpec` "ANY".

#### `elementDecl.mixed`

Boolean. If true, `contentSpec` must be a `ContentSpecDeclaration` of type
`choice`, qualifier `*`, and which contains only `ContentSpecDeclaration`
children of type `ELEMENT` and qualifier `undefined`.

#### `elementDecl.name`

String, a unique element name. It is an error to declare the same element twice.

#### `elementDecl.getAttdef(name)`

Returns an `AttdefDeclaration` node associated with the element by that name.

#### `elementDecl.getAttdefs()`

Returns a map of all `AttdefDeclaration` nodes associated with the element.

#### `elementDecl.matchesContent(elem)`

Returns `true` if the `Element` passed in complies with the content constraints.

#### `elementDecl.matchesContent(elem, name)`

Same, but here the test is _partial_ and confirms whether an element `name`
could be a valid continuation of the content so far, rather than whether the sum
of content is an entirely valid production.

### EntityDeclaration

Leaf node. Entities are kind of like variables. The terminology surrounding
entities in XML is really, really confusing. So let’s start by trying to clear
it up a little, or possibly, making it worse:

"Entity" means like ... it seems to mean practically everything in XML. For
example, a Document is an entity. But a document cannot be ‘declared’ as an
entity. An _external_ DTD (doctype definition) is also an entity, and it does
get declared, but with `<!DOCTYPE ...`, not `<!ENTITY ...` — though a subset of
an external DTD _can_ be declared with `<!ENTITY ...`.

There are two main categories of ‘entity’: _internal_ and _external_. An
external entity is one which is indicated by reference (‘external ID’) and must
be resolved. An internal entity is one whose text is part of the entity
declaration itself, provided as a string literal.

There are also ... uh ... two main categories of ‘entity’ ... _parsed_ and
_unparsed_. A parsed entity may be internal or external. An unparsed entity is
always external. A parsed entity is an entity whose value can be interpreted as
a XML (or a fragment of XML), and an unparsed entity is one whose value is not
going to be interpreted as XML. What might an unparsed entity be interpreted as?
To answer that question, you use `NotationDeclaration`.

Within the category of parsed entities that can be declared with `<!ENTITY`,
there are two more types: `GENERAL` and `PARAMETER`. A general entity is one
which can be referenced using `&poop;` and its value is "content", like CDATA or
elements. A parameter entity is similar, but the syntax for references is
`%poop;`, and these can be used inside DTDs, sometimes in really wacky ways.

> *95% of all the complexity of XML comes from the concept of ‘entities’.*

For purposes related to `EntityDeclaration`, we can forget much of this and
instead talk about there being _three_ types: `GENERAL`, `PARAMETER`, and
`UNPARSED`. Within the resulting AST, likely only `UNPARSED` entities will be of
interest.

#### `entityDecl.name`

String, any `Name`. It is an error if there is a previously declared entity with
the same name.

#### `entityDecl.notation`

A reference to the associated `NotationDeclaration`, if this is an unparsed
entity.

#### `entityDecl.notationName`

String, the `Name` of a previously declared notation.

#### `entityDecl.publicID`

String with restricted subset of legal characters. If present, this is an
external entity and it does not require a `value`; also, if present, `systemID`
is required.

#### `entityDecl.systemID`

String, any valid xml characters but it cannot contain both `'` and `"`. If
present, this is an external entity and it does not require a `value`. It is
required if this is an unparsed entity.

#### `entityDecl.type`

One of 'GENERAL', 'PARAMETER', or 'UNPARSED'. If the type is `UNPARSED`, the
`notationName` attribute is required.

#### `entityDecl.value`

This is an array of raw codepoints rather than a string. It is only required if
there is no external ID, implying an internal entity, though it will also be
populated for external parsed entities which were dereferenced during parsing.
Note that parsed entities are mainly an internal mechanism which loses meaning
after parsing is complete; I do not recommend editing this property.

#### The Thing About Entity Declarations

> *tl;dr* Unlike the other markup declarations, and excluding the case of
> unparsed entities, which remain abstract references, entity declarations
> affect _parsing_ but have no subsequent affect on the AST. Mutating them, or
> even simply keeping them around, is likely pointless. Assuming a parsed entity
> was actually used, those original references have all been dereferenced (a
> necessity to produce the AST to begin with) and hardcore cannot ‘rereference’
> them automatically. If reserializing the document, it will have become
> standalone and it will no longer contain entity references.

Some markup declarations directly influence parsing itself ‘in real time’.
Entity declarations are the most important of these, and the only one which is
entirely unavoidable. It could be argued that, at least at the lexical level,
XML without DTDs is a context-free language, but once entity references — in
particular parameter entity references — enter the picture, it is most certainly
not. It is like ... _aggressively_ not. The references need to be dereferenced
and their values parsed in-context at the point of reference. Since parameter
entity references are less constrained than general entity references (when
appearing in external entities), it is impossible to tokenize what follows
"%poop;" in the following example without dereferencing and parsing it first:

```
<!NOTATION %poop; "foo">
```

The string literal there is initially ambiguous — it could equally be a system
ID literal or a public ID literal, but these two productions are defined as
unique lexical tokens (allegedly ‘regular’ ones, too), each with distinct rules.
Is the quoted sequence below to be tokenized as a valid `SystemLiteral`, or have
we encountered a syntax error within a `PublicLiteral` token?

```
<!NOTATION %poop; "foo\bar">
```

> So I would add to the long StackOverflow thread about whether XML is
> context-free (which is oddly focused on whether ID uniqueness constraints
> count, when there are actully a bunch of similar cases in validating XML, like
> content specs, enumerated attributes, etc; and of course, even in terms of
> well-formedness constraints, matching element tags): yes, you can apply all of
> these constraints _after_ lexical parsing, so things like ID constraints don’t
> push it over the edge in terms of a distinct lexing phase; you could even go
> as far as dereferencing and parsing general entity references recursively just
> to keep it context-free. However, despite these possible approaches, XML can
> still never be context-free even at the lexical level because of parameter
> entity references. In theory, you might create a custom set of definitions for
> the regular productions that conflates the potentially ambiguous tokens found
> in markup declarations, then resolve the ambiguities in a second pass; but at
> this point we’d have departed from XML’s own definition of its grammar.

### NotationDeclaration

Leaf node representing a "notation". This is a bit under-explained in the XML
spec proper I think. It represents a reference to something external, but unlike
other external references, the thing it points to is not called an ‘entity’. The
main purpose it to associate _unparsed entities_ (references to stuff that’s not
XML) with some agent that should be used interpret them — kind of like
specifying the `content-type` header or something. They can also be used to
provide definitions for the agents to whom processing instructions should be
given, but PIs do not expressly require this, while unparsed entities do.
Finally they can be associated with a specific element by having an attribute
with type `NOTATION` for that element.

Note that, when used in the context of an unparsed entity definition, the
keyword is `NDATA`, not `NOTATION`, in order to maintain the high degree of
esoteric mystery that gives DTDs their fundamental character.

It’s pretty open-ended; it could be used something like this (probably wrong,
eh, ymmv):

```
<!NOTATION ecmascript PUBLIC "node">
<!ENTITY hardcore SYSTEM "node_modules/hardcore-xml" NDATA ecmascript>
<!ELEMENT dependencies (module*)>
<!ELEMENT module EMPTY>
<!ATTLIST module
  name NMTOKEN #REQUIRED
  file ENTITY #REQUIRED>

...

<dependencies>
  <module name="Hardcore" file="hardcore"/>
</dependencies>
```

#### `notationDecl.name`

String, a unique `Name`. It is an error for the same notation to be declared
more than once.

#### `notationDecl.publicID`

String, restricted character set. Unlike other nodes that have external IDs,
`NotationDeclaration` permits a `publicID` _without_ also having a `systemID`.

#### `notationDecl.systemID`

String, any valid XML chars, but not _both_ `'` and `"`.
