# hardcore

XML and HTML parsing, editing, construction and transformation library for node.

<!-- MarkdownTOC autolink=true bracket=round depth=4 -->

- [Purpose](#purpose)
   - [Caveats](#caveats)
- [Parsing](#parsing)
   - [Options](#options)
      - [`strict`](#strict)
      - [`ignoreWhite`](#ignorewhite)
      - [`normalize`](#normalize)
      - [`html`](#html)
      - [`target`](#target)
   - [Strict vs Permissive Mode](#strict-vs-permissive-mode)
- [Transformation](#transformation)
   - [`toXML()`](#toxml)
   - [`toObject()`](#toobject)
   - [`toJSON()`](#tojson)
   - [`toYAML()`](#toyaml)
- [XML](#xml)
   - [Regular Nodes](#regular-nodes)
      - [`hardcore.xml.Document`](#hardcorexmldocument)
      - [`hardcore.xml.Element`](#hardcorexmlelement)
      - [`hardcore.xml.Attribute`](#hardcorexmlattribute)
      - [`hardcore.xml.Comment`](#hardcorexmlcomment)
      - [`hardcore.xml.Text`](#hardcorexmltext)
      - [`hardcore.xml.ProcessingInstruction`](#hardcorexmlprocessinginstruction)
      - [`hardcore.xml.CDATASection`](#hardcorexmlcdatasection)
      - [Bonus node: `hardcore.xml.DocumentFragment`](#bonus-node-hardcorexmldocumentfragment)
   - [DTD Nodes](#dtd-nodes)
      - [`hardcore.xml.Doctype`](#hardcorexmldoctype)
      - [`hardcore.xml.DoctypeExternal`](#hardcorexmldoctypeexternal)
      - [`hardcore.xml.ConditionalSection`](#hardcorexmlconditionalsection)
      - [`hardcore.xml.ParameterReference`](#hardcorexmlparameterreference)
      - [`hardcore.xml.ElementDeclaration`](#hardcorexmlelementdeclaration)
      - [`hardcore.xml.ChildElementGroup`](#hardcorexmlchildelementgroup)
      - [`hardcore.xml.ChildElementName`](#hardcorexmlchildelementname)
      - [`hardcore.xml.AttListDeclaration`](#hardcorexmlattlistdeclaration)
      - [`hardcore.xml.AttributeDefinition`](#hardcorexmlattributedefinition)
      - [`hardcore.xml.EntityDeclaration`](#hardcorexmlentitydeclaration)
      - [`hardcore.xml.NotationDeclaration`](#hardcorexmlnotationdeclaration)
- [HTML](#html-1)

<!-- /MarkdownTOC -->

## Purpose

There are a bucnh of xml parsers / related tools for Node. I wouldn’t claim that
Hardcore is better than any of them, but I made it because I’d never found one
that did quite what I wanted (and then I got carried away).

It exposes:

 - A parser in the form a write stream
 - Node constructors

Here’s what you can do with it:

 - Strict or forgiving parsing of XML, including DTDs -- and also HTML.
 - Document validation, I suppose, as a side effect of parsing in strict mode.
 - Edit the result. Accessors can take care of entity escapes when needed.
 - Transform the result into vanilla objects or json, with fine control over
   exactly what the end result will look like: you can specify which nodes to
   ignore, which to consider ‘plural’, and you can map names, transform or
   coerce values selectively, etc.
 - Convert back (perhaps after modification) to prettified or condensed XML.
 - What the hell, why not throw in `toYAML` too.
 - Construct valid XML or HTML documents node-by-node using the same building
   blocks the parser uses.

### Caveats

While I think this might(?) currently be the most rigorous XML library for Node,
it isn’t 100% spec compliant. For example, internode whitespace outside of the
root element of a document is not preserved regardless of settings, and
validation probably misses any number of finer stipulations in the spec.

The DTD implementation is thorough enough that it will catch ‘grammatical’
errors and it will even parse an external DTD correctly. But it isn’t *aware* of
the DTD content -- that is, the DTD isn’t used to interpret the document itself.
This is mainly because no one has used a DTD since 2002 and yet they make up the
vast majority of the XML spec -- it would be a lot to implement, and for what?
It was weird enough to spend as much time as I did on a dead technology I
figured, and anyway the point here was to parse the document and transform it,
not to render it for an viewing human or process its actual data content.

tl;dr the validation is mainly about grammar and doesn’t actually use DTDs

Finally note that despite the fact that this library can help you get what you
want from XML, it *is* still XML and you’ll still need to take a shower to get
the icky feeling off after interacting with it.

## Parsing

I recommend using the `Parser` constructor.

```js
const parser = new hardcore.Parser(opts);

parser.on('error', err => /* ... */);

parser.on('result', doc => /* ... */)

// then:

someStream.pipe(parser);

// or:

parser.write(someXMLString);
parser.end();
```

Note that one way or another, it needs to `end()` before it can emit a result.
A valid document can have an arbitrary number of comments and processing
instructions after the root element node is finished, so there’s no way to know
a document is complete without being told so expressly.

There’s another option for parsing though:

```js
hardcore.parse(xmlStr, opts)
    .then(doc => /* ... */)
    .catch(err => /* ... */);
```

And I want you to feel like you have a lot of choices even though nodebacks are
super dead:

```js
hardcore.parse(xmlStr, opts, (err, doc) => { /* ... */ });
```

When using the `parse` method instead of `Parser` directly, you lose access to
permissive mode’s `warning` and `wat` events. The `parse` method returns a
promise or, if you supply a callback, nothing, but it takes the same options as
the constructor.

### Options

First off I want to point out that at this point, we’re just talking about
parsing. There are other options for `toObject`, `toJSON`, `toYAML`, and
`toXML` later.

#### `strict`

Set to `false` to enable permissive mode (more below). Defaults to `true`,
except when `html` is true.

#### `ignoreWhite`

Set to `false` to cause whitespace-only text nodes to appear in the resulting
document. Defaults to `true`. Note that whitespace that would not be text nodes
-- that is, whitespace occuring outside the root element, or inside tags, etc --
is never preserved, standards be damned.

#### `normalize`

Set to `true` to treat all whitespace sequences in text, comments, and CDATA as
single spaces (u0020). When parsing HTML, an exception is made for the `<pre>`
element even when this is on. Defaults to `false`.

#### `html`

Set to `true` to parse HTML. Although well-formed XHTML will be valid as XML,
HTML proper isn’t actually a subset of XML and will often fail without this mode
set to true because of stuff like self-closing tags without a self-closing
sequence (e.g. `<input>` instead of `<input/>`) being valid. Which is stupid
btw.

Even if you are dealing with HTML that would be valid as XML, though,
you’ll want to use this because there are benefits after parsing; the resulting
document will have typed, not anonymous, elements, with unique attributes.

Note that when HTML is true, `strict` is false by default. The `strict` setting
refers to XML, so unless you know the HTML is XHTML or HTML 5 written to be XML
compliant, it won’t make sense to have this on.

#### `target`

This lets you explicitly specify the type of result you expect. Valid values are
"Document", "DoctypeExternal", "Element" or "DocumentFragment". By default, the
parser will automatically detect whether the body being parsed is a Document or
a DoctypeExternal, but you can only get an Element or DocumentFragment back by
asking for it. Note, these values are not case sensitive, and if you prefer, you
can pass in the corresponding constructor instead.

If you do specify a target and the parsed body is not a valid example of that
target, this will constitute an error.

### Strict vs Permissive Mode

In strict mode, if the parser hits something it thinks is invalid, it emits an
error event and returns to its ghostly astral sleep realm. The errors objects
are custom and hopefully you will agree, pretty damn informative.

In permissive mode, at the juncture where we would have emitted an error in
strict mode, one of the following will happen:

 - The parser will be like ‘I know what you meant bro/sis lol it’s cool.’ It
   wil; fix the error. For example, an unescaped ampersand that was not part of
   an entity in a text node is pretty obviously meant to be `&amp;`. A `warning`
   event will be emitted for errors that it thinks it corrected.
 - The parser will be like ‘this node is busted.’ It can’t fix it because it
   doesn’t know what it was supposed to be. But it does see a clear enough
   beginning and ending, so it decides to ignore the problem and continue. In
   this case, there will be a `wat` event to let you know a node had to be
   ignored.
 - The parser will be like ‘um .. no.’ It thinks the document is unparsable
   garbage. You’ll get an `error` event. 

## Transformation

Every node, plus every ‘children’ type property, possesses these methods:

 - `toXML()`
 - `toObject()`
 - `toJSON()`
 - `toYAML()`

The `toXML` method is the same as `toString`, btw -- so when coerced to string,
any node will become XML again.

### `toXML()`

Returns a representation of the node and all its decendents as XML. It can take
an optional options object with the following properties:

 - `withNS`: Set to `false` to strip namespace prefixes. Default is `true`.
 - `quote`: Can be the string `'` or `"` (default). This sets the preferred
   quote delimiter for attribute values and other quoted sequences. Note that
   it is *preferred* because there are certain special circumstances in DTDs
   where the content of a value will dictate that one or the other is not
   possible.
 - `tab`: A string to use for indentation. Defaults to an actual tab character.
   If it’s an empty string, newlines will also be eliminated; this is useful for
   compressing the result. Must be composed of valid XML whitespace chars, which
   are space, tab, linefeed and newline.
 - `pretty`: A boolean (default `true`) that will make adjustments to the output
   for better readability. When `pretty` is true, the main effect is that text
   and CDATA will be formatted into consistent width lines with normalized
   whitespace. Therefore you should not use `pretty` if you need to preserve
   original whitespace. In HTML mode, the `<pre>` tag will be an exception even
   when `pretty` is active.
 - `d`: This is mainly for internal use, but it may be useful to mention. It’s
   a number indicating the indentation depth. It defaults to zero, and for each
   tier of children encountered it increments by one.

Effectively, you can use the parser as an XML prettifier:

```js
const prettify = async xmlStr => {
   const doc = await hardcore.parse(xmlStr);
   return doc.toString({ tab: '  ' });
};
```

Note that `toXML` / `toString` will work for HTML documents and nodes as well,
despite the name of the former.

### `toObject()`

### `toJSON()`

### `toYAML()`

## XML

All of the XML node constructors are exposed at `hardcore.xml`. You can use them
to construct documents (or document snippets) ‘by hand’ or in the course of
modifying a previously parsed document (e.g. inserting some new elements).

Validation is still a concern here. Hardcore really isn’t interested in creating
anything but valid documents. It will coerce values though -- that is, it will
perform many of the same adjustments that are performed in permissive parsing
mode. For example:

```js
const elem = new hardcore.xml.Element({ name: 'pizza' });

elem.setAttribute({ key: 'toppings', value: 'anchovies & olives' });

elem.toXML(); // => <pizza toppings="anchovies &amp; olives" />
```

That also shows an example of one of a convenience method on `Element` -- its
`setAttribute` method is shorthand here for:

```js
elem.attributes.push(new hardcore.xml.Attribute({ /* ... */ }));
```

All of the node constructors that take arguments take them as an options-type
object as seen in the above examples. However, nodes that only have one property
of note will accept a string instead, like `new Text('my content')`.

All nodes have `toObject`, `toJSON`, `toYAML` and `toXML` methods, which are
detailed in the transformation section above. Note that `toXML` aliases
`toString` which is the ‘real’ `toXML` method. They also all possess an
`isValid` method that returns a Boolean. For many nodes, this will always return
`true` because it isn’t possible to ever put them in an invalid state. But
others can become invalid because their properties may have more complex
relationship requirements (this is usually the DTD nodes).

An important note about `isValid` is that it only confirms the validity of
*that* node. It will tell you if the children are valid *in their relationship
to that node*, but not if all children are individually valid nodes themselves.
Thus an `ElementDeclaration` will be invalid if it has the `type` "ANY" but also
has `contentSpec` children -- but it will not be invalid just because one of its
`contentSpec` children is malformed somehow.

Nodes may have context. A number of nodes have `children` properties which are
array-like containers for other nodes / components -- this and its variants are
detailed in the node-by-node sections below. But nodes also have a `parent`
property, a `parents` property, and a `lineage()` method. The first returns the
immediate parent; the second returns an array of all parents, from farthest to
nearest; and the third returns the iterable that underlies `parents` but it’s
inclusive of the node itself. These properties and methods make it easy to loop
over a node "path" and allow you to do things like `node.parents.find()`.

Going the other direction doesn’t play nice with iteration, of course, since a
parent may have multiple children. There are some helpers, but you’ll probably
still need to handle this on a case-by-case basis more often than not. The first
aide is `descendents()`, another generator like `lineage()`. It yields nodes
except "not really a node" nodes like attributes, working from nearest to
farthest -- more or less, since one’s definition of that may vary. First you get
immediate children, then the immediate children of the first immediate child,
the second, and so on; then the third generation stemming from these, etc. The
second method is `findNearestDescendent()`, which accepts a predicate function
and returns the nearest match according to the same logic given above.

Note that parent-child relationships are created and updated automatically,
which is one of the reasons `children` properties are ‘array-like’ rather than
actual arrays (until we get Proxy anyway!). That said, I’m pretty sure that if
you’re sufficiently determined you can probably break them :/

Nodes also all possess the `remove()` method which slices them out of their
parent, if applicable, and returns them. A given node cannot be in two places
at once, so assigning a node in a new parent will automatically remove it from
a previous parent. If you want to use the same node again, you can `clone()` it!

Using `clone` returns an identical but unique node (with no parent). If there
are descendents, these too will be cloned.

Recap time. All nodes have:

 - `parent`
 - `parents`
 - `clone()`
 - `isValid()`
 - `lineage()`
 - `remove()`
 - `toJSON()`
 - `toObject()`
 - `toXML()` / `toString()`
 - `toYAML()`

And nodes which have the `children` property also all have:

 - `descendents()`
 - `findNearestDescendent()`

So onto the node types. From here on I’m going to omit the `hardcore.xml` prefix
in examples and assume that if you’re working with these a lot, you’ve bound
the ones you’re interested in to local variables.

### Regular Nodes

#### `hardcore.xml.Document`

Normally Document is our ‘target’ -- that is, when parsing concludes, the result
ought to be a valid Document (or a DoctypeExternal, but just ignore that).

A document can begin with an xml declaration. This isn’t modeled as a child
node; it’s just represented as properties of the document. After that it can
have any number of Comments or ProcessingInstructions, and it may have exactly
one Doctype, and it must have exactly one Element. If there is a Doctype, it
must come before the Element.

Since everything but the element is optional, a valid document can be as simple
as a single element. Therefore if you parse a snippet of a larger document, so
long as it is contained in a single node, the result will be valid as a
document, unless you specify Element as your `target`.

##### Argument Object

 - `version`: The xml version, which is any number >= 1 and < 2. Optional.
 - `encoding`: An optional string indicating the document encoding.
 - `standalone`: An optional boolean that presumably means something.

The properties of a Document are those above plus `children`, which holds child
nodes. The `children` object is not an array, but it does have almost all array
methods (push, map, filter, find, splice, etc). What you *can’t* do is directly
assign values to indices. Although we can more or less subclass Array now, we
still don’t have Proxy. Once we do, I’ll go back and enhance the various
`children`-like objects to make use of it and allow assignment by index. (The
problem there is that we need accessors to make this stuff work right, and
Array.observe is async and therefore useless here.)

All `children`-like objects are iterable. They also have a `first` and `last`
properties for accessing the nodes in those positions.

There’s are also two convenience properties: `doctype` and `root`. These
accessors return the Doctype and Element children respectively -- if they’re
present. You can also use them to set the doctype or root element to a new
value. It will use the existing position if applicable, or it will prepend or
append them to `children` if one does not already exist, respectively.

```js
document.root = new Element({ name: 'hello' });
```

#### `hardcore.xml.Element`

Element is the most important node; it’s a "tag".

##### XML Example

```xml
<hello>yes<what/></hello>
```

That’s a "hello" element with two children, a Text node and another Element.

##### Argument Object

 - `namespace`: Optional.
 - `name`: The name of the element, required.

Like Document, Element has an array-ish `children` property. It has a second
array-ish property, too: `attributes`. The children can be CDATASection,
Comment, Element, ProcessingInstruction, or Text nodes. Attributes must be ...
Attributes. Note that the keys of Attributes must all be unique within a single
Element.

There are two additional *get* accessors, `fullName` (which returns
namespace:name) and `text`, which returns the concatenation of any text content
in `children`, ignoring other nodes and including CDATA content (and it
recurses). Thus `document.root.text` returns all of the text in a document.
Whitespace gets normalized and known entity references are converted to normal
representations when using the `text` property.

(All nodes that have a `namespace` property also have the `fullName` getter. I
won’t mention it from here on.)

Element has two convenience methods for dealing with attributes:

 - `setAttribute({ namespace?, key, value })`
 - `removeAttribute({ namespace?, key })`

In the case of `setAttribute`, if a matching attribute already exists its value
will be updated; otherwise, it will be created.

#### `hardcore.xml.Attribute`

An attribute is a key-value pair (with optional namespace). The value can
include entity references like '&amp;'. In XML, unlike HTML, a value is always
required, but it can be an empty string.

##### Argument Object

 - `namespace`: Optional.
 - `key`: Required.
 - `value`: Defaults to ''.

Properties are the same.

#### `hardcore.xml.Comment`

A comment can contain pretty much any text except the sequence '--'. It also
can’t end with '-'. If you set a value with these sequences they’ll be corrected
to '- -' and '- ' respectively.

##### Argument Object

 - `content`: The text of the comment. Defaults to ''.

The only property is `content`.

#### `hardcore.xml.Text`

Text nodes require '<'' and ']]>' to be escaped. This will be done automatically
if needed.

##### Argument Object

 - `content`: The text itself.

The only property is `content`. Remember that for nodes that only take a single
argument, it’s okay to just supply the value instead of an object, so
`new Text('some text')` is understood.

#### `hardcore.xml.ProcessingInstruction`

A processing instruction is a directive that targets a specific interepreting
agent, or something like that. They’re the ones that begin with '<?', except for
the xml declaration.

##### Argument Object

 - `target`: The target of the processing instruction.
 - `instruction`: The instruction text itself (defaults to '', which is valid).

Note that the instruction cannot contain the sequence '?>'.

#### `hardcore.xml.CDATASection`

A CDATA section is a type of ‘marked section’ that contains text that doesn’t
need to use entity references to encode ampersands or less-than signs. But it
still can’t contain the closing sequence (]]>) of course, and since entities
aren’t interpretted that can’t be escaped.

It stands for character data, and really it’s a special type of text node. That
is, it resolves to text content and therefore can appear only where text can
appear (i.e., inside Elements).

##### Argument Object

 - `content`: Defaults to ''.

The only property is `content`.

#### Bonus node: `hardcore.xml.DocumentFragment`

This is actually the same as the ‘children’ part of an Element. It’s exposed
because it could be convenient, and many other XML tools implement a similar
tool. But this means it can’t contain an xml declaration or a Doctype, etc.

```js
const fragment = new DocumentFragment();

fragment.push(new Comment('whatevs'));
```

### DTD Nodes

Turn back now! It’s not too late! This section is haunted! Woo~ooo~ooo!

#### `hardcore.xml.Doctype`

The Doctype can occur in a Document somewhere before the root element begins.
Usually this is really simple and benign and looks like this:

```xml
<!DOCTYPE html>
```

But if you hate yourself, it can actually contain a DTD (doctype definition),
which is a set of definitions (declarations) saying which elements, attributes,
entities, and other stuff can appear in the document and how they should behave,
what constitutes their being well-formed, or what they mean. It sounds useful
but don’t be fooled.

##### Argument Object

 - `name`: Required.
 - `systemID`: Optional.
 - `publicID`: Required if `systemID` is present, else invalid.

In addition to the above, there is a `children` property. This works like the
`children` property of Document or Element. It may contain any number and
sequence of Comment, ParameterReference, ProcessingInstruction, or any of the
XxxDeclaration elements described below.

#### `hardcore.xml.DoctypeExternal`

This is actually a special ‘target’ like `Document`. That is, xml parsing can
result in either a `Document` or a `DoctypeExternal`. An external doctype is
a DTD or DTD portion that lives on its own and gets referenced in documents. It
actually permits a few things that aren’t valid in a document-inline DTD.

For the most part, it’s not very different from `Doctype`, but it can optionally
possess a ‘text declaration’, which is an ‘xml declaration’ that they decided to
call something else (well, it does differ -- `version` is optional and
`standalone` is absent).

##### Argument Object

 - `version`: The xml version, a number >= 1 and < 2. Optional.
 - `encoding`: The encoding string. Optional.

Properties are `version`, `encoding` and `children`. The `children` object can
contain the same things as `Doctype`, but with the addition of
`ConditionalSection`.

#### `hardcore.xml.ConditionalSection`

A conditional section is a weird thing that can only occur in external DTDs.
It’s a ‘marked section’ (like CDATA) whose keyword may be either IGNORE or
INCLUDE. Those indicate that the contents -- which are just more DTD rules --
are to be either ... ignored or included. But you would never use those words
directly, even though they’re legal.

The utility of this is that the keyword may be a *parameter reference* that
resolves to IGNORE or INCLUDE. In this manner, sections of the DTD can be
activated or deactivated conditionally based on which word the parameter
reference was set to.

Oh my god, why am I explaining this. No one will ever use this.

##### XML Example

```xml
<!ENTITY % withPizza 'INCLUDE'>

<![%withPizza;[
    <!ELEMENT pizza EMPTY>
]]>
```

##### Argument Object

 - `keyword`: The keyword of the section. It can be 'IGNORE', 'INCLUDE' or a
   parameter reference (e.g. "%myParam;"). Required.

Properties are `keyword` and `children`. The children object is the same as the
one used by `DoctypeExternal`, and it may be empty.

#### `hardcore.xml.ParameterReference`

A parameter reference looks like an entity reference but with ‘%’ instead of
‘&’. Defined with EntityDeclarations, these can appear in DTDs on their own.
(They can also be used as names for ConditionalSections, but you don’t need
the constructor for that).

##### XML Example

```xml
%myParam;
```

##### Argument Object

 - `name`: The name of the parameter. It doesn’t matter if you include the
   surrounding punctuation or not. Required.

The only property is `name`.

#### `hardcore.xml.ElementDeclaration`

Defines an element, except its attributes (use AttListDeclaration for that). The
definition describes what kind of children may appear inside, and this is sort
of complicated -- the next two classes are used for that.

##### XML Example

```xml
<!ELEMENT pizza EMPTY>
```

##### Argument Object

 - `namespace`: Optional.
 - `name`: Element name, required.
 - `quantifier`: If `type` is 'ANY' or 'EMPTY' this will always be ''. If `type`
   is 'MIXED' it can be '' or '*'. If `type` is 'CHOICE' or 'SEQUENCE' it can be
   '+', '?' or '*'. It describes the number of times the outermost group of
   legal children can repeat. Defaults to ''.
 - `type`: Can be 'CHOICE', 'SEQUENCE', 'MIXED', 'ANY' or 'EMPTY'. Choice means
   the outermost legal children group is a list of ‘or’ choices. Mixed means the
   same, but also allows text nodes to appear. Sequence means the outermost
   group describes a specific series where order matters. Any and empty do what
   they sound like, and require that `contentSpec` remains empty (no children).

The properties are the same as those above, plus `contentSpec`, which is a
special version of ChildElementGroup for the root. Because of the complexity of
the requirements, it’s possible to put an ElementDeclaration into an invalid
state, so be careful.

#### `hardcore.xml.ChildElementGroup`

ChildElementGroup is a parenthesized list of one or more ChildElementNames or
additional ChildElementGroups. The `contentSpec` property of an
ElementDeclaration is a special type of ChildElementGroup.

Like `attributes` or `children`, ChildElementGroup possesses almost all array
methods.

##### XML Example

```xml
<!ELEMENT piñata (candy|toy|sadness)* >
```

The ChildElementGroup here has three ChildElementName members. When the group is
the root (content spec), as here, `quantifier` and `type` are actually the same
as those of the declaration itself -- it doesn’t matter whether you set them on
the ElementDeclaration or its `contentSpec` property. In this case, the `type`
is "CHOICE" and the `quantifier` is "*".

##### Argument Object

 - `quantifier`: This can be '', '+', '?' or '*', though the `type` may restrict
   which of these are valid on the root element.
 - `type`: For non-root ChildElementGroups, the type may only be "CHOICE" or
   "SEQUENCE". For the root, see the description at ElementDeclaration.

#### `hardcore.xml.ChildElementName`

In the example below, "kitten" is a ChildElementName. The declaration’s type
here is "SEQUENCE" -- that’s why the elements are comma seperated. While
ChildElementGroups can nest more ChildElementGroups, each ‘leaf’ group must
contain at least one ChildElementName.

##### XML Example

```xml
<!ELEMENT litter (kitten+, runt) >
```

The + sign is inside the group, meaning it’s the quantifier of the
ChildElementName as opposed to the group.

##### Argument Object

 - `namespace`: Optional.
 - `name`: Element name, required.
 - `quantifier`: An empty string (default) or '+', '?' or '*'. Depending on the
   parent ElementDeclaration’s type, valid quantifiers may be restricted.

Properties are the same as the arguments.

#### `hardcore.xml.AttListDeclaration`

An AttListDeclaration describes the attributes to associate with an element.
Logically, these might as easily have been part of the ElementDeclaration since
each AttListDeclaration can correspond with only one Element, but I’m glad it
isn’t since ElementDeclaration is already complicated enough.

##### XML Example

```xml
<!ATTLIST pizza
    topping (anchovies|olives|sadness) "anchovies">
```

In this example, pizza is the name of the element, and topping is the name of
its one attribute. This is followed by an enumeration of valid values and a
default value to use if the attribute is absent.

##### Argument Object

 - `namespace`: Optional.
 - `name`: Element name, required.

Instance properties are `defs` (an AttributeDefinitions object) plus those
above. AttributeDefinitions is like `children`; it has array methods. It is
allowed to be empty, and its members must be AttributeDefinitions.

#### `hardcore.xml.AttributeDefinition`

A single AttributeDefinition is a member of the `defs` described above. The
example given for AttListDeclaration will suffice, too. 

This is another relatively complicated one.

##### Argument Object

 - `namespace`: Optional.
 - `name`: The attribute name, required.
 - `type`: May be '' (default), 'CDATA', 'ENTITIES', 'ENTITY', 'ID', 'IDREF',
   'IDREFS', 'NMTOKEN', 'NMTOKENS', or 'NOTATION'
 - `defaultType`: May be '', '#FIXED', '#IMPLIED' (default), or '#REQUIRED'.
 - `defaultValue`: String. Required if `defaultType` is '' or '#FIXED'; invalid
   otherwise.
 - `members`: An array of strings, optional. This is an enumeration of valid
   values. Can only be included if `type` is '' or 'NOTATION'.

Properties are the same as above. Note that the `members` array is not like
other children properties; you can set it, but it just contains strings, not
special objects, and it can’t be manipulated, only redefined.

Things to know: if the `type` is 'NOTATION', the rules for `members` change.
The difference is subtle though: with 'NOTATION', members must be valid "names"
and with '', members just need to be valid "nmTokens", which is slightly less
restrictive. Honestly you don’t need to worry about this. Why am I doing this
what is wrong with my brain.

The enumerated values are more restrictive that regular attribute values. An
attribute value can have whitespace for example; these values can’t. I don’t
know why it’s like this, it makes no sense.

The name `defaultType` is kind of misleading, but I couldn’t figure out anything
better to call it. If it’s '' or #FIXED', `defaultValue` is required -- and
otherwise, `defaultValue` must be empty. '#FIXED' says ‘the value must always be
equal to defaultValue’, which makes you wonder what the point of having the
attribute is at all. If the value is '#IMPLIED' it means ‘attribute is not
required’, which is weird since that’s not in any sense what the word implied
means. '#REQUIRED' is what it sounds like, though.

#### `hardcore.xml.EntityDeclaration`

Defines a regular entity ('&something;') or a parameter entity ('%something;').

##### XML Example

```xml
<!ENTITY greeting "hello">
```

Then you could use '&greeting;' anywhere that entity references are allowed.
It could be that simple, anyway, but this is XML.

##### Argument Object

 - `name`: Entity name, required.
 - `isParameter`: Boolean (default false), indicates this is a parameter entity.
 - `ndata`: If a regular entity is defined using an external ID, this is an
   optional name string indicating balwiwjw whatever who cares.
 - `publicID`: If there’s a `systemID`, there can also be a `publicID`.
 - `systemID`: The system literal identifier if you swing that way.
 - `value`: A string value that the entity should resolve to.

Note that `value` is mutually exclusive with `systemID`, and that `publicID`
demands that there be a `systemID`.

#### `hardcore.xml.NotationDeclaration`

Go ahead, declare a notation with this handy helper!

##### XML Example

```xml
<!NOTATION xml-is-stupid PUBLIC "eh">
```

##### Argument Object

 - `namespace`: Optional.
 - `name`: Required.
 - `publicID`: You know, the public ID. Of the notation.
 - `systemID`: Here’s a thing too.

Either `publicID` or `systemID` is required, or both. Unlike other cases with
these properties, you can have `publicID` on its own here.

## HTML