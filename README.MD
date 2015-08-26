[![Build Status](https://travis-ci.org/bathos/hardcore-xml.svg)](https://travis-ci.org/bathos/hardcore-xml)

# hardcore

XML and HTML parsing, editing, traversing, construction and transformation
library for node. But like, really serious about it.

<!-- MarkdownTOC autolink=true bracket=round depth=5 -->

- [Purpose](#purpose)
  - [Creating Consistent & Ready-to-Use Objects from XML](#creating-consistent--ready-to-use-objects-from-xml)
  - [Parsing XML & HTML](#parsing-xml--html)
  - [Producing XML](#producing-xml)
  - [Manipulating or Scraping HTML](#manipulating-or-scraping-html)
- [Notes](#notes)
- [Parsing](#parsing)
  - [Options](#options)
    - [Parsing Modes](#parsing-modes)
      - [Strict Mode & DTD Validation](#strict-mode--dtd-validation)
      - [Sloppy Mode](#sloppy-mode)
      - [HTML Mode](#html-mode)
    - [How Hardcore Uses DTDs](#how-hardcore-uses-dtds)
    - [Parsing Targets](#parsing-targets)
    - [External References](#external-references)
- [Transformation](#transformation)
  - [Transform to Object](#transform-to-object)
  - [Transform to JSON](#transform-to-json)
  - [Transform to XML](#transform-to-xml)
- [XML Nodes](#xml-nodes)
  - [Node Relationships](#node-relationships)
  - [Other Common Properties:](#other-common-properties)
  - [Other Common Methods](#other-common-methods)
  - [Name Properties](#name-properties)
  - [ID Properties](#id-properties)
  - [Node Constructors (Standard)](#node-constructors-standard)
    - [Attribute](#attribute)
    - [CDATASection](#cdatasection)
    - [Comment](#comment)
    - [Doctype](#doctype)
    - [Document](#document)
    - [Element](#element)
    - [Fragment](#fragment)
    - [ProcessingInstruction](#processinginstruction)
    - [Text](#text)
  - [Node Constructors (DTD)](#node-constructors-dtd)
    - [AttlistDeclaration](#attlistdeclaration)
    - [AttributeDefinition](#attributedefinition)
    - [ContentSpec Nodes](#contentspec-nodes)
      - [ContentSpecChoice, ContentSpecSequence & ContentSpecMixed](#contentspecchoice-contentspecsequence--contentspecmixed)
      - [ContentSpecMember, ContentSpecChoice & ContentSpecSequence](#contentspecmember-contentspecchoice--contentspecsequence)
      - [ContentSpecMixed](#contentspecmixed)
    - [ElementDeclaration](#elementdeclaration)
    - [EntityDeclaration](#entitydeclaration)
    - [NotationDeclaration](#notationdeclaration)
- [HTML Nodes](#html-nodes)
  - [Node Constructors](#node-constructors)
    - [HTMLAttribute](#htmlattribute)
    - [HTMLDoctype](#htmldoctype)
    - [HTMLDocument](#htmldocument)
    - [HTMLElement](#htmlelement)
    - [HTMLText](#htmltext)

<!-- /MarkdownTOC -->

## Purpose

There are a bunch of good XML parsing & transformation libraries for Node, so
the need for another is questionable. Initially, I wrote Hardcore because I
wanted a way to fine-tune XML-to-object-representation transformations without
a bunch of imperative spaghetti. Then I got kind of into it and kept going.

### Creating Consistent & Ready-to-Use Objects from XML

When converting XML to objects/JSON, you can only get so far with concepts like
the Parker convention, which provide a nice basis but cannot produce results
with a consistent structure. The most common issue concerns the inability to
discern ‘plurality’ in XML without being given outside information:

```xml
<!-- Doc A -->
<pets><cats><cat>Spottis</cat></cats></pets>

<!-- Doc B -->
<pets><cats><cat>Spottis</cat><cat>Jennycat</cat></cats></pets>
```

```js
// Translated using the Parker convention and no outside knowledge:
A = { cats: { cat: 'Spottis' } };
B = { cats: [ { cat: 'Spottis' }, { cat: 'Jennycat' } ] };

// What you (perhaps) really wanted:
A = { pets: { cats: [ 'Spottis' ] } };
B = { pets: { cats: [ 'Spottis', 'Jennycat' ] } };
```

In the section detailing `toObject()`, we’ll go into the reasons XML is horrible
in greater depth; suffice to say for now that hardcore provides a neat way to
specify additional knowledge that will impact transformation behavior, based on
*rules* made of a ‘selector’ and one or more additional options, covering cases
like the example above but also value coercions, ignoring and collapsing nodes,
renaming elements, and arbitrary additional transformations. You can think of a
rule set as a kind of interpretation schema.

### Parsing XML & HTML

Naturally, a large part of Hardcore concerns initial parsing. There’s little to
say about this since it’s just a step on your way to something else you’re
going to do. However, what’s notable is that Hardcore is pretty damn close to
being spec-compliant, at least in any way that matters and quite a few ways that
don’t -- including support for things like DTD validation, entity expansion,
and, in HTML, implicit tags and elements.

Hardcore’s parser is also a Stream. A real Stream, by which I mean not only does
it inherit from Writable, it also actually takes advantage of the point of
streaming; it doesn’t wait until it has the whole thing to start chugging away.
I point this out mainly because I’ve been surprised at how few parsers bother
with this, even among those with stream-like interfaces.

### Producing XML

After parsing, you can manipulate the resulting Document; one fairly common case
is that you’re consuming an XML resource just so you can send it back with
modifications. The `toXML()` method will convert back with any changes you made.
There are a lot of helpful methods to facilitate navigating and modifying the
Document; you may not need to convert it to a vanilla object at all.

You can also build from scratch using the Node constructors directly -- there
need not be an original Document at all.

### Manipulating or Scraping HTML

The situation is similar with HTML -- but there are additional tools, like the
ability to use CSS selectors to fetch specific elements in a familiar way. This
makes Hardcore suitable for scraping HTML without having to use easily-broken
regex patterns.

## Notes

In this documentation, default values are indicated by an asterisk. The parsing
and transformation sections constitute the real meat of the doc. The section
detailing the Node classes is largely irrelevent to most use cases, and it also
goes into excessive explanation of XML’s principles (such as they are).

## Parsing

There are a few ways to approach parsing.

If you’re consuming XML in node, it probably means you’re getting it from an
external API. In this case you’ll likely want to use the constructor directly.
It’s a writable stream, so you can pipe HTTP response bodies directly into it.

```js
const parser = new hardcore.Parser(opts);

parser.on('error', err => /* ... */);
parser.on('result', doc => /* ... */)

sourceStream.pipe(parser);
```

If you use the constructor and call `write()` directly instead of piping, you’ll
also need to call `end()` explicitly before a result event can occur. This is
because there is no way to be sure a document has ended from content alone;
there can always be more comments and processing instructions after the root
element has resolved.

If your source is a single string, it will often be more expedient to use the
`parse` method, which is just sugar over the Parser. It returns a promise:

```js
hardcore.parse(xmlStr, opts)
    .then(doc => /* ... */)
    .catch(err => /* ... */);
```

Or, if you just wish the world would stop *changing*:

```js
hardcore.parse(xmlStr, opts, function(err, doc) {
   /* ... */
});
```

There’s a catch to using the `parse` method instead of the constructor if you’re
in loose mode. In sloppy and html modes, the Parser will emit warning events
when it encounters certain malformed content that it thinks it can recover from
(in strict mode, any malformed content constitutes an error). Using the `parse`
method, you won’t be able to listen for these.

### Options

The parser takes an optional options object. On the options object, you can
specify:

 - **mode**: can be 'strict'\*, 'sloppy', or 'html'
 - **target**: can be 'unknown'\*, 'document', 'external dtd', or 'fragment'
 - **external**: an object acting as a dictionary of external references
 - **dtdValidation**: boolean; defaults to true if mode is strict; otherwise
   not available

#### Parsing Modes

##### Strict Mode & DTD Validation

> **tl;dr:** Strict mode follows the XML spec almost precisely. It does not
  forgive malformations and it aborts parsing if it encounters any.

Strict mode really is pretty strict. If the document has a DTD and dtdValidation
is on (default in strict mode, unavailable otherwise), the DTD constraints will
even be enforced. Nonetheless, there are places where hardcore diverges from the
spec:

 - Whitespace that is not part of a text node is not preserved. No idea why this
   is in the spec; it is 100% pointless and would only serve to make the result
   more difficult to navigate.

 - External references are supported, but not automatically resolved. More
   details on this later.

 - There is an upper limit on the length of an entity expansion. The XML spec
   doesn’t really specify upper limits for anything, but this one is
   particularly troublesome because it creates an attack vector. To prevent
   entity expansion attacks, Hardcore will stop once it’s satisfied that what’s
   happening is insane. You can configure this with the parser property
   `MAX_REFERENCE_LENGTH` and you could even set it to Infinity, but you really
   shouldn’t.

##### Sloppy Mode

> **tl;dr:** Sloppy mode forgives obvious-intent errors silently but emits a
  warning event when it encounters malformations that require us make less
  assured assumptions or drop data.

Sloppy mode allows all sorts of stuff that is technically not valid XML. In many
cases, the XML spec is strict about stuff that’s not really so ambiguous to a
parser. These sorts of things -- like having a space between `<?` and the target
name in a processing instruction -- are handled silently, because they’re only
‘technically’ malformations; we can assume the real intent with a fair amount of
confidence.

Other malformations are more complicated. If intent isn’t easy to discern, the
parser may have to ignore some sequence when it tries to move on. The current
node may end up being dropped from the result document, or at least will not
include everything you might have expected it to; in these situations, the
parser will emit a `warning` event, whose payload is the same `ParseError`
object that would have terminated parsing in strict mode.

Although sloppy mode is good for handling arbitrary documents, I recommend
sticking to strict mode when your data source is an API, since APIs are unlikely
to be serving malformed XML and if they are, you probably don’t actually want to
consume that data. On the other hand, you can also parse in sloppy mode and just
cancel on the first warning -- this way you get the benefit of forgiveness in
the face of obvious-intent errors, but can still be fairly confident that the
data’s integrity was not compromised.

##### HTML Mode

> **tl;dr:** Use html mode for html, always.

HTML mode is a variation on sloppy mode. HTML is not XML (except when it is).
Not only is the spec less rigid, but it also allows all sorts of crazy stuff
like implicit closing tags and implicit elements (did you know you can just omit
tons of stuff like body tags and it can still be a legal html doc, because the
parser is responsible for adding them back in where they’re considered to be
implied?).

Even if you know for sure that your document is XHTML or HTML5 that happens to
work as valid XML, you should use HTML mode because the result tree will be
built using special Nodes that have methods and properties that are specific to
HTML-related concerns, like easy accessors for standard attributes.

HTML mode and the HTML Nodes ignore DTDs but do have built-in knowledge of some
aspects of the HTML spec. Nonetheless, validation is definitely not as thorough
or accurate as that for XML.

Some stuff HTML mode takes into account:

 - the 248 additional implicit general entity definitions (e.g. `\&nbsp;`)
 - element tags that always self-close even without a slash
 - implicit open tags, implicit close tags, and implicit elements
 - allowance of attributes without values and values without quotes
 - case-insensitivity of tag names

#### How Hardcore Uses DTDs

> **tl;dr:** Nobody really uses DTDs, skip this section.

A DTD does more than define constraints for validation. In a handful of cases --
ranging from obscure to insanely obscure -- declarations will impact the actual
parsed document content. For this reason, a DTD, when present, is always parsed
and considered; it’s only the application of DTD-defined *constraints* that can
be turned on and off.

The most obvious of the ways DTDs may influence document content is through the
use of entities. Most people only ever use the the handful of implicitly defined
‘general’ entities used for character escaping, like `\&amp;`, but entities may
contain larger blocks of content.

Parsed entity refs (that includes *parameter entities* and *general entities*),
when they appear in the correct contexts, must be expanded by the parser to the
content of the entity’s definition -- the expansion is treated as if it were
part of the stream coming in (with certain constraints). For this reason, entity
expansion is a *one-way trip*. The resulting document will no longer contain the
entity reference, only its content. Similar things happen with default attribute
values.

To illustrate, given this XML:

```xml
<!DOCTYPE pizza-ml [
  <!ENTITY standardTopping "<cheese/><sauce/>">
  <!ATTLIST cheese type (mozzarella|cheddar) "mozzarella">
]>

<pizza>&standardTopping;</pizza>
```

```js
hardcore.parse(theAbove).then(doc => console.log(doc.root.toXML()))
```

...the re-XMLed pizza element will look like this:

```xml
<pizza>
  <cheese type="mozarella"/>
  <sauce/>
</pizza>
```

We no longer know that cheese and sauce came from an expansion, or that the type
attribute was supplied by the DTD. Just something to keep in mind.

Finally note that even in sloppy mode or strict mode with `dtdValidation` off, a
few validating actions may still be carried out. These pertain mainly to
attributes, and the validations will not cause errors, but may still enact some
correction. For example, a non-unique ID-typed attribute will just be dropped.

#### Parsing Targets

> **tl;dr:** You probably only need to specify a target if you’re dealing with
  a ‘snippet’ -- in this case, use `target: 'fragment'`.

The target option allows you to specify the goal production if you know it in
advance. If unspecified, hardcore will figure out on its own whether the xml
represents a *document* or an *external dtd*.

It’s wise to specify the target explicitly when you know this to be the case,
since there’s a teensy bit less overhead and it will know to emit an error if
the xml doesn’t match that expectation.

There’s a special target, *fragment*, which is not a ‘real’ parse goal in XML,
but is nonetheless pretty much universally recognized as important. Unlike the
other two, fragment cannot be automatically recognized because in some cases a
‘document’ and a ‘fragment’ could be ambiguous.

A fragment target allows any content that an element allows. That is: text,
cdata, elements, processing instructions and comments. Think of it is an element
without its own tags.

Note that an external DTD target allows all kinds of wacky shit using parameter
references that would not be legal in an internal DTD.

#### External References

> **tl;dr:** You don’t actually need this.

There are three places that an XML document / external DTD can make references
to external resources whose content may be needed in order to continue parsing.

 - **Doctype declarations:** the DTD can be a seperate file. These *must* be
   resolvable if dtdValidation is active or said dtd contains any entity
   declarations that appear later in the document.
 - **Entity declarations:** the value of the entity can be a seperate file.
   These *must* be resolvable if the document makes use of the entity somewhere,
   except if the entity is ‘NDATA,’ in which case it is always optional.
 - **Notation declarations:** a notation is always an external reference, though
   its actual value is of no interest to the parser.

Following the above, if your document contains no external references to DTDs or
non-NDATA entities, you don’t need to worry about this at all.

So how was this meant to work? Well, this was the PLEASE HACK ME era, so the IDs
for the external files are URIs; the parser is supposed to fetch a file from the
local file system or the internet. Don’t worry, hardcore isn’t going to start
probing your file system or sending random http reqs out into space just because
a document was like ‘hur de durr, go get this’. Instead hardcore lets you
provision them explicitly if you need to.

The `external` object is a hash where the keys are system or public IDs (URIs)
and the values are the data they refer to. Generally, the value will be a string
of XML (which might be a snippet in the case of entities) but for NDATA entities
it can be anything; for example, for an image reference you might supply a
Buffer. NDATA refs that appear in the doc will be represented by a special Node,
and if you supplied the value it will contain it, but this is totally optional.

Notation declaration IDs are never actually used by the parser, so there’s no
point to adding these to your `external` object.

## Transformation

You can transform the resulting document (or any node therein) with:

 - `toObject()`
 - `toJSON()`
 - `toXML()` / `toString()`

### Transform to Object

### Transform to JSON

The `toJSON()` method takes all the same options as `toObject()`.

### Transform to XML

After modifying the content of a document (or if you’ve constructed one from
scratch) you may wish to convert back to an XML string. This is a lot simpler
than `toObject` but there are still a few of options you can use to customize
the XML:

 - `d`: Integer, defaults to zero. Mainly for internal use; it indicates the
   indentation depth.
 - `pretty`: Boolean, defaults to true. Influences whitespace handling.
 - `quote`: May be " (default) or '. This sets the preferred quote delimiter for
   use with attribute values, system IDs, etc. Note that it is ‘preferred’
   because of obscure cases where the content of an external ID may permit only
   one or the other delimiter.
 - `tab`: A string to use for indentation. Defaults to two spaces. The value
   must contain only legal XML whitespace characters.
 - `withNS`: Boolean (‘with namespaces’), defaults to true.

The `pretty` option will cause attractive and consistent whitespace, but you
should note that in so doing it is really modifying content. The affected nodes
are Text, Comment and CDATASection. Whitespace is normalized and overly long
lines get formatted into consistent-width columns that respect indentation
level. If a Comment or CDATASection has no non-whitespace content, it’s omitted.

There are exceptions for certain HTML elements as well as elements that possess
the appropriate xml:space attribute -- these always have their original
whitespace preserved. Further, the HTML elements script and style will have
their content formatted appropriately for ES and CSS respectively. 

The `toXML()` method will *refuse to generate invalid XML*. If the node on which
the method or any of its descendents was called is in an invalid state, it will
throw a MalformedError. This error will tell you (usually quite precisely) what
is wrong.

There are exceptions to the above. With `pretty` true, HTMLAttribute nodes that
have no value will use the shorter syntax that is permitted there.

While entity escaping is applied wherever *needed*, it is never applied where it
is not needed. Thus, for example, an attribute value containing a double quote
will only have the character converted to an entity reference if the delimiter
is a double quote.

In the case of HTML text, certain additional entity escapes are used despite not
technically being required (none of the characters HTML covers with escapes are
actually needed, since it’s not 1998 anymore). The exceptional cases are
whitespace and zero-width characters like \&nbsp; since it is helpful to
highlight their existence given their invisible / ambiguous glyphs.

## XML Nodes

All Node constructors are exposed at `hardcore.nodes`. You can use the
constructors to create documents from scratch or to add to existing documents.

There are a number of properties and methods shared by all nodes. Some, like
‘children’, never make sense on a Node like Comment, but are available
nonetheless so that there’s a predictable interface.

All properties that accept arbitrary text values, like name and content, are
broadly restricted to those characters which are legal in XML in addition to any
more specific constraints detailed below. That means pretty much anything except
control characters, orphaned surrogate codepoints, etc -- the usual suspects.
Occurences of such characters not cause an error, but they will be stripped.

### Node Relationships

Nodes that have children are themselves array-likes. All array methods except
for two that are inapplicable (copyWithin and fill) are available. Since neither
subclassing Array nor Proxy is yet available, the solution currently used to
maintain relationships while allowing normal array interactions is a bit
hackish. There are two things unsupported: children numbering over 16384 (yes, I
did what you think, I’m sorry, but it’s just the one prototype ;_;) and deleting
array indices (which would be weird anyway).

> Two important notes about children:
  1. It is possible to set an index to null/undefined (or to splice in such
  values, etc), but the array will self-correct to *never be sparse*. Thus it is
  inadvisable to remove members in an index-based loop.
  2. Nodes with children only allow *certain* children. Legal children are
  indicated in the descriptions below, but for the most part these restrictions
  are obvious (e.g. an Element may contain Text but a Document cannot).

Relationship properties:

 - `children`: An actual array of the node’s children. 
 - `parent`: The parent node, if applicable.
 - `document`: The document node (root ancestor), if applicable.
 - `siblings`: Array of nodes with the same parent, excluding the current node.
 - `prevSibling`: The node immediately preceding the current node.
 - `prevSiblings`: Array of all nodes preceding the current node.
 - `nextSibling`: The node immediately following the current node.
 - `nextSiblings`: Array of siblings that follow the current node. 

Relationship iterators:

 - `* ancestors()`: Iterates from parent node to root node.
 - `* descendents()`: Iterates in generations, left-to-right, top-to-bottom.
 - `* descendentTree()`: Iterates by walking top-to-bottom, left-to-right.

Relationship methods:

 - `findAncestor(predicate)`: Finds nearest ancestor matching predicate. 
 - `findAncestors(predicate)`: Finds all ancestors matching predicate.
 - `findChild(predicate)`: Alias for `find`.
 - `findChildren(predicate)`: Alias for `filter`.
 - `findDescendent(predicate)`: Finds nearest descendent matching predicate.
 - `findDescendents(predicate)`: Finds all descendents matching predicate.
 - `remove()`: Splices the node out of its parent.

### Other Common Properties:

 - `text`: Access the text content of this and all descendent nodes as a single
   string. Text content is that found in Text and CDATA nodes. This accessor can
   be useful for lots of things, but the most obvious is regex search of a
   document’s content without worrying about false-positives from markup:
   `document.text.match(somePattern)`.
 - `preservesWS`: A boolean indicating whether whitespace is explicitly
   preserved in this node and its children.

The `preservesWS` property means the node itself or one of its ancestors had the
xml:space attribute set to 'preserve' or was an HTML element that implies such
preservation (pre; but also script and style to be friendly). The xml:space
attribute will be respected even if the attribute was not declared, a minor
divergence from spec.

In the case of Element nodes, `preservesWS` is also settable (boolean): it’s
shorthand for adding or removing the attribute with a value of 'preserve' (true)
or 'default' (false).

### Other Common Methods

 - `clone()`: Returns a fresh duplicate of the current node. Note that if you
   want to use the same node in two places, you *must* clone it; a single node
   will only ever have a single parent and index.
 - `toJSON(opts)`: Takes the same options as `toObject`.
 - `toObject(opts)`: Detailed in the section on transformation.
 - `toXML(opts)`: Details in the section on transformation.
 - `isSelfValid()`: *Throws* if node is not valid -- details below.
 - `isValid()`: Returns a boolean indicating whether the node and all its
   descendents constitute valid XML.

The `isSelfValid()` method is mainly intended for internal use. It only
validates the ‘immediate concerns’ of the node it is called on -- that is, the
constraints outlined in the detailed descriptions of the Node constructors
below, but not the concerns of its children. I’m documenting it because its
error messages are considerably more useful that a `true` or `false`.

### Name Properties

Note all nodes are named, but enough are that it seems preferable to note the
following properties here:

 - `name`: The name of a node (Element, Doctype, etc).
 - `nom`: The name of a node, but with the namespace prefix (if any) removed.
 - `ns`: The namespace prefix of a node, if applicable.

Hardcore isn’t really namespace-aware. Colons are legal characters anywhere in a
node name, which could make things weird. The `nom` and `ns` getters/setters are
just more abstract ways to get/set `name`.

There are restrictions on valid name characters -- see the XML spec for full
details. On the whole it’s probably more permissive than one might expect. If
set to a value containing invalid characters, though, they will be stripped.

### ID Properties

A number of DTD-related nodes have the properties `systemID` and `publicID`.
These indicate the location of an external resource (see the section on parsing
for details on how to allow hardcore to resolve external resources). Excepting
the case of NotationDeclaration, the existence of `publicID` necessitates that
there also be a `systemID`.

Both of these properties have unique rules for what characters are permitted in
their values. As with `name`, characters that are illegal will be stripped;
despite being quoted, entity references are not permitted.

### Node Constructors (Standard)

Node properties are settable at instantiation as properties of an optional
options object. In the case of Comment, CDATASection and Text, the options
object can be replaced by a string, which is the same as `{ content: string }`.

Any node that may possess children can be supplied an array of child nodes at
instantiation (`{ children: [] }`); this will not be mentioned again below.

#### Attribute

An Attribute, which is not actually a node (xml concept) but is sort of a Node
(hardcore class), represents a single key-value ‘property’ of an Element.

Options/properties:

 - `name`/`nom`/`ns`: The attribute key.
 - `key`: An alias for `name`, if you prefer.
 - `value`: The attribute value.

An attribute value without a corresponding DTD definition can be any text (if
converting back to XML, illegal literal characters will be escaped with entity
references), though appropriate whitespace normalization rules which are always
automatically applied.

For attributes with DTD definitions that declare a type other than 'cdata',
different normalization will apply when setting, to ensure the value matches a
valid production for that type.

If an attribute is defined as having a fixed value, it will automatically always
have the correct value, which cannot be changed.

Other properties:

 - `definition`: The corresponding AttributeDefinition node, if applicable. If
   the element was defined but the attribute was not, returns `null`; if both
   are undefined, returns `undefined`. 

Other methods:

 - `escape(delim)`: Returns the attribute value, but escaped using entity
   references. Delim default: ".

The `escape` method returns a value like the Text node’s `escaped` property, but
it’s a method because you can specify which string delimiter. The delimiter is
not part of the returned value; rather this indicates that instances of the
delimited character also need to be escaped (can be " or ').

**Parentage**

An Attribute cannot be the ‘child’ of any node in the usual sense, but they will
have a parent (Element). Unlike regular children, an Element’s attributes can
only be accessed, added, modified or removed using methods of Element.
Attributes collectively do not have a sequence (in theory) and are not modeled
as an array.

Because of this special relationship, you will likely never have a reason to use
the constructor directly. In the case of HTMLElement, you don’t even need to use
the methods: known html attributes will be gettable and settable as direct
properties of Element (e.g. `elem.id = 'xyz';`).

**Validity**

Without a DTD, an attribute can never enter an invalid state. With a DTD, there
may be constraints on the value.

 - If an attribute’s definition type is IDREF or IDREFS, there must be
   corresponding ID values elsewhere in the document.
 - If an attribute’s definition type is ID, its value must be unique among all
   ID-type attributes in the document (not just among its own kind).
 - If an attribute’s definition type is ENTITY or ENTITIES, each value must
   correspond to an EntityDeclaration’s name, and the entity must have the type
   ‘unparsed’.
 - If an attribute’s definition type is enumeration or notation, the value must
   match one of the enumerated values.
 - If an attribute’s definition type is notation, the value must also correspond
   to a NotationDeclaration name.
 - If an attribute’s definition type is anything other than CDATA, and it does
   not specify a fixed or implicit default value, it must be a non-empty value.

An attribute cannot enter an invalid state. Like other named nodes, it requires
a name to be valid, but unlike the others, the name can not even temporarily
be absent. Setting `name` to an empty string, `null` or `undefined` -- which is
permitted in other cases -- will throw for an attribute, because of its unique
relationship with its parent Element.

#### CDATASection

CDATA is the term used in the XML spec to refer to what humans call ‘text’. It’s
short for ‘character data’. Really, CDATA *sections* are just a subtype of the
Text node (which might have been called CDATA itself); they differ in that by
possessing delimiting markup, there is no ambiguity about characters like
less-than (which would normally begin some other node) or ampersand (which would
normally begin an entity reference).

```xml
<![CDATA[ Here’s an &, and a < too. ]]>
```

Because CDATA sections are just text, preserving their identity as ‘different’
is done only for the sake of fidelity when using `toXML()`. However, when using
`toObject()`, CDATASection and Text become (somewhat) interchangeable.

Options/properties:

 - `content`: The text being escaped by this section.

A CDATA section cannot contain the sequence ']]>' and it cannot be escaped. If
the content is set to a value containing this sequence, it will be replaced with
']] >'.

**Parentage**

CDATA sections can appear only as children of Element.

**Validity**

A CDATA section cannot enter an invalid state.

#### Comment

An xml comment takes the form `<!-- comment -->`.

Options/properties:

 - `content`: The text of the comment.

A comment cannot contain the sequence '--' or end with '-'; neither can be
escaped. If the content is set to a value containing either, spaces will be
added where necessary to ensure validity.

**Parentage**

Comments can appear as children of Document, Element, or Doctype.

**Validity**

A comment cannot enter an invalid state.

#### Doctype

A Doctype (doctype declaration) is the one declaration that can occur as a
direct child of Document; all other declarations are its children, including
those which got ‘imported’ from an external resource.

At its simplest, a Doctype simply has a name (which must match that of the root
Element of the Document): `<!DOCTYPE html>`.

The *doctype definition* (DTD) may be omitted (as above), provided as an
external reference by way of a ‘system ID’ (‘external DTD’), or inlined in the
doctype declaration itself inside square brackets (‘internal DTD’). It can also
be a combination of internal and external DTDs.

During parsing, there are actually different rules for interpretting the content
of an external DTD vs an internal DTD, but in the end it all winds up in the
same place. Thus external DTDs are one of the handful of ‘one way trips’ that I
will point out -- cases where converting back with `toXML()` will yield a
document with material differences from the original parsed XML.

If a Doctype specifies both external and internal DTDs, the external DTD is
read first (if possible -- see the section on parsing for details on how to
provide access to the external DTD content; it’s not automatic) and the internal
DTD is read second. While a given DTD cannot declare anything more than once
(except Attlist / attribute definitions), *two* can, and the internal
declaration ‘wins’.

Options/properties:

 - `name` / `nom` / `ns`: Doctype name.
 - `publicID`: A public URI indicating the location of the DTD.
 - `systemID`: An internal URI indicating the location of the DTD.

Note that the content of an external DTD will be subsumed by or as the internal
DTD (which constitutes the children of the Doctype).

Additional properties:

 - `idAttributes`: An array indicating which attributes are ‘ID’ attributes.
   The format is `[ { element: 'name', attributes: [ 'key' ] }, ... ]`.

Additional methods:

 - `elementDefinition(name)`
 - `entityDefinition(ref)`
 - `notationDefinition(name)`

These three methods are present mainly for internal use; they facilitate
validation. They are aliased on the Document node as well.

Each returns the definition (if it exists) from the DTD. Note that the entity
method expects the full reference (e.g. `\&name;`), unless it’s an unparsed
entity. If there are multiple definitions for one thing, only the first will be
returned.

The element method differs a bit; it does not return the actual declaration
node. The returned value has all the properties of the declaration (if it
existed) plus three more:

 - `attr`: An array of attribute definitions pulled from corresponding Attlists.
 - `required`: A set of attribute names that are required.
 - `defaults`: A map of attribute names : default values.

If there was no element declaration but there were corresponding attribute
definitions, there will still be a return value, though you will be able to tell
the element decl was missing because it will lack the 'name' and other
properties of a real ElementDeclaration.

**Parentage**

A Doctype may only appear as the child of a Document.

**Children**

A Doctype may contain the four Declaration nodes, Comment, and
ProcessingInstruction. Note that INCLUDE conditional sections are ‘flattened’ in
the result, and IGNORE conditional sections are, of course, ignored -- another
one-way trip.

**Validity**

 - A Doctype must have a name.
 - If PublicID is present, SystemID must also be present.
 - Declarations for Elements, Notations and Entities must have unique names.
   (Attlist may appear any number of times, as may individual attribute
   definitions, though only the first definition applies).
 - Only one attribute definition per element may have the type 'notation'.

#### Document

The *Document* node is the root production of XML. Note that hardcore does not
consider xml declarations themselves to be nodes, but rather properties of the
document (this works because the xml declaration has a singular possible
position).

Options/properties:

 - `encoding`: The document encoding. Defaults to 'UTF-8'.
 - `standalone`: If true, indicates that no external declarations are needed to
   interpret the document. Defaults to false, which only means ‘maybe they are’.
 - `version`: The xml version. Defaults to 1.0.

Additional properties:

 - `doctype`: The doctype node, if present, from among the document’s children.
   If assigned to, this will either overwrite the existing doctype or insert it
   before all other children.
 - `root`: The element node, if present, from among the document’s children. If
   assigned to, this will either overwrite the existing root element or append
   it after all other children.

Additional methods:
 - `elementByID(id)`: Returns an element by its ID, which means it has an
   attribute of the type ID -- though this will also work with HTML’s ‘id’.
 - `elementDefinition(name)`: Shortcut to method on Doctype (details there)
 - `entityDefinition(ref)`: As above.
 - `notationDefinition(name)`: As above.

**Parentage**

A Document cannot have a parent.

**Children**

A Document may contain Doctype, Element, Comment, and ProcessingInstruction.

**Validity**

 - If encoding or standalone is present, version must also be.
 - There must be zero or one Doctype child.
 - There must be exactly one Element child.
 - The Doctype child, if present, must precede the Element child.
 - The Doctype child, if present, must have the same name as the Element child.

#### Element

An *Element* node is the sort people care about. In addition to children, it may
have *Attributes*.

Options/properties:

 - `name` / `nom` / `ns`: Element name.
 - `attributes`: See below.

When an `attributes` option is supplied at construction, or when setting to it,
you may supply previously created Attributes in an array or set, or you may
supply an Object or Map of attribute keys-value pairs.

Accessing the `attributes` property on the Element returns an array, but like
`children`, this is just a view, not the underlying collection. Use the methods
outlined below to alter the actual set of attributes.

Attribute sequence is not meaningful in XML. If stringified to XML with the
`pretty` option, attributes will be ordered alphabetically; otherwise, they will
be ordered as originally assigned.

If `text` is supplied as an option, this is shorthand for creating a single text
element as the child of the element. It cannot be used alongside the `children`
option.

Additional properties:

 - `definition`: The definition, if any, of this element and its possible
   attributes, derived from the DTD of the document the element belongs to.
   See the notes on Doctype for more information about the data format.

Additional methods:
 - `getAttribute(name)`: Returns an Attribute.
 - `getAttributeValue(name)`: Returns the value of an attribute.
 - `setAttributeValue(name, value)`: Sets the value of an attribute. Will create
   a new Attribute if needed.
 - `removeAttribute(name)`: Removes an attribute.

**Parentage**

An element may be the child of Document or Element.

**Children**

An element may contain Element, CDATASection, Text, Comment, and
ProcessingInstruction.

**Validity**

 - An element must have a name.
 - If the document to which the element belongs has a DTD, validity of may be
   determined by the content spec in the ElementDeclaration and any
   corresponding AttlistDeclarations that define required attributes.

#### Fragment

Fragment is not a real XML node or even concept, but it’s a common conceit for
representing a portion of a larger document. In our version, which may differ
from other takes, it’s essentially a nameless Element -- just the children.

**Parentage**

A fragment cannot have a parent.

**Children**

Same as Element.

**Validity**

By its nature, Fragment can never be invalid.

#### ProcessingInstruction

Options/properties:

 - `target`: The target (e.g. 'php') of the instruction.
 - `instruction`: The text intended for interpretation by the processing target.

The target of a processing instuction cannot be 'xml' (case insensitive). If
set to 'xml', the assignment will be ignored. A target must be a valid name.

The instruction of a processing instruction cannot contain the sequence '?>' and
it cannot be escaped. If set to a value containing this, it will be converted to
'? >'.

**Parentage**

A ProcessingInstruction may be the child of Document, Doctype, or Element.

**Validity**

 - A ProcessingInstruction must have a target (instruction is optional).

#### Text

Options/properties:

 - `content`: The text itself.

Other properties:

 - `escaped`: The text content, with entity escapes (read-only).

Text, called CDATA in XML, may not contain '<', '&' or the sequence ']]>'
directly, though all of these are fine in hardcore because they can be escaped
as entities, and indeed since entity references are expanded during parsing,
internally, the real characters are stored (and flipped back, only when really
needed, when `toXML()` is called).

Entity references when setting the content on the Text node directly are a
little trickier. Character references (e.g. \&#xb6;) will always get translated.
So too will the inherent entities like \&amp;, and, if the text node is a
descendent of an HTMLElement, extra entities like \&Aacute; will be unpacked
too. But entities defined in the DTD cannot be expanded in this case because
they may contain markup and there’s no reasonable way to handle parsing it
after the fact. Thus a sequence like '\&kittens;' will be treated as if it had
been '\&amp;kittens;'.

**Parentage**

Text may occur as a child of Element.

**Validity**

Text cannot enter an invalid state.

### Node Constructors (DTD)

All of the nodes in this section may appear only as children of Doctype. Note
that the parser merges and flattens declarations from external DTDs and
included conditional sections into a single DTD, meaning the use of an external
DTD is a one-way trip: if `toXML()` is used, those portions will be included
unless you remove them first.

#### AttlistDeclaration

An AttlistDeclaration contains a list of zero or more attribute definitions for
a given Element. These are modeled seperately as AttributeDefinitions, so unlike
the other declarations, this node has ‘children’.

Options/properties:

 - `name`/`ns`/`nom`: The name of the element whose attributes are to be
   described.

**Children**

AttlistDeclaration may contain AttributeDefinition.

**Validity**

 - Must have a name.
 - For other concerns, see AttributeDefinition, which contains the bulk of an
   AttlistDeclaration’s content.

#### AttributeDefinition

Attribute definitions are not ‘real’ nodes; rather they are the individual
entries that may appear in an AttlistDeclaration. Each describes an attribute
belonging to the Element specified in the parent AttlistDeclaration.

The syntax is a bit unusual in that although an AttlistDeclaration, true to its
name, will often comprise a list, the individual members have no delimiters.
Presented in its most minimal form, a multi-definition ATLD is difficult to
read, so when converting to XML with `pretty` active, (multiple) definitions
will use whitespace to create columns for readability, like so:

```xml
<!ATTLIST something
  poop                 CDATA                          #REQUIRED
  magic                (white|black|blue|red|time)    "black"
  image-type           NOTATION (jpeg|gif)            "jpg">
```

Options/properties:

 - `name`/`ns`/`nom`: The key of the attribute.
 - `key`: Alias for `name`.
 - `type`: The *type* of an attribute determines how the value will be
   interpreted, normalized, and/or constrained. Valid values are cdata*, id,
   idref, idrefs, entity, entities, nmtoken, nmtokens, enumeration, or notation.
   Case insensitive.
 - `enumeration`: A set holding a whitelist of permitted values, each of which
   must be an ‘nmtoken’ if the `type` is ‘enumeration’ or ‘name’ if the `type`
   is ‘notation’. If the type is anything else, this property is ignored.
 - `defaultType`: The *default type* of an attribute determines what will occur
   when the attribute is absent. Possible values are required, implied*, fixed,
   or implicit.
 - `defaultValue`: If the *default type* is fixed or implicit, there should be
   a default value, which follows the same rules as an attribute value
   (including any constraints which follow from `type`).

This is not terribly straight-forward. First, let’s address `type`.

 - **cdata**: This is the only type ever used in the real universe. It means the
   attribute’s value is text content -- any text content -- though newlines and
   tabs are still be normalized to standard space characters. In a document
   without a DTD all attributes are cdata attributes.
 - **id**: An ID-type attribute is expected to match the ‘name’ production (like
   an element name). All ID attributes appearing in a document must have unique
   values. This uniqueness is not per element/attribute; rather, all such
   attributes share a common ‘pool’. In html, we treat the `id` attribute as
   being of this type, though that may be slightly inaccurate technically.
 - **idref**: An ID-referencing attribute is one whose value must match that of
   some ID-attribute also appearing in the document. As such it must also match
   the ‘name’ production.
 - **entity**: This really means *unparsed* entity. If you were wondering how
   unparsed entities are ever actually used, this is it -- the one way. Unlike
   parsed entities, the reference is not delimited with any special characters,
   but it must match an existing unparsed entity’s name.
 - **nmtoken**: Unlike id, idref and entity, nmtoken does not impart any
   semantic meaning to the attribute; it only constrains the valid value. The
   nmtoken production is a slightly more lax version of the name production. One
   may think of it as saying ‘the value must be a single word’.
 - **idrefs/entities/nmtokens**: These plural variants are like their
   counterparts described above, but they are space-delimited lists. Each member
   of the list must match name, name, and nmtoken productions respectively.
   Unlike cdata, whitespace here is not only normalized to regular space, it is
   collapsed to a single space, and trimmed. The html attribute `class` is
   treated as being of the type `nmtokens` in hardcore, except that it also
   permits an empty value (normally invalid).
 - **enumeration**: An enumerated attribute is one whose valid values have been
   explicitly listed. This is done in the `enumeration` property. Unlike the
   above values, the word ‘enumeration’ is not actually a keyword in XML. This
   is effectively a subtype of ‘nmtoken’ since the enumerated values must also
   match that production. Note that there is no ‘plural’ version of this, a
   mysterious omission.
 - **notation**: Notation attributes are also enumerated -- these too must have
   values in the `enumeration` list. The values must be ‘names’ and they must
   have corresponding NotationDeclarations. Note that for any one element, there
   may be a maximum of one attribute of this type.

The `enumeration` property, used when the `type` is ‘enumeration’ or ‘notation’,
is a modified Set that accepts only values matching the production appropriate
to the type. Therefore you can use the methods `add()`, `delete()`, and `has()`
as well as the property `size` to interact with it. However, if you set to the
property directly (or supply it as an option during instantiation), any iterable
containing valid strings is acceptable.

If you change the type from enumeration or notation to the other, or to anything
else, the value of `enumeration` will be reset (because its legal content
changes as a result).

The `defaultType` property is the oddest. Actually it’s a straight-up shitshow.
I’m afraid it’s a poor name (though in xml it’s no better: ‘default
declaration’) since some options, like 'required', really have nothing to do
with default values except by way of being exclusive of their existence.

 - **required**: This means there is no default value, and the attribute must
   always be explicitly included.
 - **implied**: Do you know what ‘implied’ means? Like, in English? Well put
   that knowledge away for the moment, because some RFC motherfucker *did not*,
   and boy was my time wasted on my way to realizing this. The ‘implied’ default
   declaration **does not in any sense mean that the default value is implied**.
   It means there is *no default value* and the attribute is *not required*.
   Amazingly, English does have a *super-obscure* word to describe this
   *incredibly unsual* condition: OPTIONAL. The word you were looking for was
   OPTIONAL you fucking shitbags.
 - **fixed**: This means there *is* a default value, but that value isn’t
   actually a default value at all. Rather, it is the only legal value, and the
   attribute is required. I cannot imagine why this exists.
 - **implicit**: Unlike the others, this is not an actual XML keyword; it
   represents the absence of one. This means there *is* a default value, and
   the default is used when the attribute is absent. In other words, this
   attribute is one whose default value is *implied*. (That word was taken.)

The `defaultValue` is used when the `defaultType` is fixed or implicit. (In the
former case, it does not actually mean ‘default’ except in some Orwellian
sense.)

Other methods:

 - `escape(quote)`: Same as Attribute’s escape method, but for the default
   value.

**Validity**

 - If there is a defaultValue, it must be valid according to its type and (if
   applicable) its enumeration.
 - If defaultType is 'fixed' or 'implicit', there must be a defaultValue.
 - If defaultType is 'required' or 'implied', there cannot be a defaultValue.
 - If the type is 'enumeration' or 'notation', the enumeration set cannot be
   empty.
 - If the type is 'notation', the enumeration must contain one or more names
   that must correspond to existing NotationDeclarations.
 - If the corresponding element declaration has the contentSpec 'empty', the
   type cannot be 'notation'.

Some of the validity constraints are really automatic; for example, if you have
enumeration values but the type is not an enumerated type, the values will
be ignored, but will not cause an error. And of course most validation takes
place through normalization in the setters, though changing lots of properties
could make stuff go weird. Be sure to set type, defaultType and enumeration
values (if applicable) *before* setting a defaultValue.

Congratulations, I guess, if you’ve read this far. Go back now though. Honestly
it’s only going to get worse. There’s a reason nobody uses DTDs.

#### ContentSpec Nodes 

There are four, and they will be explained as a group:

 - ContentSpecChoice
 - ContentSpecMember
 - ContentSpecMixed
 - ContentSpecSequence

About half of all the complexity in the XML spec belongs to one tiny thing: the
content spec portion of an ElementDeclaration.

The content spec describes the permitted elements and text and their permitted
sequence for the ElementDeclaration to which it belongs. Instances of CSChoice,
CSMixed and CSSequence are all valid values for an ElementDeclaration’s
contentSpec property, alongside two string values ('empty' and 'any'). In the
case of CSChoice and CSSequence, the spec can be a hierarchy whose terminal
(‘leaf’) nodes are instances of ContentSpecMember, which is what necessitates
this complexity.

All of these possess a `quantifier` property that determines how many times a
given item may repeat, though it is *not settable* on ContentSpecMixed (the
quantifier for a mixed CS is always derived from its content).

Hardcore permits non-deterministic content-specs. These are discouraged by the
XML standard but the constraint is suggested in a non-normative appendix.

##### ContentSpecChoice, ContentSpecSequence & ContentSpecMixed

These three are all node-arrays.

Choice and Sequence may contain *Choice, Sequence, or Member*, and may not be
empty. Mixed may contain *Member*, and may be empty.

##### ContentSpecMember, ContentSpecChoice & ContentSpecSequence

Common option/property:

 - `quantifier`: May be '?', '+', '*' or absent (default). These have their
   usual EBNF / regexy meanings.

Option/property (ContentSpecMember):

 - `name/nom/ns`: The element name.

**Children: ContentSpecChoice & ContentSpecSequence**

These may contain ContentSpecChoice, ContentSpecSequence, and ContentSpecMember.

**Validity**

 - ContentSpecChoice and ContentSpecSequence must contain at least once child.
 - As a corollary of the above restriction, choice and sequence trees must
   always have ContentSpecMembers as ‘leaves’.
 - The names of ContentSpecMembers must have corresponding ElementDeclarations.
 - A content spec must be *deterministic*, meaning that no two ‘choices’ may
   begin with (after unpacking) the possibility of the same element. Jesus
   christ, why am I bothering with this.

##### ContentSpecMixed

This indicates that an element may contain CDATA, and it may also indicate
permitted elements, but cannot enforce a particular sequence.

Unlike CSChoice and CSSequence, CSMixed is always ‘flat’, and its quantifier
property is read-only (since its value is implicit based on its content). Its
children are all ContentSpecMembers but their quantifiers are suppressed (they
cannot have any, but if present they will be ignored and no error will be
thrown).

Property:

 - `quantifier`: Getter only. Will be '' if there are no children, '*' if there
   are.

**Children**

The children of ContentSpecMixed are strings (not nodes!) that are valid names.

**Validity**

 - The names in ContentSpecMixed must have corresponding ElementDeclarations.

The requirement that the same element name not appear twice is handled
automatically since the internal model is a set.

#### ElementDeclaration

An element declaration defines the content constraints of an element. These
are used for validation, but do not impact document content.

Options/properties:

 - `name/nom/ns`: The element name.
 - `spec`: May be 'any'\* or 'empty' (case insensitive) or an instance of
   ContentSpecMixed, ContentSpecChoice, or ContentSpecSequence.

Other methods:

 - `isContentValid(elem)`: Validates a given element against this declaration’s
   content spec. Mainly for internal use; like `isSelfValid()`, this will
   *throw* a MalformedError when the answer is ‘no’.

**Validity**

 - Must have a name.
 - See the ContentSpec classes for all this crazy shit.

#### EntityDeclaration

An entity declaration defines one of several types of entity that can be
referred to in the document in various places. These are the types of entities:

 - Parsed
   - General
   - Parameter
 - Unparsed

A *parsed* entity has a value that is a string of XML content that will be
situationally interpretted as if it were part of the document where the entity
is referred to. An *unparsed* entity can be used as an abstract reference to a
resource that is not part of the xml.

A *general* parsed entity is one that may appear in Elements or (some) quoted
values, as of Attributes. Its expansion (value) can be text or markup. A
reference to a general entity looks like `\&name;`.

A *parameter* parsed entity is one that may appear in an internal or external
Doctype, though the rules differ in each case. When appearing internally, a
parameter entity is only valid at the ‘top’ level -- it must expand to whole
declarations or other legal children of Doctype. In an external DTD, however,
parameter references can occur ‘inline’ in declarations, supplying one or more
parts -- for example, it might be referred to to supply just the name in an
ElementDeclaration. There are additional rules governing its boundaries that are
a bit tough to summarize. A reference looks like `%name;`.

An unparsed entity has no reference syntax like parsed entities. References only
appear as occurences of the entity’s name in Attribute values of the type
'entity' or 'entities' (and the AttlistDeclaration that declared it as such).

During parsing, parsed entities get expanded, and it’s a one-way trip. On
converting back to XML with `toXML()`, document content that was derived
originally from entity references will now be explicit; there’s no other
reasonable behavior for a variety of reasons I probably don’t need to list.
Therefore hardcore is not concerned with entity declarations (for the most part)
once parsing has concluded.

Options/properties:

 - `name`: The entity name. 'nom' and 'ns' do not apply.
 - `systemID`: A system ID if the value is external.
 - `publicID`: A public ID extending systemID.
 - `type`: May be 'general'*, 'parameter' or 'unparsed'.
 - `value`: The value of the entity.
 - `ndata`: The name of a notation.

Note that while `value` and `systemID` are exclusive of each in XML, hardcore
will include `value` for any resolved external entity; on conversion back to
xml with `toXML()` this will not cause an error, because the ID will be used and
the value will be ignored.

Because unparsed entities can ‘be’ anything, so to can `value`. However, to be
valid for flipping back to XML, a non-string value must have a corresponding
external ID.

Other properties:

 - `symbol`: The reference string, e.g. \&amp; for the entity "amp".

Other methods:

 - `escaped(quote)`: For parsed entities, this returns `value` with appropriate
   entity-escaping for the specified delimiter.

**Validity**

 - Must have a name.
 - If `publicID` is present, `systemID` must be present.
 - If the type is `unparsed`, `ndata` must be present.
 - If the type is `unparsed`, `systemID` must be present.
 - If `ndata` is present, it must refer to a notation that was declared.

#### NotationDeclaration

A notation declaration is closely tied to the above description of unparsed
entities. It identifies a resource type and its intended target -- for example
it might say the notation "JPG" and provide the path to, I don’t know, mspaint.
The notation names are referred to in unparsed entity declarations as ‘ndata’
and also may appear in the value enumeration of attribute definitions of the
type 'notation'. Realistically, this is not a thing anyone has ever used or ever
will.

Options/properties:

 - `name`: The notation name. 'nom' and 'ns' do not apply.
 - `systemID`: A system ID (location of the target application).
 - `publicID`: A public ID (same).

**Validity**

 - Must have a name.
 - Must have one or both of `systemID` and `publicID`. Note this node is unique
   in that it can have a publicID *without* a systemID.

## HTML Nodes

When parsing in html mode or constructing HTML documents manually, certain nodes
have specialized counterparts for this purpose to account for various
differences in behavior and validity. In the case of HTMLElement, there are also
a number of special accessors and methods added.

Perhaps the most important difference between HTML and XML is that tag names are
case insensitive in HTML, and conventionally are normalized to lowercase.

Altogether, hardcore’s handling of HTML is *not* terribly spec-faithful, but it
probably covers more ground than is necessary anyway, and the divergences are
cases where we are more, not less, permissive.

### Node Constructors

The HTML nodes inherit from the corresponding XML node classes, so we won’t
repeat all the details here, but will only explain the ways in which they
differ.

#### HTMLAttribute

HTMLAttribute differs in that when converted back to HTML, empty values will be
in compact syntax (depending on doctype), e.g. `<input required>`. It also uses
similar treatment of entity escapes to HTMLText (see below).

#### HTMLDoctype

HTMLDoctype always has the name 'html'. It knows what system IDs are valid and
these values may determine how hardcore treats the document. It cannot have
children.

Unlike an XML doctype, it is possible to have a public ID without a system ID.
I do not understand this, since the doctypes to which this applies are both
XHTML!

#### HTMLDocument

HTMLDocument differs in that it permits HTMLDoctype and HTMLElement in place of
the regular Doctype and Element nodes.

Like Document, HTMLDocument has the `elementByID()` method, but unlike Document
it simply looks for the element with the matching 'id' attribute, not an
attribute whose *type* was specified as ID by a DTD. Much simpler!

Additional methods:

 - `select(selector)`: Find elements by css selector string.

Holy shit! Yeah, you can do that.

 - *, >, +, ~, ","
 - element, #id, .class
 - :first-child, :last-child, :nth-child(), :nth-last-child(), :only-child
 - :first-of-type, :last-of-type, :nth-of-type(), :nth-last-of-type(),
   :only-of-type
 - :not()
 - :empty
 - [attr="val"], [attr*="val"], [attr~="val"], etc; :lang()

Naturally, ‘stateful’ selectors are not included (e.g. :hover, :checked).

#### HTMLElement

HTMLElement differs in a number of ways. Hardcore has some awareness of HTML’s
various element types such as which may never have a closing tag (and that all
other elements *must* have a closing tag) and certain content constraints.

Additional properties:

 - `alwaysSelfCloses` and `neverSelfCloses` (booleans, derived from name)
 - all HTML attributes, except "name"

The last item here is accessors for all 168 attributes defined in the HTML 5
spec, minus 'name' since it collides with the element name property. These are
just sugar for `getAttributeValue()` and `setAttributeValue()`. They exist on
HTMLElement regardless of whether they are specifically applicable to its
current name.

For convenience, if you set an attribute value to a function, it will be turned
into that function’s execution:

```js
elem.onclick = function() { okay(); };
elem.toXML(); // <elem onclick="function() { okay(); }()"></elem>;
```

Additional methods:

 - `hasClass(cls)`: Returns true if class is among css classes.
 - `addClass(cls)`: Adds a class to the class attribute.
 - `removeClass(cls)`: Removes a class from the class attribute.
 - `select(selector)`: Find element by css selector.

The select method is the same as the one on HTMLDocument, though naturally the
selector will be applied only to this element and its children.

#### HTMLText

HTMLText differs only in that when converting to XML or accessing `escaped`,
characters like no-break space will be escaped using HTML-specific entities.
Most of the available HTML entities are not applied, since these are all legal
characters in their literal form -- the ones we apply are just those which help
to highlight ambiguous or invisible characters.
