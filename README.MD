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
   - [Parser Events in Strict and Permissive Mode](#parser-events-in-strict-and-permissive-mode)
      - [Event: `error`](#event-error)
      - [Event: `warning`](#event-warning)
      - [Event: `wat`](#event-wat)
- [Transformation](#transformation)
   - [`toXML()`](#toxml)
   - [`toObject()`](#toobject)
      - [Filtered Transforms](#filtered-transforms)
      - [Plurality](#plurality)
      - [Custom Transform](#custom-transform)
   - [`toJSON()` and `toYAML()`](#tojson-and-toyaml)
   - [Renamers](#renamers)
      - [`hardcore.renamers.camel`](#hardcorerenamerscamel)
      - [`hardcore.renamers.lower`](#hardcorerenamerslower)
      - [`hardcore.renamers.snake`](#hardcorerenamerssnake)
- [XML](#xml)
   - [Regular Nodes](#regular-nodes)
      - [`hardcore.nodes.Document`](#hardcorenodesdocument)
      - [`hardcore.nodes.Element`](#hardcorenodeselement)
      - [`hardcore.nodes.Attribute`](#hardcorenodesattribute)
      - [`hardcore.nodes.Comment`](#hardcorenodescomment)
      - [`hardcore.nodes.Text`](#hardcorenodestext)
      - [`hardcore.nodes.ProcessingInstruction`](#hardcorenodesprocessinginstruction)
      - [`hardcore.nodes.CDATASection`](#hardcorenodescdatasection)
      - [Bonus node: `hardcore.nodes.DocumentFragment`](#bonus-node-hardcorenodesdocumentfragment)
   - [DTD Nodes](#dtd-nodes)
      - [`hardcore.nodes.Doctype`](#hardcorenodesdoctype)
      - [`hardcore.nodes.DoctypeExternal`](#hardcorenodesdoctypeexternal)
      - [`hardcore.nodes.ConditionalSection`](#hardcorenodesconditionalsection)
      - [`hardcore.nodes.ParameterReference`](#hardcorenodesparameterreference)
      - [`hardcore.nodes.ElementDeclaration`](#hardcorenodeselementdeclaration)
      - [`hardcore.nodes.ChildElementGroup`](#hardcorenodeschildelementgroup)
      - [`hardcore.nodes.ChildElementName`](#hardcorenodeschildelementname)
      - [`hardcore.nodes.AttListDeclaration`](#hardcorenodesattlistdeclaration)
      - [`hardcore.nodes.AttributeDefinition`](#hardcorenodesattributedefinition)
      - [`hardcore.nodes.EntityDeclaration`](#hardcorenodesentitydeclaration)
      - [`hardcore.nodes.NotationDeclaration`](#hardcorenodesnotationdeclaration)
- [HTML](#html-1)
   - [HTMLElement](#htmlelement)
   - [HTMLElementASC](#htmlelementasc)
   - [HTMLElementPre](#htmlelementpre)
   - [HTMLAttribute](#htmlattribute)

<!-- /MarkdownTOC -->

## Purpose

There are a bucnh of xml parsers / related tools for Node. I wouldn’t claim that
Hardcore is better than any of them, but I made it because I’d never found one
that did quite what I wanted (and then I got carried away).

It exposes:

 - A parser in the form a write stream
 - Node constructors

Here’s what you can do with it:

 - Parse XML in strict or forgiving modes, including DTDs.
 - Parse HTML.
 - Edit the result. Accessors will take care of entity escapes when needed.
 - Convert back (perhaps after modification) to prettified or condensed XML.
 - Transform the result into vanilla objects or json, with fine control over
   exactly what the end result will look like: you can specify which nodes to
   ignore, which to consider ‘plural’, and you can map names, transform or
   coerce values selectively, etc.
 - What the hell, why not throw in `toYAML` too.
 - Construct XML or HTML documents node-by-node using the same building
   blocks the parser uses.

### Caveats

While I think this might(?) currently be the most rigorous XML library for Node,
it isn’t truly spec compliant. For example, internode whitespace outside of the
root element of a document is not preserved regardless of settings, and
validation probably misses any number of finer stipulations in the spec.

The DTD implementation is thorough enough that it will catch ‘grammatical’
errors and it will even parse an external DTD correctly. But it isn’t *aware* of
the DTD content -- that is, the DTD isn’t used to interpret the document itself.
This is mainly because no one has used a DTD since 2002 and yet they make up the
vast majority of the XML spec -- it would be a lot to implement, and for what?
It was weird enough to spend as much time as I did on a dead technology I
figured, and anyway the point here was to parse the document and transform it,
not to render it for a viewing human or process its actual data content.

tl;dr the validation is mainly about grammar and doesn’t actually use DTDs

There’s a very important caveat regarding HTML. HTML support is secondary in
this library, and not as rigorous. While ‘normal’ stuff will be handled fine,
and it can even take care of some of the weirder allowances like legal omission
of certain open and close tags, there are definitely obscure cases that could
cause parsing problems, and there are very few sanity checks for validity.

Finally note that using this library may mean coming in close contact with XML.
All usual safety precautions apply: use in a well-ventilated area and make sure
a friend knows where you are. Have them check in on you occasionally. Meet in a
public space. Do not operate heavy machinery, do not shake the baby. Hardcore
Enterprises cannot be held responsible for emotional or physical harm caused by
interaction with XML.

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
is never preserved, standards be damned. Always `true` if `html` is `true`, and
effectively `true` by other means if `normalize` is true.

#### `normalize`

Set to `true` to treat all whitespace sequences in text, comments, and CDATA as
single spaces (u0020). When parsing HTML, an exception is made for the `<pre>`
element even when this is on. Defaults to `false` unless `html` is `true`.

This option will also cause empty CDATA, comment and text nodes to be dropped.

Note that this option does not preclude later output of XML with newlines for
readability; the `pretty` option of `toXML()` provides a consistent way to take
care of that.

#### `html`

Set to `true` to parse HTML. Although well-formed XHTML will be valid as XML,
other HTML versions are not necessarily valid as XML.

Even if you are dealing with HTML that would be valid as XML, though,
you’ll want to use this because there are benefits after parsing; the resulting
document will take advantage of additional knowledge about HTML to give you a
better result, including nodes that have shorthand for accessing common
attributes like 'id'.

Note that when HTML is true, `strict` is false by default. The `strict` setting
refers to XML, so unless you know the HTML is XHTML or HTML 5 written to be XML
compliant, it won’t make sense to have this on. In `strict` mode, valid HTML
constructs like self-closing elements without '/' (e.g. `<input>`) will be
errors, as will attributes without quotes or values.

If you parse HTML and then use `toXML()`, you will get back a result that is
valid as XML.

The HTML parsing is pretty dumb. It doesn’t know anything more about HTML than
it needs to to compensate for the ways in which it differs from XML. Although it
knows ‘about’ a handful of elements, it doesn’t know about things like what may
or may not appear in a ‘p’ tag.

#### `target`

This lets you explicitly specify the type of result you expect. Valid values are
"Document", "DoctypeExternal", "Element" or "DocumentFragment". By default, the
parser will automatically detect whether the body being parsed is a Document or
a DoctypeExternal, but *you can only get an Element or DocumentFragment back by
asking for it.* Note, these values are not case sensitive, and if you prefer,
you can also pass in the corresponding constructor instead.

If you do specify a target and the parsed body is not a valid example of that
target, this will constitute an error.

### Parser Events in Strict and Permissive Mode

In strict mode, if the parser hits something it thinks is invalid, it emits an
error event and returns to its silent astral sleep realm.

In permissive mode, it’s still possible to get a show-stopping error, but it
isn’t common. Instead you’ll usually get a `warning` event or a `wat` event, and
parsing will continue. The event’s value will still be an error object.

#### Event: `error`

An error, regardless of mode, means that parsing has ceased. The error objects
are fancy business -- messages are specific and they include the offending
string when possible, with a big red shame arrow pointing at the nexus of sin.

There are two types of error -- HardcoreSyntaxError and HardcoreTypeError. The
first is associated with ‘grammatical’ errors, especially those which prevent
hardcore from being able to interpret what was ‘meant’. In contrast, the second
usually occurs when the meaning of a given part is clear but nonetheless doesn’t
constitute a valid value. The distinction isn’t exactly scientifically precise
though.

#### Event: `warning`

A warning event indicates that the parser encountered something invalid, but
it’s pretty sure it knew what you meant and was able to correct it. The most
common example would be illegal ampersands or whatever. While illegal, they’re
not actually grammatically ambiguous so it’s easy to fix. Another common
example would be unquoted or missing attribute values.

Certain ‘errors’ can get by in permissive mode without a warning event -- for
example, it won’t consider technically-illegal-but-for-no-good-reason stuff like
`< tag>` to be worth mentioning, and non-ASCII whitespace chars will silently be
considered valid as whitespace in places where whitespace is required. 

#### Event: `wat`

A wat event is more serious. These indicate errors where recovery usually
amounts to ignoring an entire node, or a part of one (like a malformed
attribute). A wat could even mean there are unbalanced element tags -- this,
too, can sometimes be ‘corrected’ using the same sort of logic a browser might
when dealing with malformed HTML, but that doesn’t mean the output will match
your expectations, so be wary. Internally, permissive mode is called ‘sloppy’
mode for a reason.

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

While the parsed representation is already an object, it likely isn’t the one
you really want if, for example, you’re using the XML as a data source.

There are a number of existing node modules that convert XML to objects. Some
have a lot of helpful options, but none gave me quite what I needed -- this was
the impetus for hardcore.

XML doesn’t map neatly to sane data formats like JSON, YAML, or actual objects.
In addition to having no means to respresent anything except strings and
hierarchies, XML makes no distinction between what we would call objects and
arrays. We want objects with properties. That means, first of all, sacrificing
sequence (usually). If a node has mixed content like text-element-text, you’re
not going to see that sequence preserved. Well, not unless you use a custom
`transform` function anyway (see below).

Way back, the way I would have done this would have been to use a module like
xml2json first and then just manipulate and pluck data from the result to build
what I really wanted. That does work, but I found that for me, dealing with
sometimes very large and ugly documents, it led me towards very imperative,
convoluted code. The options system in hardcore is meant to solve that problem
by providing a declarative way to enact such transformations.

 - `asBool`: Filtered transform. The text content of a matched node will be cast
   as a Boolean. This cast will take into account common alternate
   representations like yes/no, 1/0, y/n. Default: undefined.
 - `asDate`: Filtered transform. The text content of a matched node will be cast
   as a Date. Default: undefined.
 - `asNumber`: Filtered transform. The text content of a matched node will be
   cast as a Number. Default: undefined.
 - `asString`: Filtered transform. The text content of a matched node will be
   ... text. (The point here is that the "asX" transforms will make the *value*
   of the node the result of the cast text, thus `{ name: 'text' }` instead of
   `{ name: { $text: 'text' } }`. Default: `true`.
 - `attrPrefix`: String. If set, attributes will become properties of their
   parent Element directly. May be an empty string if you’re not concerned with
   collision -- this is default.
 - `attrProperty`: String. If set, attributes will be grouped in a single object
   that is a property of the parent Element; this will be the name of that
   property. Default: undefined. `attrPrefix` and `attrProperty` are mutually
   exclusive options.
 - `collapse`: Filtered transform. Matching nodes will be ignored, but their
   children and attributes, if applicable, will not be -- instead, they will be
   inherited by the parent node. This is very useful when transforming XML,
   which is often aggressively and pointlessly hierarchical. Default: undefined.
 - `ignore`: Filtered transform. Matching nodes will be ignored, as will any of
   their descendents. Default: `[ Comment, Doctype, ProcessingInstruction ]`.
 - `plural`: Filtered transform. Matching nodes will be treated as arrays. This
   bit can be a little confusing. More on this below. Default: `true`.
 - `rename`: For named nodes, you can supply a mapping of original names to new
   names. This can be an Object or a Map; in the latter case, the keys can also
   be regex patterns. It can also be a function, which takes a name and returns
   a name.
 - `renamer`: A function that takes a name and returns a name. There are several
   built-in renamer functions available at `hardcore.renamers`. The default
   value is `hardcore.renamers.camel` -- it will convert names to conventional
   JS camelcase. Names given in `rename` supercede this setting.
 - `textProperty`: String. Like `attrProperty`, but for text. I suspect most of
   the time we want text to be handled by `asString`, but even with `asString`
   set to `true`, it is possible to have a node with mixed content, or text and
   attributes, which will necessitate assigning text to a property. Default:
   '$text'.
 - `transform`: Function to apply custom transformations. It can also be a Map.
   The workings of `transform` are described in detail below.
 - `withNS`: Boolean. Whether to include or omit namespace prefixes. Note that
   this setting will influence how names are matched in filtered transforms,
   too. Note, default is `false`, unlike `toXML`.

#### Filtered Transforms

The options called ‘filtered transforms’ above take a common action on any nodes
that pass provided predicate tests. It will accept a single value or an array of
values. Predicates can be standard predicate functions (they receive the node
and should return true or false), a string (will match named elements), a regex
pattern (same), or any of the node constructors (Element, Comment, etc). A
single value of `true` will cause the transformation to apply to all nodes.

#### Plurality

The `plural` predicate(s) are used to determine whether a node should be
translated to an array. You may find it odd that by default, all nodes are. This
has to do with what might be the single most important way XML sucks. In the
absence of a priori knowledge, the only safe assumption that will always yield a
consistent result is that *all nodes* are arrays. Bear with me...

```xml
<pizza>
  <topping>anchovy</topping>
  <slices>8</slices>
</pizza>`
```

Here, if we set `plural` to match nothing, we’d get:

```js
{ pizza: { topping: 'anchovy', slices: '8' } }
```

That actually makes sense. But then, what if sometimes there are more toppings?

```xml
<pizza>
  <topping>anchovy</topping>
  <topping>drano</topping>
  <slices>8</slices>
</pizza>
```

Now we’ll get:

```js
{ pizza: { topping: [ 'anchovy', 'drano' ] slices: '8' } }
```

The shitty bit here is that now we have a situation where you don’t know whether
`doc.pizza.topping` is a string or an array of strings. You’d need to put type
checking guards around everything. So what happens if we say *everything* is
plural, then?

```js
{ pizza: [ { topping: [ 'anchovy', 'drano' ], slices: [ '8' ] } ] }
```

This is obviously not what anyone wants -- but it is safe. Anyway, this is why
it’s up to you to make these decisions: `toObject` is just awaiting your orders.
A sensible options profile for that document might look like this:

```js
const opts = {
  plural: [ 'topping' ],
  rename: { topping: 'toppings' },
  asNumber: [ 'slices' ]
};

// Now you’ll get consistent results for both examples:
{ pizza: { toppings: [ 'anchovy' ], slices: 8 } }
{ pizza: { toppings: [ 'anchovy', 'drano' ], slices: 8 } }
```

The `plural` transform is not exclusive of other transforms. A node can be both
plural and a number, for example.

#### Custom Transform

The `transform` option lets you perform custom transformation, anything goes.
It can be a single function or it can be a Map of predicate keys (which are just
like the predicates / predicate arrays described above) with functions as
values.

An important note before we go on



There are a number of options that accept either one value or an array of
values, where a value is a string, a regex pattern, a predicate function, or any
of the node constructors (Element, Comment, etc). These act as filters -- for
strings and regex patterns, against named nodes; functions receive the node and
return true or false; and constructors are matched against instance type. A
single value of `true` is also allowed; then the transform will apply to every
node (which only makes sense with a few of them). We’ll call these ‘filtered
transforms’ below.

### `toJSON()` and `toYAML()`

The options for these include all of the options for `toObject`, plus all of
the options for `toXML`, with these differences:

 - `asComment`: An extra filtered transform. Nodes matching will be included in
   the output as comments. Note that JSON technically does not allow comments,
   though many implementations permit them anyway. Default for YAML:
   `[ Comment ]`. Default for JSON: `undefined`.
 - `quote`: This is not applicable to `toJSON`. For `toYAML`, the value can be
   a single quote, a double quote, an empty string, or one of the YAML string
   block prefixes. If undefined, but `pretty` is true, then no-quotes will be
   favored, but when necessary, or when the string is long, '>-' will be used.

### Renamers

You can supply a custom renamer (or null), but some of the more obvious ones are
made available out of the gate.

#### `hardcore.renamers.camel`

Standard JS-style camelcase. Common acronyms are handled intelligently (e.g.
'ID' => 'id', but 'CatId' => 'catID').

#### `hardcore.renamers.lower`

Entirely to lowercase.

#### `hardcore.renamers.snake`

Snake case -- lowercase with underscores between words. Good for when your
output is ultimately going to be consumed in a context where this is
conventional, like Python or PHP -- when in rome, etc.

## XML

All of the XML node constructors are exposed at `hardcore.nodes`. You can use them
to construct documents (or document snippets) ‘by hand’ or in the course of
modifying a previously parsed document (e.g. inserting some new elements).

Validation is still a concern here. Hardcore really isn’t interested in creating
anything but valid documents. It will coerce values though -- that is, it will
perform many of the same adjustments that are performed in permissive parsing
mode. For example:

```js
const elem = new hardcore.nodes.Element({ name: 'pizza' });

elem.setAttribute({ key: 'toppings', value: 'anchovies & olives' });

elem.toXML(); // => <pizza toppings="anchovies &amp; olives" />
```

That also shows an example of one of a convenience method on `Element` -- its
`setAttribute` method is shorthand here for:

```js
elem.attributes.push(new hardcore.nodes.Attribute({ /* ... */ }));
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

So onto the node types. From here on I’m going to omit the `hardcore.nodes`
prefix in examples and assume that if you’re working with these a lot, you’ve
bound the ones you’re interested in to local variables (for most use cases, this
will just be `Element` and either `Document` or `DocumentFragment`).

### Regular Nodes

#### `hardcore.nodes.Document`

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

#### `hardcore.nodes.Element`

Element is the most important node; it’s a "tag".

##### XML Example

```xml
<hello>yes<what/></hello>
```

That’s a "hello" element with two children, a Text node and another Element.

##### Argument Object

 - `namespace`: Optional.
 - `name`: The name of the element, required.
 - `text`: Optional string. A shortcut to add a single text node to the new
   Element.
 - `attributes`: Optional. Like `text`, this option lets you set attributes at
   instantiation time. It can either be an ElementAttributes object or a simple
   object hash like `{ id: 'MyElement' }`. In the latter form, namespaces will
   not be recognized.

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

Element has three convenience methods for dealing with attributes:

 - `getAttribute({ namespace?, key })`
 - `setAttribute({ namespace?, key, value })`
 - `removeAttribute({ namespace?, key })`

In the case of `setAttribute`, if a matching attribute already exists its value
will be updated; otherwise, it will be created.

Element has another convenience method for text content, `addText(str)`. This
will append a child text node.

#### `hardcore.nodes.Attribute`

An attribute is a key-value pair (with optional namespace). The value can
include entity references like '&amp;'. In XML, unlike HTML, a value is always
required, but it can be an empty string.

When creating a document from scratch, you probably won’t need to use this
constructor directly -- the `setAttribute()` method of Element is more
convenient.

##### Argument Object

 - `namespace`: Optional.
 - `key`: Required.
 - `value`: Defaults to ''.

Properties are the same.

#### `hardcore.nodes.Comment`

A comment can contain pretty much any text except the sequence '--'. It also
can’t end with '-'. If you set a value with these sequences they’ll be corrected
to '- -' and '- ' respectively.

##### Argument Object

 - `content`: The text of the comment. Defaults to ''.

The only property is `content`.

#### `hardcore.nodes.Text`

Text nodes require '<'' and ']]>' to be escaped. This will be done automatically
if needed.

##### Argument Object

 - `content`: The text itself.

The only property is `content`. Remember that for nodes that only take a single
argument, it’s okay to just supply the value instead of an object, so
`new Text('some text')` is understood.

#### `hardcore.nodes.ProcessingInstruction`

A processing instruction is a directive that targets a specific interepreting
agent, or something like that. They’re the ones that begin with '<?', except for
the xml declaration.

##### Argument Object

 - `target`: The target of the processing instruction.
 - `instruction`: The instruction text itself (defaults to '', which is valid).

Note that the instruction cannot contain the sequence '?>'.

#### `hardcore.nodes.CDATASection`

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

#### Bonus node: `hardcore.nodes.DocumentFragment`

This is actually the same as the ‘children’ part of an Element. It’s exposed
because it could be convenient, and many other XML tools implement a similar
tool. But this means it can’t contain an xml declaration or a Doctype, etc.

```js
const fragment = new DocumentFragment();

fragment.push(new Comment('whatevs'));
```

### DTD Nodes

Turn back now! It’s not too late! This section is haunted! Woo~ooo~ooo!

#### `hardcore.nodes.Doctype`

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

#### `hardcore.nodes.DoctypeExternal`

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

#### `hardcore.nodes.ConditionalSection`

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

#### `hardcore.nodes.ParameterReference`

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

#### `hardcore.nodes.ElementDeclaration`

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

#### `hardcore.nodes.ChildElementGroup`

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

#### `hardcore.nodes.ChildElementName`

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

#### `hardcore.nodes.AttListDeclaration`

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

#### `hardcore.nodes.AttributeDefinition`

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

#### `hardcore.nodes.EntityDeclaration`

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

#### `hardcore.nodes.NotationDeclaration`

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

There are a handful of special -- but still generic -- HTML element nodes.

### HTMLElement

The generic HTMLElement node is just an Element node augmented with convenience
accessors for getting and setting common attributes. Element attributes can also
be get and set using the `getAttribute` and `setAttributes` from Element, which
is what these accessors are sugar for.

 - alt
 - class
 - dir
 - height
 - href
 - id
 - lang
 - placeholder
 - src
 - style
 - title
 - translate
 - type
 - value
 - width

There are three additional methods to make `class` nice:

 - `addClass(name)`
 - `hasClass(name)`
 - `removeClass(name)`

To give an idea of how one might use hardcore with HTML, let’s say you want to
remove a particular class from every ‘p’ element. You might do it like this:

```js
for (const node of doc.descendents) {
   if (elem.name == 'p')
      elem.removeClass('oldClass');
}
```

And while there’s no CSS selector tool in here, you can do a lot of the same
sort of stuff programmatically without much fuss. Maybe you only want to remove
‘oldClass’ when the paragraph is a descendent of a div?

```js
for (const node of doc.descendents) {
   if (elem.name == 'p' && elem.parents.some(elem => elem.name === 'div'))
      elem.removeClass('oldClass');
}
```

### HTMLElementASC

This variation on HTMLElement is for elements that are ‘always self closing.’
Elements fitting this profile cannot have child content, and, during parsing,
they will be recognized as self-closing even if they omit the closing slash.
It’s needed because such tags would produce invalid XML otherwise. It also
influences `toXML()` rendering because other empty HTMLElements will always
use the ‘long-form’ syntax (`<script></script>`).

An example of HTMLElementASC is `<input>`.

### HTMLElementPre

This class is used for `<pre>`, `<script>` and `<style>`. It causes text node
content whitespace to be preserved as-is regardless of parser settings
(`normalize` is ignored) and `toXML()` options (`pretty` is ignored and
indentation is not applied). An HTMLElementPre element’s effect extends to all
of its children, if applicable.

Both the HTMLElementASC and HTMLElementPre constructors have a `nodes` property,
which is a hash of element names which fall in these categories. You could edit
these objects to change that behavior.

### HTMLAttribute

The standard XML Attribute is not used, though it will be converted
automatically if you set one. The difference concerns case-sensitivity.
