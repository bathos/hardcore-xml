# Constraints

I’ve assembled this as a reference to help myself keep track of all the WFCs and
VCs. As a general rule, constraints are applied at the earliest possible time,
which usually means they are to be found in grammar drivers (in order to
increase the chances that the error message produced "points to" the source text
where the "offense" took place). Some constraints are, or can be, applied in
more than one place: since the AST is mutable, `ASTNode.validate()` may be
needed to re-confirm validity and well-formedness after making changes.

All WFCs and some VCs are only applicable during initial parsing, since it may
not be possible to ever enter a corresponding invalid state from the AST. For
example, the WFC that says "start" and "end" tags of an element must have
matching names is purely syntactic; the AST simply models `element.name`, so
once parsed, this constraint can never be violated.

Conversely, the `ASTNode.validate()` method may need to explicitly re-confirm
the _unstated_ WFCs of grammar productions, since a user could do something like
`element.name = '#poop'`. So `element.validate()` needs to ask, ‘is my name
still a `Name`?’. One could think of the EBNF productions as a series of
implicit WFCs, and anywhere a string makes it into the AST as a mutable property
of a node, those WFCs must be re-checked by `node.validate()`.

I initially experimented with using accessors and other approaches to enforce
constraints at all times rather than having a `validate()` method. What I found
was that it added too little value to justify the high complexity, and that it
could force users to jump through unintuitive hoops in order to make changes.
Indeed, some changes which cannot be effected atomically would become extremely
awkward. For example, constraints derived from a complex element content spec
could fall in this category. Just call `validate()` when you’re "ready".

Below, I’ve annotated the WFCs and VCs with information about when and how the
constraints are applied and which `node.validate()` methods can be called to
re-check them (if applicable).

- "Implicit in the grammar drivers" means the grammar productions themselves
  dictate this constraint anyway, and we don’t really need to do anything
  special to make sure it happens.
- "Explicitly confirmed in the grammar drivers" means we deliberately assert the
  condition at the earliest possible time.
- "Via signals in the grammar drivers" means it is a complex parsing-related
  behavior that is managed in whole or in part at the processor level. The
  drivers "signal" the processor to activate or deactivate these behaviors or to
  retrieve "tickets" that are used to enforce valid entity replacement text
  boundaries.

## Well-Formedness Constraints

All WFCs correspond to behaviors which occur _during_ parsing only. None of them
are things which need to be re-confirmed after AST mutation since it is
impossible to put the AST into any invalid states corresponding to WFC
violations.

### 2.8 Prolog and Document Type Declaration

#### PEs in Internal Subset

> In the internal DTD subset, parameter-entity references must not occur within
> markup declarations; they may occur where markup declarations can occur. (This
> does not apply to references that occur in external parameter entities or to
> the external subset.)

#### External Subset

> The external subset, if any, must match the production for `extSubset`.

- Implicit in grammar drivers.

#### PE Between Declarations

> The replacement text of a parameter entity reference in a `DeclSep` must match
> the production `extSubsetDecl`.

- Via signals in grammar drivers.

### 3 Logical Structures

#### Well-formedness constraint: Element Type Match

> The Name in an element's end-tag must match the element type in the start-tag.

- Implicit in grammar drivers.

### 3.1 Start-Tags, End-Tags, and Empty-Element Tags

#### Unique Att Spec

> An attribute name must not appear more than once in the same start-tag or
> empty-element tag.

- Explicitly confirmed in grammar drivers.

#### No External Entity References

> Attribute values must not contain direct or indirect entity references to
> external entities.

- Implicit in entity dereferencing behavior.

#### No < in Attribute Values

> The replacement text of any entity referred to directly or indirectly in an
> attribute value must not contain a `<`.

- Implicit in grammar drivers.

### 4.1 Character and Entity References

#### Legal Character

> Characters referred to using character references must match the production
> for Char.

- Explicitly confirmed in grammar drivers.

#### Entity Declared

> In a document without any DTD, a document with only an internal DTD subset
> which contains no parameter entity references, or a document with
> `standalone='yes'`, for an entity reference that does not occur within the
> external subset or a parameter entity, the `Name` given in the entity
> reference must match that in an entity declaration that does not occur within
> the external subset or a parameter entity, except that well-formed documents
> need not declare any of the following entities: `amp`, `lt`, `gt`, `apos`,
> `quot`. The declaration of a general entity must precede any reference to it
> which appears in a default value in an attribute-list declaration.
>
> Note that non-validating processors are not obligated to read and process
> entity declarations occurring in parameter entities or in the external subset;
> for such documents, the rule that an entity must be declared is a
> well-formedness constraint only if `standalone='yes'`.

- TODO: I need to spend more time making sure I understand all implications of
  this WFC. Right now, we are doing nothing with `standalone` at all.

#### Parsed Entity

> An entity reference must not contain the name of an unparsed entity. Unparsed
> entities may be referred to only in attribute values declared to be of type
> `ENTITY` or `ENTITIES`.

- Implicit in entity dereferencing behavior.

#### No Recursion

> A parsed entity must not contain a recursive reference to itself, either
> directly or indirectly.

- Implicit in entity dereferencing behavior.

#### In DTD

> Parameter-entity references must not appear outside the DTD.

- Implicit in grammar drivers and entity dereferencing behavior.

### 4.3.2 Well-Formed Parsed Entities

#### (Unnamed Note)

> Only parsed entities that are referenced directly or indirectly within the
> document are required to be well-formed.

- Implicit in entity dereferencing behavior.

## Validity Constraints

Unlike WFCs, most VCs are things which one may, after making mutations to the
AST, need to re-validate. You can run all validation from `document.validate()`,
or you can run validators on interior subtrees from any node.

### 2.8 Prolog and Document Type Declaration

#### Root Element Type

> The `Name` in the document type declaration must match the element type of the
> root element.

- Explicitly confirmed in grammar drivers.
- `Document.prototype.validate()`

#### Proper Declaration/PE Nesting

> Parameter-entity replacement text must be properly nested with markup
> declarations. That is to say, if either the first character or the last
> character of a markup declaration (`markupdecl` above) is contained in the
> replacement text for a parameter-entity reference, both must be contained in
> the same replacement text.

- Via signals in grammar drivers.

### 2.9 Standalone Document Declaration

#### Standalone Document Declaration

> The standalone document declaration must have the value `no` if any external
> markup declarations contain declarations of:
>
> - attributes with default values, if elements to which these attributes apply
>   appear in the document without specifications of values for these
>   attributes, or
> - entities (other than `amp`, `lt`, `gt`, `apos`, `quot`), if references to
>   those entities appear in the document, or
> - attributes with tokenized types, where the attribute appears in the document
>   with a value such that normalization will produce a different value from
>   that which would be produced in the absence of the declaration, or
> - element types with element content, if white space occurs directly within
>   any instance of those types.

- TODO: as with WFC 4.1 / Entity Declared, I still need to review the ways in
  which we should be taking `standalone` into account.

### 3 Logical Structures

#### Element Valid

> An element is valid if there is a declaration matching `elementdecl` where the
> `Name` matches the element type, and one of the following holds:
>
> 1. The declaration matches `EMPTY` and the element has no content (not even
>    entity references, comments, PIs or white space).
> 2. The declaration matches children and the sequence of child elements belongs
>    to the language generated by the regular expression in the content model,
>    with optional white space, comments and PIs (i.e. markup matching
>    production `Misc`) between the start-tag and the first child element,
>    between child elements, or between the last child element and the end-tag.
>    Note that a CDATA section containing only white space or a reference to an
>    entity whose replacement text is character references expanding to white
>    space do not match the nonterminal `S`, and hence cannot appear in these
>    positions; however, a reference to an internal entity with a literal value
>    consisting of character references expanding to white space does match S,
>    since its replacement text is the white space resulting from expansion of
>    the character references.
> 3. The declaration matches `Mixed`, and the content (after replacing any
>    entity references with their replacement text) consists of character data
>    (including CDATA sections), comments, PIs and child elements whose types
>    match names in the content model.
> 4. The declaration matches ANY, and the content (after replacing any entity
>    references with their replacement text) consists of character data, CDATA
>    sections, comments, PIs and child elements whose types have been declared.

- Explicitly confirmed in grammar drivers. Details of whitespace handling are
  ‘parse only’ concerns; CDATA nodes _are_ CDATA, no matter what they contain.
- `Element.prototype.validate()`, which employs
  `ElementDeclaration.matchesContent()`, etc.

### 3.1 Start-Tags, End-Tags, and Empty-Element Tags

#### Attribute Value Type

> The attribute must have been declared; the value must be of the type declared
> for it.

- Explicitly confirmed in grammar drivers.
- `Element.prototype.validate()`

### 3.2 Element Type Declarations

#### Unique Element Type Declaration

> An element type must not be declared more than once.

- Explicitly confirmed in grammar drivers.
- `ElementDeclaration.prototype.validate()`

### 3.2.1 Element Content

#### Proper Group/PE Nesting

> Parameter-entity replacement text must be properly nested with parenthesized
> groups. That is to say, if either of the opening or closing parentheses in a
> `choice`, `seq`, or `Mixed` construct is contained in the replacement text for
> a parameter entity, both must be contained in the same replacement text.
>
> For interoperability, if a parameter-entity reference appears in a `choice`,
> `seq`, or `Mixed` construct, its replacement text should contain at least one
> non-blank character, and neither the first nor last non-blank character of the
> replacement text should be a connector (`|` or `,`).

- Via signals in grammar drivers.
- SGML interoperability guidelines are not observed.

### 3.2.2 Mixed Content

#### No Duplicate Types

> The same name must not appear more than once in a single mixed-content
> declaration.

- Explicitly confirmed in grammar drivers.
- `ContentSpecDeclaration.prototype.validate()`

### 3.3.1 Attribute Types

#### ID

> Values of type `ID` must match the `Name` production. A name must not appear
> more than once in an XML document as a value of this type; i.e., ID values
> must uniquely identify the elements which bear them.

- Explicitly confirmed in grammar drivers.
- `Element.prototype.validate()`

#### One ID per Element Type

> An element type must not have more than one ID attribute specified.

- Explicitly confirmed in grammar drivers.
- `AttdefDeclaration.prototype.validate()`

#### ID Attribute Default

> An ID attribute must have a declared default of `#IMPLIED` or `#REQUIRED`.

- Explicitly confirmed in grammar drivers.
- `AttdefDeclaration.prototype.validate()`

#### IDREF

> Values of type `IDREF` must match the `Name` production, and values of type
> `IDREFS` must match `Names`; each `Name` must match the value of an ID
> attribute on some element in the XML document; i.e. `IDREF` values must match
> the value of some ID attribute.

- Explicitly confirmed in grammar drivers.
- `Element.prototype.validate()`

#### Entity Name

> Values of type `ENTITY` must match the `Name` production, values of type
> `ENTITIES` must match `Names`; each `Name` must match the name of an unparsed
> entity declared in the DTD.

- Explicitly confirmed in grammar drivers.
- `Element.prototype.validate()`

#### Name Token

> Values of type `NMTOKEN` must match the `Nmtoken` production; values of type
> `NMTOKENS` must match `Nmtokens`.

- Explicitly confirmed in grammar drivers.
- `Element.prototype.validate()`

#### Notation Attributes

> Values of this type must match one of the notation names included in the
> declaration; all notation names in the declaration must be declared.

- Explicitly confirmed in grammar drivers.
- `Element.prototype.validate()` (first clause)
- `AttdefDeclaration.prototype.validate()` (second clause)

#### One Notation Per Element Type

> An element type must not have more than one `NOTATION` attribute specified.

- Explicitly confirmed in grammar drivers.
- `AttdefDeclaration.prototype.validate()`

#### No Notation on Empty Element

> For compatibility, an attribute of type `NOTATION` must not be declared on an
> element declared `EMPTY`.

- Explicitly confirmed in grammar drivers.
- `AttdefDeclaration.prototype.validate()`

#### No Duplicate Tokens

> The notation names in a single `NotationType` attribute declaration, as well
> as the `NmTokens` in a single `Enumeration` attribute declaration, must all be
> distinct.

- Explicitly confirmed in grammar drivers.
- Enumerations are modeled as sets.

#### Enumeration

> Values of this type must match one of the Nmtoken tokens in the declaration.

- Explicitly confirmed in grammar drivers.
- `ELement.prototype.validate()`

### 3.3.2 Attribute Defaults

#### Required Attribute

> If the default declaration is the keyword `#REQUIRED`, then the attribute must
> be specified for all elements of the type in the attribute-list declaration.

- Explicitly confirmed in grammar drivers.
- `Element.prototype.validate()`

#### Attribute Default Value Syntactically Correct

> The declared default value must meet the syntactic constraints of the declared
> attribute type. That is, the default value of an attribute:
>
> - of type `IDREF` or `ENTITY` must match the `Name` production;
> - of type `IDREFS` or `ENTITIES` must match the `Names` production;
> - of type `NMTOKEN` must match the `Nmtoken` production;
> - of type `NMTOKENS` must match the `Nmtokens` production;
> - of an enumerated type (either a `NOTATION` type or an `enumeration`) must
>   match one of the enumerated values.
>
> Note that only the syntactic constraints of the type are required here; other
> constraints (e.g. that the value be the name of a declared unparsed entity,
> for an attribute of type `ENTITY`) will be reported by a validating parser
> only if an element without a specification for this attribute actually occurs.

- Explicitly confirmed in grammar drivers.
- `Element.prototype.validate()`

#### Fixed Attribute Default

> If an attribute has a default value declared with the `#FIXED` keyword,
> instances of that attribute must match the default value.

- Explicitly confirmed in grammar drivers.
- `Element.prototype.validate()`

### 3.4 Conditional Sections

#### Proper Conditional Section/PE Nesting

> If any of the `<![`, `[`, or `]]>` of a conditional section is contained in
> the replacement text for a parameter-entity reference, all of them must be
> contained in the same replacement text.

- Via signals in grammar drivers.

### 4.1 Character and Entity References

#### Entity Declared

> In a document with an external subset or parameter entity references, if the
> document is not standalone (either `standalone='no'` is specified or there is
> no standalone declaration), then the `Name` given in the entity reference must
> match that in an entity declaration. For interoperability, valid documents
> should declare the entities `amp`, `lt`, `gt`, `apos`, `quot`, in the form
> specified in 4.6 Predefined Entities. The declaration of a parameter entity
> must precede any reference to it. Similarly, the declaration of a general
> entity must precede any attribute-list declaration containing a default value
> with a direct or indirect reference to that general entity.

- TODO: More `standalone` stuff to confirm the handling of.

### 4.2.2 External Entities

#### Notation Declared

> The `Name` [of the notation of an unparsed entity] must match the declared
> name of a notation.

- Explicitly confirmed in grammar drivers.
- `EntityDeclaration.prototype.validate()`

### 4.7 Notation Declarations

#### Unique Notation Name

> A given `Name` must not be declared in more than one notation declaration.

- Explicitly confirmed in grammar drivers.
- `NotationDeclaration.prototype.validate()`
