[![Build Status](https://travis-ci.org/bathos/hardcore-xml.svg)](https://travis-ci.org/bathos/hardcore-xml)

> This is pretty new. It’s passing the first round of tests, but there’s still
a lot more I should write and there are probably still bugs at this stage. Not
recommended for serious use yet.

# hardcore

XML and HTML parsing, editing, construction and transformation library for node.

```js
hardcore.parse('<tagline>XML, The Future of Data</tagline>', opts).then(doc => {
   const obj = doc.toObject({ rules: [ {
      match: 'tagline',
      coerce: String,
      after: str => str.replace('Future', 'Mom Jeans');
   } ] });

   console.log(obj); // { tagline: 'XML, The Mom Jeans of Data' }
});
```

<!-- MarkdownTOC autolink=true bracket=round depth=5 -->

- [Purpose](#purpose)
   - [Caveats](#caveats)
- [Parsing](#parsing)
   - [Options](#options)
      - [`strict`](#strict)
      - [`ignoreWhite`](#ignorewhite)
      - [`normalize`](#normalize)
      - [`html`](#html)
      - [`target`](#target)
   - [Parser Events in Strict and Permissive Modes](#parser-events-in-strict-and-permissive-modes)
      - [Event: `error`](#event-error)
      - [Event: `warning`](#event-warning)
      - [Event: `wat`](#event-wat)
      - [Event: `result`](#event-result)
- [Transformation](#transformation)
   - [`toXML()`](#toxml)
   - [`toObject()`](#toobject)
      - [Premise](#premise)
      - [Main Options](#main-options)
         - [Renamer](#renamer)
      - [Default Rules](#default-rules)
      - [Custom Rules (Overview)](#custom-rules-overview)
      - [Custom Rules](#custom-rules)
         - [`match`](#match)
         - [`rename`](#rename)
         - [`before` and `coerce`](#before-and-coerce)
         - [`after` and `afterPlural`](#after-and-afterplural)
         - [`plural`](#plural)
         - [`asArray`](#asarray)
         - [`ignore`](#ignore)
         - [`collapse`](#collapse)
   - [`toJSON()`](#tojson)
   - [Renamers](#renamers)
      - [`hardcore.renamers.camel`](#hardcorerenamerscamel)
      - [`hardcore.renamers.lower`](#hardcorerenamerslower)
      - [`hardcore.renamers.pascal`](#hardcorerenamerspascal)
      - [`hardcore.renamers.snake`](#hardcorerenamerssnake)
- [XML Nodes](#xml-nodes)
   - [Common Node Methods & Properties](#common-node-methods--properties)
      - [Transformation](#transformation-1)
      - [Relationships](#relationships)
      - [Validation](#validation)
   - [Regular Nodes](#regular-nodes)
      - [`hardcore.nodes.Document`](#hardcorenodesdocument)
      - [`hardcore.nodes.Element`](#hardcorenodeselement)
      - [`hardcore.nodes.Attribute`](#hardcorenodesattribute)
      - [`hardcore.nodes.Comment`](#hardcorenodescomment)
      - [`hardcore.nodes.Text`](#hardcorenodestext)
      - [`hardcore.nodes.CDATASection`](#hardcorenodescdatasection)
      - [`hardcore.nodes.ProcessingInstruction`](#hardcorenodesprocessinginstruction)
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

There are a bunch of good xml parsers and related tools for Node. I wouldn’t
claim that Hardcore is better than any of them, so you should shop around a bit
to figure out what you need.

That said, I made it because I’d never found one that did quite what I wanted --
**finely controlled** transformation to objects / json. Then I got carried away,
so now this library may also be useful to people who need to *generate* or
*manipulate* XML.

It exposes:

 - A parser constructor (writable stream)
 - A direct parse method (just sugar for the above)
 - Constructors for XML / HTML nodes
 - Some related utilities

Here’s what you can do with it:

 - Parse XML in strict or forgiving modes, including DTDs.
 - Parse HTML.
 - Edit the result. Accessors will take care of entity escapes when needed.
 - Convert back (perhaps after modification) to prettified or condensed XML.
 - Transform the result into vanilla objects or json, with fine control over
   exactly what the end result will look like: you can specify which nodes to
   ignore, which to consider ‘plural’, and you can map names, transform or
   coerce values selectively, etc.
 - Construct XML or HTML documents node-by-node using the same building
   blocks the parser uses.

The parser will return a very direct object representation of a document,
document fragment, or external DTD. It behaves somewhat like a DOM tree: each
node has a parent and, when applicable, an array of children (this is the only
100% lossless way to represent XML btw). The nodes have convenience methods to
help you navigate the tree if needed. You can convert the result, or any part of
the result, into a nice object, json, or back to xml (prettified / normalized),
and the transformation can be precisely defined through elaborate but powerful
options.

### Caveats

Hardcore is pretty hardcore by local standards for this sort of thing, but it’s
definitely not as hardcore as it could be. It’s not spec compliant, certainly.
Some of the divergences are minor and typical (for example, internode whitespace
outside the root element is always discarded). Others are more significant even
if obscure -- for example, at the moment, arbitrary substitution of sequences in
DTD declarations with parameter references is usually not supported.\*

As I write this, the module has only been in development for a few weeks. There
are tests but I’m sure I haven’t thought of every significant edge case yet.

Hardcore is so named mostly because of how deep the transformation system goes,
but it’s also able to validate a lot at the grammatical level. That said, even
strict mode will probably permit some technically illegal things. Better that,
I figure, than the reverse.

HTML mode is pretty cool about whatever you throw at it. Strict mode is meant
for XML specifically so don’t use it with HTML unless it’s XHTML. Hardcore knows
about the following HTML-specific concerns:

 - Implicit opening and closing tags, e.g. `</p>` and `<tbody>`.
 - Tags which are always self-closing and have an optional slash.
 - High-level document structure.

It does not generally know, however, about which elements are permitted to nest
in which others. Essentially it’s only aware of the minimum necessary to handle
the ways HTML diverges from XML, so it’s always much more permissive than a
‘real’ HTML parser.

Although DTD nodes are treated thoroughly, the DTD itself is *not interpreted*.
It won’t have any impact on parsing, and its validation doesn’t take into
account errors like declaring the same element twice.

An important disclaimer: Hardcore Enterprises will not be held responsible for
emotional or physical harm caused by close interaction with XML. Safety goggles,
proper ventilation and a buddy system are all recommended. While we do our best
to extract usable data quickly and painlessly, **the dangers of XML are very
real and must be respected.**

> \* If that means nothing to you, then you’re lucky and you don’t have anything
to worry about. But if you’re curious, I’m referring to the fact that in a DTD,
just about any part of any declaration can be represented by a substitution
token called a ‘parameter reference’. Declarations that include these are
difficult to model without actually interpreting the DTD itself, and we don’t.

## Parsing

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
also need to call `end()` explicitly before a result event can occur. (A valid
document can have an arbitrary number of comments and processing instructions
after the root element node is finished, so there’s no way to know a document is
complete without being told so).

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
in loose mode. In loose mode, there may be an arbitrary number of non-terminal
events emitted when the parser encounters malformed content that it (thinks it)
can recover from. You won’t be able to listen for these.

The options object in all cases is itself optional.

### Options

Minor reminder: these are the options for the parser; they are unrelated to the
options for transformation, which we’ll get to later.

#### `strict`

Default for XML: `true`.
Default for HTML: `false`.

When enabled, strict mode expects the content to comply with XML standards and
won’t abide errors (parsing will terminate). It will permit certain errors in
DTDs, though, for technical reasons\*.

In permissive/loose mode, many common errors will be corrected automatically.
More serious errors will result in a node being dropped from the result, and
some will be bad enough to halt parsing. Depending on which category the problem
falls under, the events `warning`, `wat` and `error` will be emitted
respectively.

```xml
<gerbils yes=100/>
```

This example has an unquoted attribute value. In strict mode, an error would be
emitted and parsing would end. In permissive mode, there would be a warning
event, but no real problems, since it’s obvious what was meant.

\* Specifically, ‘not caring.’

#### `ignoreWhite`

Default for XML: `true`.
Fixed for HTML: `true`.

When enabled, whitespace sequences that are technically text nodes will be
dropped from the result. This is almost always what you want. To a human there
are only two text nodes in the following example, not seven, as XML would have
it:

```xml
<gerbils>
   <gerbil>
      <name>Juniper</name>
      <superpower>controls fire with mind</superpower>
   </gerbil>
</gerbils>
```

If disabled, `<gerbils>` would have three direct children: Text, Element, Text.

In the XML spec, even whitespace occuring outside of Elements is supposed to be
preserved, though they wouldn’t be text nodes in that case. We never do this,
since it’d be a lot of hassle for something that serves literally no purpose.
Note that whitespace that would not be text nodes.

If you’re in HTML mode, this can’t be disabled, and if you have `normalize` set
to true, it’s effectively enabled by other means.

#### `normalize`

Default for XML: `false`.
Default for HTML: `true`.

If enabled, all whitespace sequence in text, comments, and CDATA are normalized
to a single space (\u0020). When parsing HTML, the elements `<pre>`, `<script>`,
and `<style>` are always excepted from `normalize`.

In addition, this option will cause empty text, comment, and CDATA nodes to be
dropped from the result.

Note that you shouldn’t fear using this if readable formatting is the concern.
The `toXML()` method can output appropriate indentation, and with the `pretty`
option active it will also add appropriate newlines to text content to create
even, readable columns at the correct depth.

#### `html`

Default: `false`.

Set to `true` when parse HTML.

In HTML mode, Hardcore becomes aware of HTML-specific concerns like elements
that may self-close without a slash. It also uses a different set of
constructors to build the result tree, and these nodes will influence the
`toXML()` output as well as provide a number of HTML-specific convenience
methods and accessors like `id` and `removeClass`.


```js
const html = '<div class="poo"><p class="poo">poo!</div>';

hardcore.parse(html, { html: true }).then(doc => {
   [ ...doc.descendents() ]
      .filter(node => node.name == 'p')
      .forEach(node => node.removeClass('poo'));

   doc.toXML();
   // <!DOCTYPE html>
   // <html>
   //   <head></head>
   //   <body>
   //     <div class="poo">
   //       <p class="">
   //         poo!
   //       </p>
   //     </div>
   //   </body>
   // </html>
});
```

If you’re sure you have well-formed XHTML (or HTML 5 that complies with XML,
which is optional for that spec), you can turn on `strict` with `html`, but I
don’t recommend it. However if you use `toXML()` the result *will* always be
valid as XML (e.g., self-closing tags will have the optional slash).

Note that the HTML parsing is -- for the most part -- not aware of which
elements are permitted contextually. Even in strict mode, this aspect of the
document will not be validated.

#### `target`

Default: `undefined`.

You can use `target` to explicitly specify the type of result expected. There
are four valid values:

 - Document
 - DocumentFragment
 - DoctypeExternal
 - Element

(These can be the literal node constructors or strings.)

By default, the parser will suss out whether the xml it’s being fed is either a
*document* or an *external DTD*. However it will never generate a fragment or an
element unless told to do so explicitly with this option.

If you do specify a target and the parsed text is not a valid example of that
target, the parser will emit an error.

### Parser Events in Strict and Permissive Modes

In strict mode, if the parser hits something it thinks is invalid, it emits an
error event and quietly dies.

In permissive mode, it’s still possible to get a show-stopping error, but it
isn’t common. Instead you’ll usually get a `warning` event or a `wat` event, and
parsing will continue. The event’s value will still be an error object.

#### Event: `error`

An error, regardless of mode, means that parsing has ceased. The error objects
are fancy business -- messages are specific and they include the offending
string when possible, with a big red shame arrow pointing at the nexus of sin.

> `error: Malformed element declaration: --><!ELEMENTS booktitle (#PCDATA)>`

There are two types of error -- HardcoreSyntaxError and HardcoreTypeError. The
first is associated with errors on a ‘grammatical’ level -- structural
malformation. In contrast, the second usually occurs when the meaning of a given
token is clear but nonetheless doesn’t constitute a valid value in its context.
The distinction isn’t exactly scientifically precise though.

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
your expectations, so you might choose to allow warnings but abort on a wat.

#### Event: `result`

Assuming there was no error and the stream has ended, you’ll get a `result`. The
object passed to the event handler is the resulting node tree (typically, a
Document).

## Transformation

Every node possesses these methods:

 - `toXML()`
 - `toObject()`
 - `toJSON()`

The `toXML` method is an alias for `toString`, btw -- so when coerced to string,
any node will become XML again.

### `toXML()`

Returns a representation of the node and all its decendents as XML. It can take
an options object with the following properties:

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

This is the core method in hardcore: take your parsed XML and transform it into
a (possibly very different) consumable data structure.

Given a set of *rules*, `toObject()` builds a new object by applying the first
matching rule to each node in a specific sequence. There’s a lot to describe
here, so before we go on I want to provide a little background about why it
isn’t ‘simple’. Skip this section if you are already painfully aware of the ways
in which XML is a radioactive hellscape.

#### Premise

Superficially, XML appears to be some kind of ... data ... format ... thing. And
you’d think, hey, it’s probably pretty simple to *translate* it, following
consistent principles, into usable objects (and thus JSON too). Of course, it is
possible to represent XML as objects -- that’s exactly what the parser does, or
the DOM for that matter. But that’s not really what you meant.

Given the XML `<a><b>xyz</b></a>`, you might picture an object representation
like this: `{ a: { b: 'xyz' } }`. That’s intuitive -- but on the other hand,
it’s much further removed from the *real* translation of the XML than it may
appear.

Even if we’re only concerned with elements, a very minimal but lossless
translation of the above ‘simple’ XML into an objects representation would need
to look something like this:

```js
{ a: [ { b: [ 'xyz' ] } ] }
```

But does that even really cover it? It doesn’t account for attributes. Although
you could get away with assigning them to the arrays themselves in JS, that’s a
bit sneaky and besides, it wouldn’t work with JSON or YAML. So really the
representation would need to be still more complex:

```js
{ a: { $attr: [], $children: [ { b: { $attr: [], $children: [ 'xyz' ] } } ] } }
```

Really, this is where you’re starting from. That’s very close to being a vanilla
representation of the original tree produced by the parser.

So what we need to begin with is some assumptions. We need to say ‘this or that
part of the data is actually not meaningful.’ It will no longer be possible to
map the data *back* to XML, but we don’t care.

1. Assume node sequence is not meaningful

Given this assumption, we can generate something like this:

```js
{ a: { b: { $text: 'xyz' } } }
```

2. An element whose only children are text nodes can be represented *as* that
   text.

```js
{ a: { b: 'xyz' } }
```

There we go. Nice! That’s what you’d get back from `toObject()` with no custom
rules, by the way. Maybe you don’t need custom rules after all!

Oh -- hold up a second. We just got a new document from the same source. I
wonder what it looks like?

```xml
<a><b>xyz</b><b xmlsucks="omg yes it does">abc</b></a>
```

Hahahahahaaaaa aaha ha hhhaaa ha! HA! ha! xmmmllll eks emm elllll

Okay, you get the idea. There is *no way* for this process to be simple. We can
make categorical assumptions, but they only get us so far because knowledge of
the possible document structure is required to generate consistent results.
Sometimes sequence does matter. Sometimes an element has mixed content.
Sometimes a node can appear more than once as siblings. Etc.

In the past, I dealt with this sort of translation from XML into usable data by
taking pieces bit by bit and constructing the real object. For larger docs with
complex requirements, the code that this leads to is not only painfully verbose,
it also inevitably turns into imperative spaghetti very quickly.

Hardcore’s rule-based system is a more-or-less declarative system meant to let
you avoid that. Each rule has a `match`, which determines whether it applies,
and in addition it may have other options that tweak the output in small or
large ways.

#### Main Options

The main options object passed to `toObject` can have these properties:

 - `rules`: An array of rules declaring how the XML will be processed.
 - `renamer`: A function, object hash, or map for renaming nodes.
 - `withNS`: Boolean (‘with namespaces’). Defaults to `false`. This will affect
   not only how names appear, but also how rules that match on names behave.

##### Renamer

Default: `hardcore.renamers.camel`.

The renamer supplied on the options object is the fallback used when a rule
doesn’t explicitly assign a new name. Either way what we’re talking about is
mapping the names of nodes -- usually Elements and Attributes -- to property
names on their parents.

If set to `undefined`, the original names will be used, but by default, names
get converted to camelcase. There are more built-in options to be found at
`hardcore.renamers` -- or you can write a custom function of your own.

Instead of a function, you can also supply an object hash or map, where the keys
are the original names and the values are the new names.

Note that nodes that don’t have ‘names’ are given generic names like '$comment'.
The dollar-sign is for collision safety (a real XML name can’t have one) and
clarity. These nodes can be renamed the same way.

#### Default Rules

In the absence of any applicable custom rules, the default transformation that
gets applied favors the most *minimal* output rather than the *safest* output.
Since these minimal results are what you want 75% of the time, it makes sense as
the starting point against which we’re writing rules that diverge.

 - Order is not preserved
 - Comments, processing instructions, and all DTD nodes are ignored
 - ‘Meta’ document properties are omitted
 - Nodes that contain only text become that text
 - Nodes with no real content are omitted

#### Custom Rules (Overview)

While the default production makes sense for the bulk of any given ‘normal’
document, if you don’t supplement it with custom rules, you’ll inevitably run
into problems. The most common problem concerns *plurality* of elements.
Consider the following case:

```xml
<litter>
   <cat>Grumpycat</cat>
</litter>
<litter>
   <cat>Lil Bub</cat>
   <cat>Maru</cat>
</litter>
```

The result of a `toObject` transformation with no custom rules would be this:

```js
{
   litter: [
      { cat: 'Grumpycat' },
      { cat: [ 'Lil Bub', 'Maru' ] }
   ]
}
```

The default production saw that litter needed to be an array because it appeared
twice. It saw the same was true for 'cat' -- but only in the second case. So now
we have inconsistency: if 'cat' can appear one-or-more times, we need to say
explicitly that it should *always* be an array, or else we’d have to use type
checks and guards just to look at the data.

A good set of options in this case might look like this:

```js
const opts = {
   rules: [
      { match: 'litter', rename: 'litters', plural: true },
      { match: 'cat', rename: 'cats', plural: true }
   ]
};

/* ...leading to: */

{
   litters: [
      { cats: [ 'Grumpycat' ] },
      { cats: [ 'Lil Bub', 'Maru' ] }
   ]
}
```

I think that’s a good illustration of what the point of all this blathering is.

To write rules, it helps to understand the sequence in which they’ll be applied.
Consider this example:

```xml
<elemR>
   <elemA attr="true">
      <elemB>abc</elemB>
      <elemC>def</elemC>
   </elemA>
</elemR>
```

Initially, `toObject` walks the tree starting from the node you called the
method on, working its way down each path from top to bottom, left to right. A
representation of each node is created. By default, these representations -- the
‘base value’ -- will always be objects or strings, but you can generate a custom
base value via a rule’s `before` option. In this phase, `ignore` and `collapse`
options are also applied and the node’s new name, if any, will be determined.

<pre>
                                     (obj) <------ type: Document
                                       |
                                     (obj) <------ type: Element, name: elemR
                                       |
                                     (obj) <------ type: Element, name: elemA
                                    /  |  \
type: Attribute, name: attr --> (str)(obj)(obj) <- type: Element, name: elemC
                                       |    |
                                     (str)(str) <- type: Text, name: '$text'
</pre>

When a leaf node is reached, the transformer begins walking backwards. When each
node is encountered for the second time (unless it was ignored), it may have a
rule’s `after` function applied, and then it gets linked to its parent as a
property or member as appropriate.

The sequence will be familiar if you’ve ever used a sax parser. In a sense,
hardcore’s `toObject` works a lot like a souped up, specialized sax parser. This
is the walk sequence for the above document:

 01. before elemR
 02. before elemA
 03. before attr
 04. after attr
 05. before elemB
 06. before *abc*
 07. after *abc*
 08. after elemB
 09. before elemC
 10. before *def*
 11. after *def*
 12. after elemC
 13. after elemA
 14. after elemR

#### Custom Rules

Each rule in `rules` is an object that describes a match and one or more
optional behaviors.

 - `match`: This is the filter that determines whether the rule applies.
 - `rename`: A new name for the node or a function that produces one.
 - `before`: This optional function returns a value to represent the node.
 - `after`: This optional function can perform a final transformation after
   a node’s children have been handled.
 - `coerce`: This option is shorthand for the most common uses of `before`.
 - `ignore`: If true, the node (and any children it may have) will be discarded.
 - `collapse`: If true, the node’s children will be ‘inherited’ by its parent
   (even if `ignore` was true). If the value is a string, the node will be
   replaced by the child of that name.
 - `plural`: If true, the node will end up being the member of an array. If
   explicitly false, the node will always be singular, even if it had same-name
   siblings (in which case the last value will be the one that gets through).
 - `afterPlural`: Because `after` runs on the values associated with individual
   nodes, `afterPlural` exists to allow you to also specify an ‘after’ for the
   thus-produced array as well. Useful if you need to apply a sort function.
 - `asArray`: This makes a node that would have been an object into an array,
   where its children are the members, so the sequence is explicitly preserved.
   This is very different from plural: plural says ‘I am one of potentially
   several’ while ‘asArray’ says ‘the sequence of my children matters so I
   cannot be mapped to a concise object.’



##### `match`

This is the only required property for a rule. There are four types of matches.
More specific matches must come before more generic matches, because only the
earliest matching rule will be applied.\*

 - **Name / key matches**
   - String: `'name'`
   - Regex: `/^name$/`
 - **Node matches**
   - Constructor: `Comment`
 - **Custom function matches**
   - Function: `function(node) { return node.children.length == 2 }`
 - **Wildcard matches**
   - Boolean: `true`

While the match value could be any of these, it can also be an array with more
than one -- for example, `[ Element, 'cat', 'kitten' ]`. This requires
additional explanation. 

In an array match, values of one type (name, node, or function; wildcard
wouldn’t make sense) are ‘or’ matches: match nodes with the name ‘kitten’ OR the
name ‘cat’. But values of different types are ‘AND’ matches: match nodes that
are Elements *and* have *either* of those names. 

This fits well with real world use. It is far more useful to be able to say
`[ Attribute, 'id' ]` (attributes with the key 'id') than to be able to say
"attributes OR any node named 'id'" -- to achieve the latter, were one really to
desire it, would demand a custom matching function.

If you use the `true` wildcard, it should always appear last in your rule list.
The most obvious use for it is to `ignore` all nodes that weren’t addressed by
other rules, but I suppose there could be other obscure use-cases (like if you
wanted to generate a ‘meta’ object describing the document structure).

Note that the three HTMLElement nodes all inherit from Element and thus may be
matched with it; likewise Attribute is inclusive of HTMLAttribute.

> \* This constraint -- that only the first matching rule applies -- is
something I might tweak in the future via an additional option. I’m not sure if
it’s needed yet, but it would potentially be nice to be able to say a rule has a
‘passthrough’ property. If it did, should it build a composite rule favoring the
first explicitly defined option, or should it apply them in succession, the way
`before` and `coerce` work?

##### `rename`

This can be either a string or a function that returns a string. If it’s a
function, its arguments are the original name and the node. If present, `rename`
overrides the main `opts.renamer`.

##### `before` and `coerce`

The `before` function receives the original Node and whatever *would* be its
generic representation (baseVal below). It returns a value which will represent
this node in the result object. It’s fine to just mutate the given baseVal and
return that.

```js
function before(node, baseVal) { /* ... */ }
```

The baseVal of a node is always an object (e.g. Element) or a string (e.g.
Text, Attribute). If you return a primitive, but the node has children, the
children will end up being ignored unless `collapse` was true (because otherwise
they no longer have anything to get attached to). For our purposes, `Date` 
instances are treated as if they were primitive.

There is one special case, `undefined`. Returning `undefined` will cause the
node to be ignored.

While Element’s baseVal is a generic empty object, more exotic nodes come with
properties already attached. For example, if you choose to include processing
instruction nodes, the baseVal will be an object with the properties
`$target` and `$instruction`.

The `coerce` option is shorthand for certain common `before`s related mainly to
Element and Attribute nodes. Valid values for `coerce` are:

 - Boolean
 - Date
 - Number
 - String

Even though `coerce` is shorthand for pre-defined `before` functions, you can
use both. If both are defined, the coercion will occur first; therefore `before`
will receive the result of the coercion as its second argument. This is quite
useful when using `coerce: String`.

Depending on the node type, coerce’s exact behavior changes. In all cases, what
`coerce` is interested in is text content. For nodes like Attribute, whose base
value is already a string, this may be as simple as `new Date(baseVal)`. For
object nodes, however, coerce takes the total text content of the node’s
*immediate* children as the value to be cast (this is why String, which would
be redundant in the former case, is one of the options).

```xml
<cat name="Spottis" age="12">
   <perfect>yes</perfect>
   <fur>white / black</fur>
</cat>
```

```js
const rules = [
   { match: [ 'age' ], coerce: Number },
   { match: [ 'cat' ], collapse: true },
   { match: [ 'fur' ], coerce: String, before: (node, val) => val.toUpperCase() },
   { match: [ 'perfect' ], coerce: Boolean }
];

// ...

{ name: 'Spottis', age: 12, perfect: true, fur: 'WHITE / BLACK' }
```

The Boolean coercion recognizes common analogue values like ‘yes’ and ‘N’. Date,
however, expects strings that will work with native Date parsing; if you need to
convert more specialized date strings, coerce to String and use `before`.

##### `after` and `afterPlural`

After the `before` phase, any children of the node will also be processed. When
applicable, they’ll be attached to the object made previously, typically as
properties.

Once all children are complete, we return to the node/new value pair. At this
point `after` will be applied if provided. This lets you perform further custom
transformation, this time taking into account child properties.

The `after` function receives as its arguments the created object, the original
node, and the name it will have. The return value will supplant the former
value. Returning `undefined` will be taken literally in this phase.

`function after(val, node, name) {}`

This is the powertool of rule options. You can use it to perform any kind of
aggressive manipulation, including making significant changes to the data
structure, because at this point you’re dealing with what would be the final
result for this node and its descendents.

Most users won’t need it much. It invites some of the imperative logic we’re
trying to get away from after all. But sometimes you’re dealing with complex
documents with poor data structures and it can’t be avoided. At least `after`
lets us keep things well-organized.

An `afterPlural` function, if provided, is the same, but gets called with the
resulting array as its value. This special ‘after’ is included because the
`after` of a plural rule applies to the individual array members (which map
back to nodes) rather than the resulting collective array. Its primary use cases
would be to sort, filter, or reduce a plural node.

##### `plural`

If `plural` is true, the node will be treated as an array member. For many users
this could be the only option you need; it’s certainly the most common. By
default, a node will only become an array member if it has siblings of the same
name. This can lead to problems when a node *may or may not* have such siblings,
since you want to have a consistent result regardless. By setting `plural` to
`true`, you’ve indicated that the result should always be an array.

##### `asArray`

With `asArray`, a node will be represented as an array of its children. The
distinction between this and `plural` is important. You use `asArray` to ensure
that all children of a given node are maintained as a sequence; same-name
children will not be merged since each will belong to a unique member object.

Since this produces significantly more verbose, difficult output, you should
only use it in contexts where overall child node sequence is critical data, like
in mixed text markup such as HTML.

##### `ignore`

An ignored node is eliminated from the result. Its children will also be
ignored -- unless `collapse` is true, in which case they will be inherited by
the ignored node’s parent.

##### `collapse`

If collapse is `true`, the node’s children will be treated as children of this
node’s parent. There are two common cases for this:

 - The node is ignored but its children should not be.
 - The node is to become a primitive value, and therefore cannot carry children.

If a node’s collapse causes it to have no content, it will end up being ignored,
so you don’t actually need to set both:

```xml
<cats><cat>maru</cat><cat>spooky</cat></cats>
```

```js
const rules = [ { match: 'cats', collapse: true } ];

// ...

{ cat: [ 'maru', 'spooky' ] }
```

Collapse can also be set to a string value. In this case, the child of that name
will *replace* this node’s value.

```js
const rules = [ { match: 'cats', collapse: 'cat' } ];

// ...

{ cats: [ 'maru', 'spooky' ] }
```

The key differences here are that the targetted child ends up taking on the name
of the parent, and while the parent is implicitly ignored, as before, so are the
other children.

This is most useful in cases where a document has an unnecessarily complex
hierarchy -- redundant structures like `<bees><bee>1</bee><bee>2</bee></bees>`
are beloved in XML, but without collapsing, their direct translation is nearly
incoherent: `{ bees: { bee: [ '1', '2' ] } }`.

### `toJSON()`

This is just sugar for toObject + JSON.stringify, so it has the same options as
`toObject`, plus:

 - `tab`: The indentation string.

I wanted to throw in toYAML, but given the existing solutions on NPM and their
size, it seemed more sensible to leave including that up to the user if they
need it. The package 'yamljs' seems like the best bet, so you can just convert
to object and then apply that module’s `stringify` method. The only catch is
that while YAML supports comments, to include them properly you’d need to do
some extra somersaults.

### Renamers

You can supply a custom renamer (or null), but some of the more obvious ones are
made available out of the gate. All of these renamers will strip out characters
that would be illegal in JS property identifiers, so that you don’t need to use
computed property accessors. (Reserved words like ‘default’ aren’t stripped --
linter complaints aside, these are legal as literal property names).

#### `hardcore.renamers.camel`

Standard JS-style camelcase. Common acronyms are handled intelligently (e.g.
'ID' => 'id', but 'CatId' => 'catID'). The acronym list is hardly comprehensive
(I mean, it can’t be, really) but I tried to cover stuff likely to appear in
this context, like ‘ID’ and ‘URL’. Numbers with decimals are given special
treatment, too: 'xyz\_1.2' => 'xyz1\_2'

#### `hardcore.renamers.lower`

Entirely to lowercase.

#### `hardcore.renamers.pascal`

Constructor case in JS land. Simply camel with the first character uppercase.

#### `hardcore.renamers.snake`

Snake case -- lowercase with underscores between words. Studies have shown that
users of snake case are 0.7% more likely to quote statistics about reading speed
and identifier naming.

## XML Nodes

APIs that send XML often take XML, too. The node constructors are all exposed at
`hardcore.nodes`. You can use them to construct documents from scratch or to
augment documents after parsing, then call `toXML()` (nice for update
operations).

When constructing nodes or generating XML, there’s still a fair amount of
validation behind the scenes, and if you try to do certain illegal stuff, it
will throw. But it’s effectively always in loose mode and will fix a lot of
stuff automatically:

```js
const elem = new hardcore.nodes.Element({ name: 'pizza' });

elem.setAttribute({ key: 'toppings', value: 'anchovies & olives' });

elem.toXML(); // => <pizza toppings="anchovies &amp; olives" />
```

Many nodes have methods to make document editing and constuction a little
easier. In the example above, we make use of Element’s `setAttribute()` method,
which (given that there wasn’t already a "toppings" attribute) could have been
done like this instead:

```js
elem.attributes.push(new hardcore.nodes.Attribute({ /* ... */ }));
```

Each of the node constructors takes an options object at instantiation. Despite
the terminology, these are often *not optional*. You cannot create an Element
without a name, for example.

Nodes like Text and Comment only have one real property of note, `content`. For
these, a string is acceptable instead of an object: `new Text('my content')`.

### Common Node Methods & Properties

#### Transformation

As described in the transformation section, all nodes (as well as all ‘children’
properties -- we’ll get to that) have `toObject`, `toJSON` and `toXML`. You
don’t need to call these from the document root; you can transform any subset of
the tree.

The other method to note here is `clone()`, which can be used to create an
identical node (including cloned descendents). This is needed because a given
node can’t occupy two positions at once; there can only be one parent at a time.

 - `clone()`
 - `toJSON()`
 - `toObject()`
 - `toXML()` / `toString()`

#### Relationships

 - `parent`: The immediate parent node.
 - `parents`: An array of all parents from nearest to root.
 - `children`: An array of the immediate child nodes.
 - `siblings`: An array of sibling nodes not including self.
 - `next`: The next sibling.
 - `prev`: The previous sibling.
 - \* `lineage()`: Iterator for ancestors, but *inclusive of self*.
 - \* `descendents()`: Iterator for descendent nodes (see below).
 - \* `tree()`: Iterator for descendent nodes (see below).
 - `findNearestAncestor(predicate)`: Returns first matching ancestor.
 - `findNearestDescendent(predicate)`: Returns first matching descendent.
 - `remove()`: Divorces a node from its parent (returns the node).
 - `add(node)`: Adds a node as a child.

When a node has children or parents, these relationships are accessible via
accessor properties and methods to assist navigation and ‘querying’. The three
methods marked with asterisks are generators. Both iterate *away* from the node.

While `lineage()` has an obvious iteration sequence (each node can have only one
parent), there are two options for iterating over descendents. The
`descendents()` iterator moves through children first to last in *generations*,
such that immediate children are first, followed by the immediate children of
each member of that generation, and so on. The `tree()` iterator moves first to
last along *branches*, such that the first immediate child’s own children come
before the second immediate child.

Note 1: Descendents do not include attributes.

Note 2: Some nodes never have children (e.g. Comment) and some never have
parents (e.g. Document), so it makes no sense to look for them.

The "findNearest..." methods return the first node (if one exists) matching the
predicate function. Note that the descendent version uses the walking pattern
from `descendents()`, not `tree()`.

When `children` is available -- which is only true for certain node types -- it
is an array-like object. You can’t assign to indices, but it has all the usual
methods like `map()` and `unshift()`, it has a length property, and it’s
iterable. The reason it can’t be a straight-up array is because we need to
manage parent-child relationships; when Proxy and real Array subclassing arrives
in Node, I’ll go back and improve this sad compromise.

(Note, methods like `map` return arrays, not children-objects.)

The `remove()` and `add()` methods are sugar for splicing and pushing into
`children` (though `remove()` also works with attributes).

#### Validation

 - `isValid()`

This is mostly meant for internal use, but it’s there, so let’s document it!

The `isValid()` method exists on all nodes, but in many cases it will always
return `true` (these nodes just can’t end up in an invalid state unless you’re
being *really* naughty). Mainly it does more only when a node has more complex
requirements regarding its properties and children. For example, a Document will
be invalid if it doesn’t have one (and only one) Element among its children.

An important caveat about `isValid` is that it isn’t recursive. When it involves
children, it only involves them insofar as their direct relationship goes -- so
an `ElementDeclaration` will be invalid if it has a content spec and its type is
"ANY", an incompatible combination -- but it won’t be invalid just because one
of the members of the content spec is itself malformed.

### Regular Nodes

Now we’ll get into the details of the individual constructors. From here on, I’m
going to omit the `hardcore.nodes` prefix in examples, since if you’re really
using these, you’d probably assign them to local variables.

#### `hardcore.nodes.Document`

Normally Document is our ‘target’ -- an instance of Document is the usual result
when you’ve parsed something.

A document often begins with an xml declaration. This isn’t really a node, but
rather describes properties of the document itself, so that’s how it’s modeled
here. The properties in question are `version`, `encoding` and `standalone`.

A valid document can have zero or one DTD and exactly one element as children,
in that order. But it can also have any number of comments and processing
instructions, anywhere. Since everything but the element is optional, a valid
document can be as simple as a single element.

**Argument Object**

 - `version`: The xml version, which is any number >= 1 and < 2. Optional.
 - `encoding`: An optional string indicating the document encoding.
 - `standalone`: An optional boolean that presumably means something.

**Properties**

 - `version`: As above.
 - `encoding`: As above.
 - `standalone`: As above.
 - `children`: May contain Element, Comment, ProcessingInstruction, Doctype.
 - `doctype`: Sugar accessor for the doctype.
 - `root`: Sugar accessor for the element.

The two sugar properties provide a convenient way to get and set the doctype
and root element, since there can only ever be one of either. When used for
setting, the node will be inserted at the beginning or end of children
respectively if one did not previously exist; otherwise it replaces the former
doctype / element at its current index.

```js
document.root = new Element({ name: 'hello' });
```

#### `hardcore.nodes.Element`

For most folks, Element -- along with Attribute (which isn’t *really* a node)
and Text -- is all that matters. It’s the iconic XML node, made up of either
an open and close tag or a single self-closing tag.

**XML Example**

```xml
<hello>yes<what/></hello>
```

That’s a "hello" element, which has an open and a close tag, and its two
children, a Text node and another Element, which is self-closing.

**Argument Object**

 - `name`: Required: The name of the element.
 - `namespace`: Optional prefix.
 - `text`: Optional, sugar for adding a single child text node.
 - `attributes`: More optional sugar. You can assign attributes at instantiation
   by providing a simple object hash like `{ id: 'myID' }`.

**Properties**

 - `name`: As above.
 - `namespace`: As above.
 - `children`: May contain CDATA, Comment, Element, ProcessingInstruction, Text.
 - `attributes`: May contain Attribute.
 - `fullName`: The name inclusive of namespace if applicable (not settable).
 - `text`: The *total* text content of all descendents (not settable).
 - `addText(str)`: Sugar for `elem.children.push(new Text(str))`.
 - `getAttribute({ namespace?, key })`: Returns the value for an attribute.
 - `setAttribute({ namespace?, key, value })`: Sets or adds this attribute.
 - `removeAttribute({ namespace?, key })`: Removes an attribute.

The convenience methods for interacting with attributes are all sugar methods
for interacting with `elem.attributes`, which is a ‘children-style’ array-like,
directly, taking advantage of the fact that an attribute key (or namespace-key
pair) is always unique per element instance.

The `text` accessor provides a convenient means to look at text content without
more complex navigation and searching. The text thus accessed will have its
entities unescaped. This makes it easy, for example, to do a full text search of
a freshly parsed document without worrying about markup getting in the way:

```js
doc.root.text.match(myPattern);
```

#### `hardcore.nodes.Attribute`

An attribute is a key-value pair (with optional namespace) that may appear in an
Element’s `attributes` array-like. In XML notation, these appear in the opening
tag of an Element after its name: `<tag key="value">`.

An attribute’s value may include entity references, just like Text node content.

In XML, a value is required (even if it’s an empty string) and it must be
quoted. HTML waives both requirements.

Although this constructor is exposed, you probably won’t need it; Element has
methods for getting and setting attributes that are generally more convenient.

**Argument Object**

 - `key`: Required.
 - `namespace`: Optional prefix.
 - `value`: Optional string; illegal characters will be automatically turned
   into entity references. If omitted, defaults to an empty string.

**Properties**

 - `key`: As above.
 - `namespace`: As above.
 - `value`: As above.
 - `fullName`: Namespace + key (not settable).

#### `hardcore.nodes.Comment`

A comment can contain pretty much any text except the sequence '--'. It also
can’t end with '-'. If you set a value with these sequences, however,  they’ll
be corrected to '- -' and '- ' automatically.

Comments don’t allow entity references, but also don’t need them (that is,
`&amp;` is literally those five characters).

**Argument Object**

 - `content`: Optional. The text of the comment. Defaults to ''.

The constructor argument can also be the content string itself.

**Properties**

 - `content`: As above.

#### `hardcore.nodes.Text`

Text nodes require '<' to be an escaped as an entity reference, as well as '>'
when it appears in the sequence ']]>'. This will be done automatically if
needed.

**Argument Object**

 - `content`: Optional. The text itself. Defaults to ''.

The constructor argument can also be the content string itself.

**Properties**

 - `content`: As above.
 - `cleanContent`: The content with XML entity references converted to normal
   characters (not settable).

#### `hardcore.nodes.CDATASection`

A CDATA section is a type of ‘marked section’ that contains text that doesn’t
need to use entity references to encode ampersands or less-than signs. But it
still can’t contain its own closing sequence (]]>) of course, and since entities
aren’t interpretted that sequence also cannot be escaped.

CDATA is actually just a text node with special properties. Thus its content
will be included in an Element’s `text` property and it’s treated as text by
`toObject()` as well.

**Argument Object**

 - `content`: Optional. The text of the comment. Defaults to ''.

The constructor argument can also be the content string itself.

**Properties**

 - `content`: As above.

#### `hardcore.nodes.ProcessingInstruction`

A processing instruction is a directive that targets a specific interepreting
agent. They’re the ones that begin with '<?'; you know them from PHP, the XML of
programming languages.

I kid, I kid.

**Argument Object**

 - `target`: Required. The target of the processing instruction (e.g. 'php').
 - `instruction`: Optional. The instruction text, which can be anything not
   containing '?>'.

**Properties**

 - `target`: As above.
 - `instruction`: As above.

#### Bonus node: `hardcore.nodes.DocumentFragment`

DocumentFragment is nearly the same as the ‘children’ part of an Element. Many
XML tools include this since it’s convenient even though it isn’t actually a
node. I’m not sure this works the same as DocumentFragments as found elsewhere,
though, because it’s restricted to Element content.

DocumentFragment is one of the options for `target` when parsing.

```js
const fragment = new DocumentFragment();

fragment.push(new Comment('whatevs'));
```

**Argument Object**

*takes no arguments*

**Properties**

- `children`: May contain CDATA, Comment, Element, ProcessingInstruction, Text.

### DTD Nodes

Turn back now! It’s not too late! This section is haunted! Woo~ooo~ooo!

#### `hardcore.nodes.Doctype`

The Doctype can occur in a Document somewhere before the root element. Usually
this is really simple and benign and looks like this:

```xml
<!DOCTYPE html>
```

But if you hate yourself, it can actually contain a DTD (doctype definition),
which is a set of definitions that describe which elements, attributes,
entities, and other stuff can appear in the document and how they should behave,
what constitutes their being well-formed, or what they mean. It sounds useful
but don’t be fooled.

**Argument Object**

 - `name`: Required. The doctype name, like 'html'.
 - `systemID`: Optional.
 - `publicID`: Required if `systemID` is present, else invalid.

**Properties**

 - `name`: As above.
 - `systemID`: As above.
 - `publicID`: As above.
 - `children`: May contain Comment, ProcessingInstruction, ParameterReference,
   and any of the ‘Declaration’ nodes.

The presence of members in `children` will turn this into an internal DTD.

#### `hardcore.nodes.DoctypeExternal`

The alternative to an internal DTD is an external one -- a standalone document
that is (with small exceptions) the same as the `children` part of a Doctype.
This is one of the valid choices for `target`, though the parser can detect it
automatically.

Like Document, DoctypeExternal can have an xml declaration, except here it gets
called a ‘text declaration’ and only has the `version` and `encoding`
properties, and `version` is optional.

**Argument Object**

 - `version`: Optional. The xml version, a number >= 1 and < 2.
 - `encoding`: Optional. The encoding string.

**Properties**

 - `version`: As above.
 - `encoding`: As above.
 - `children`: May contain the same as Doctype, plus ConditionalSection.

#### `hardcore.nodes.ConditionalSection`

A conditional section is a weird thing that can only occur in external DTDs.
It’s a ‘marked section’ (like CDATA) whose keyword may be either IGNORE or
INCLUDE. Those indicate that the contents -- which are just more DTD rules --
are to be either ... ignored or included. But you wouldn’t use those words
directly, even though they’re legal.

The utility of this is that the keyword may be a *parameter reference* that
resolves to IGNORE or INCLUDE. In this manner, sections of the DTD can be
activated or deactivated conditionally based on which word the parameter
reference was set to.

Oh my god, why am I explaining this. No one will ever use this.

**XML Example**

```xml
<!ENTITY % withPizza 'INCLUDE'>

<![%withPizza;[
    <!ELEMENT pizza EMPTY>
]]>
```

**Argument Object**

 - `keyword`: The keyword of the section. It can be 'IGNORE', 'INCLUDE' or a
   parameter reference (e.g. "%myParam;"). Required.

**Properties**

 - `keyword`: As above.
 - `children`: Same as DoctypeExternal.

#### `hardcore.nodes.ParameterReference`

A parameter reference looks like an entity reference but with ‘%’ instead of
‘&’. Defined with EntityDeclarations, these can appear in DTDs on their own.
(They can also be used as names for ConditionalSections, but you don’t need
the constructor for that).

**XML Example**

```xml
%myParam;
```

**Argument Object**

 - `name`: The name of the parameter. It doesn’t matter if you include the
   surrounding punctuation or not. Required.

The only property is `name`.

#### `hardcore.nodes.ElementDeclaration`

Defines an element, except its attributes (use AttListDeclaration for that). The
definition describes what kind of children may appear inside, and this is sort
of complicated -- the next two classes are used for that.

**XML Example**

```xml
<!ELEMENT pizza EMPTY>
```

**Argument Object**

 - `name`: Element name, required.
 - `namespace`: Optional.
 - `quantifier`: If `type` is 'ANY' or 'EMPTY' this will always be ''. If `type`
   is 'MIXED' it can be '' or '*'. If `type` is 'CHOICE' or 'SEQUENCE' it can be
   '+', '?' or '*'. It describes the number of times the outermost group of
   legal children can repeat. Defaults to ''.
 - `type`: Can be 'CHOICE', 'SEQUENCE', 'MIXED', 'ANY' or 'EMPTY'. Choice means
   the outermost legal children group is a list of ‘or’ choices. Mixed means the
   same, but also allows text nodes to appear. Sequence means the outermost
   group describes a specific series where order matters. Any and empty do what
   they sound like, and require that `contentSpec` remains empty (no children).

**Properties**

 - `name`: As above.
 - `namespace`: As above.
 - `fullName`: The usual; not settable.
 - `quantifier`: As above.
 - `type`: As above.
 - `contentSpec`: A special instance of ChildElementGroup. It may contain
   ChildElementGroup and ChildElementName, but what is and isn’t legal varies
   depending on the type and quantifier.

The `contentSpec` is a variation on ChildElementGroup, which in turn is a
‘children’ array-like. It differs because it must take into account properties
of the element declaration itself.

The requirements for producing a legal ElementDeclaration are byzantine, and it
would be easy to place it in an invalid state, so be careful.

#### `hardcore.nodes.ChildElementGroup`

ChildElementGroup is a parenthesized list of one or more ChildElementNames or
additional ChildElementGroups. It is an array-like, but it has unique structural
requirements. Although it can recursively contain more CEGs, the ‘leaf’ nodes
of every branch must be ChildElementName.

**XML Example**

```xml
<!ELEMENT piñata (candy|toy|sadness)* >
```

The ChildElementGroup here has three ChildElementName members. When the group is
the root (content spec), as here, `quantifier` and `type` are actually the same
as those of the declaration itself -- it doesn’t matter whether you set them on
the ElementDeclaration or its `contentSpec` property. In this case, the `type`
is "CHOICE" and the `quantifier` is "*".

**Argument Object**

 - `quantifier`: This can be '', '+', '?' or '*', though the `type` may restrict
   which of these are valid on the root content spec.
 - `type`: For non-root ChildElementGroups, the type may only be "CHOICE" or
   "SEQUENCE". For the root content spec, see the description at
   ElementDeclaration; there are additional options.

**Properties**

 - `quantifier`: As above.
 - `type`: As above.

#### `hardcore.nodes.ChildElementName`

In the example below, "kitten" is a ChildElementName. The declaration’s type
here is "SEQUENCE" -- that’s why the elements are comma seperated. While
ChildElementGroups can nest more ChildElementGroups, each ‘leaf’ group must
contain at least one ChildElementName.

**XML Example**

```xml
<!ELEMENT litter (kitten+, runt) >
```

The + sign is inside the group, meaning it’s the quantifier of the
ChildElementName as opposed to the group.

**Argument Object**

 - `name`: Element name, required.
 - `namespace`: Optional.
 - `quantifier`: An empty string (default) or '+', '?' or '*'. Depending on the
   parent ElementDeclaration’s type, valid quantifiers may be restricted.

Properties are the same as the arguments.

#### `hardcore.nodes.AttListDeclaration`

An AttListDeclaration describes the attributes to associate with an element.
Logically, these might as easily have been part of the ElementDeclaration since
each AttListDeclaration can correspond with only one Element, but being verbose
themselves, this if probably for the best.

**XML Example**

```xml
<!ATTLIST pizza topping (anchovies|olives|sadness) "anchovies">
```

In this example, pizza is the name of the element, and topping is the name of
its one attribute. This is followed by an enumeration of valid values and a
default value to use if the attribute is absent.

When the `pretty` option is used with `toXML()`, the attribute definitions
within will be aligned as a table:

```xml
<!ATTLIST student_name
    student_no               ID                       #REQUIRED
    tutor_1                  IDREF                    #IMPLIED
    tutor_2                  IDREF                    #IMPLIED>
```

**Argument Object**

 - `name`: Element name, required.
 - `namespace`: Optional.

**Properties**

 - `name`: As above.
 - `namespace`: As above.
 - `defs`: Another children array-like. May contain AttributeDefinition.

#### `hardcore.nodes.AttributeDefinition`

A single AttributeDefinition is a member of the `defs` property described above.
This is another relatively complicated one.

**Argument Object**

 - `name`: The attribute name, required.
 - `namespace`: Optional.
 - `type`: May be '' (default), 'CDATA', 'ENTITIES', 'ENTITY', 'ID', 'IDREF',
   'IDREFS', 'NMTOKEN', 'NMTOKENS', or 'NOTATION'
 - `defaultType`: May be '', '#FIXED', '#IMPLIED' (default), or '#REQUIRED'.
 - `defaultValue`: String. Required if `defaultType` is '' or '#FIXED'; invalid
   otherwise.
 - `members`: An array of strings, optional. This is meant to be an enumeration
   of valid values. Can only be included if `type` is '' or 'NOTATION'.

Properties are the same as above.

Note that the `members` array is *not* a children array-like. It should be set
to a regular array (of strings) or not set at all, depending on the `type`.

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

**XML Example**

```xml
<!ENTITY greeting "hello">
```

Then you could use '&greeting;' anywhere that entity references are allowed.
You might expect this one to be simple, but this is still XML.

**Argument Object**

 - `name`: Entity name, required.
 - `isParameter`: Boolean (default false), indicates this is a parameter entity.
 - `ndata`: If a regular entity is defined using an external ID, this is an
   optional name string indicating balwiwjw whatever who cares.
 - `publicID`: If there’s a `systemID`, there can also be a `publicID`.
 - `systemID`: The system literal identifier if you swing that way.
 - `value`: A string value that the entity should resolve to.

Properties are the same as above.

Note that `value` is mutually exclusive with `systemID`, and `publicID` is only
valid if there’s also a `systemID`.

#### `hardcore.nodes.NotationDeclaration`

Go ahead, declare a notation with this handy helper!

**XML Example**

```xml
<!NOTATION xml-is-stupid PUBLIC "blergh">
```

**Argument Object**

 - `name`: Required.
 - `namespace`: Optional.
 - `publicID`: You know, the public ID. Of the notation.
 - `systemID`: Here’s a thing too.

Properties are the same as above.

Either `publicID` or `systemID` is required, or both. Unlike other cases with
these properties, though, you can have `publicID` on its own here.

## HTML

There are a handful of special subclasses for use with HTML; these will be used
if you parse in HTML mode.

Unlike XML, in HTML element and attribute names are case insensitive, and
hardcore will normalize to lowercase.

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

There are also three methods to make `class` nice:

 - `addClass(name)`
 - `hasClass(name)`
 - `removeClass(name)`

To be honest, I don’t expect anyone is likely to use hardcore for HTML class
manipulation of this sort, but it’s just plausible enough and wasn’t much
trouble to include.

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
these to change the behavior.

### HTMLAttribute

The standard XML Attribute is not used, though it will be converted
automatically if you set one. The difference concerns case-sensitivity.
