> WORK IN PROGRESS. This isn’t done yet -- I just needed to get it up here at
this point so that I could access the codebase from multiple comps.

# hardcore

XML and HTML parsing, editing, construction and transformation library for node.

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
   - [Parser Events in Strict and Permissive Mode](#parser-events-in-strict-and-permissive-mode)
      - [Event: `error`](#event-error)
      - [Event: `warning`](#event-warning)
      - [Event: `wat`](#event-wat)
- [Transformation](#transformation)
   - [`toXML()`](#toxml)
   - [`toObject()`](#toobject)
      - [Premise](#premise)
      - [Main Options](#main-options)
         - [Main Renamer](#main-renamer)
      - [Default Rules](#default-rules)
      - [Custom Rules](#custom-rules)
         - [`match`](#match)
         - [`rename`](#rename)
         - [`before` and `coerce`](#before-and-coerce)
         - [`after` and `afterPlural`](#after-and-afterplural)
         - [`plural`](#plural)
         - [`asArray`](#asarray)
         - [`ignore`](#ignore)
         - [`collapse`](#collapse)
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
 - Some utilities

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

### Caveats

Hardcore is pretty hardcore by local standards for this sort of thing, but it’s
definitely not as hardcore as it could be. It’s not spec compliant, certainly.
Some of the divergences are minor and typical (for example, internode whitespace
outside the root element is always discarded). Others are more significant even
if obscure -- for example, at the moment, arbitrary substitution of sequences in
DTD declarations with parameter references is usually not supported.\*

Neither DTDs nor HTML were the chief reasons for Hardcore to exist, hence the
more relaxed attitude. That said, both will be adequate for most use cases.

As far as validation goes, what Hardcore is pretty purely interested in the
document at a ‘grammatical’ level. Even when a DTD is present, the data within
it is not used in any way to interpret or validate the document.

HTML mode is pretty cool about whatever you throw at it. Hardcore knows about
stuff like implicit elements and tags, which tags may self-close without a
slash, and overall document structure. On the whole it does not know, however,
about which elements are legal as children of other elements. With HTML, the
aim is just to parse, and any validatation is incidental to that goal.

Finally note that using this library may mean coming in close contact with XML.
All usual safety precautions apply: use in a well-ventilated area and make sure
a friend knows where you are. Have them check in on you occasionally. Meet in a
public space. Do not operate heavy machinery, do not shake the baby. Hardcore
Enterprises cannot be held responsible for emotional or physical harm caused by
interaction with XML.

> \* Since this may be the one thing keeping Hardcore from being fully able to
handle all DTD crap, I’m tempted to find a solution for it at some point, but
these sorts of things are a pretty huge hassle since any given member, even
members which themselves would normally be represented by objects rather than
names, can be represented by a PR in theory.

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

Or, if you just wish the world would stop *changing*:

```js
hardcore.parse(xmlStr, opts, function(err, doc) {
   /* ... */
});
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

The `toObject` method was the main point of hardcore to begin with. Although you
could use it with the default settings, you’re probably going to want to do some
configuration -- and that configuration goes a bit deeper than what you’d
usually put into an ‘options’ object, so I want to give some background on what
the point of all this is, first. Skip this section if you already know why 
working with XML data is a radioactive hellscape.

#### Premise

Superficially, XML appears to be some kind of ... data ... format ... thing. And
you’d think, hey, it’s probably pretty simple to *translate* it, following
consistent principles, into usable objects (and thus, JSON and YAML, too). Of
course, it is possible to represent XML as objects -- that’s exactly what the
parser does, or the DOM for that matter. But that’s not really what you meant.

Given the XML `<a><b>xyz</b></a>`, you might picture an object representation
like this: `{ a: { b: 'xyz' } }`. Mmm. Yes, that *would* appear to make sense,
wouldn’t it? Unfortunately, that is definitely not what that XML translates to.

The most minimal lossless translation of the above ‘simple’ XML into objects
would need to look something like this:

```js
{ a: [ { b: [ 'xyz' ] } ] }
```

That doesn’t even account for attributes. Well, to be fair, in JS, an array may
possess arbitrary properties, and given that the set of legal XML attribute
names wouldn’t conflict with array indices, you could get away with the above.
But it wouldn’t cut it for JSON and YAML, which would require yet another tier
for every node.

What if we make some assumptions?

1. Assume: node sequence is not meaningful

Given that statement, we could safely produce this:

```js
{ a: { b: { $text: 'xyz' } } }
```

But we’re still not there ... we need to go further.

2. An element whose only children are text nodes can be represented *as* that
   text.

```js
{ a: { b: 'xyz' } }
```

There we go. Nice! OH WAIT, we just got a new document from the same source, but
it looks like *this*

```xml
<a><b>xyz</b><b xmlsucks="omg yes it does">abc</b></a>
```

Hahahahahaaaaa aaha ha hhhaaa xmmmllll

Okay, you get the idea. There is *no way* for this process to be simple. And
categorical assumptions only get us so far when it comes to complex documents
where, say, sequence usually doesn’t matter, except for in this one element... 

In the past, I dealt with this sort of translation from XML into usable data by
taking pieces bit by bit and constructing the real object. For larger docs with
complex requirements, the code that this leads to is not only painfully verbose,
it also inevitably turns into imperative spaghetti very quickly.

What hardcore offers is a more-or-less declarative system based on defining
rules for how nodes will be interpreted. Each rule has a `match`, which
determines whether it applies, and in addition may have other options that tweak
the output in small or large ways. It’s like a javascript DTD that is hopefully
not as horrible as that sounds now that I put it like that...

#### Main Options

The main options object passed to `toObject` can have these properties:

 - `rules`: An array of rules declaring how the XML will be processed.
 - `renamer`: A function, object hash, or map for renaming nodes.
 - `withNS`: Boolean (‘with namespaces’). Defaults to `false`. This will affect
   not only how names appear but also how rules that match on names behave.

##### Main Renamer

Individual rules can override the main renamer -- this is just the fallback when
nothing else was specifically applied.

If set to `undefined`, the original names will be used, but by default, names
get converted to (acronym-aware) camelcase. You can write a custom renaming
function or use one of the other built-in options from `hardcore.renamers`.

An alternative to supplying a function is to supply an object hash
(`{ oldName: newName }`) or map. 

Note that not all nodes have names to begin with. Nameless nodes instead get as
their original names generics like '$comment'. These are collision safe since $
cannot start a real XML name.

#### Default Rules

In the absence of any applicable custom rules, there are defaults which apply.
These favor the production of the most *minimal* rather than the most
*consistent* result. By default, order is not preserved (unless you count
property order, which I suppose you can as long as the data remains in V8) and
comments, as well as DTDs and ‘exotic’ nodes like ProcessingInstruction, are
ignored.

While this production makes sense for the bulk of any given ‘normal’ document,
there will almost always be nodes that need special handling, which is the
reason custom rules exist. The most common reason to write a rule is to define
certain Elements as being *plural*. Consider the following case:

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

The default rules favored the most minimal result by assuming that if there was
only one element of a given name, and that node contains only text, then it
should result in a property whose value is that text. But this sucks, because
now we have an inconsistent type for `cat`. First it’s a string and then it’s
an array. To use the data we’d need to fumble with type/instance checking and
guards: it’s just a reconfiguration of the same old XML problems.

So a good set of options in this case might look like this:

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

To write rules, you’ll need to understand how they get applied. Consider this
example document:

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
representation of each node is created; by default, these will always be objects
or strings, but you can control the ‘base’ value using `before`. In this phase,
the `ignore` and `collapse` options are also applied and the node’s new name, if
any, will be determined.

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

At each ‘leaf’ it begins walking backwards, linking the new node values to their
parents (possibly their *new* parents, if you used `collapse`), taking into
account `plural`, and finally applying `after` if present.

The sequence will be familiar if you’ve ever used a sax parser. In a sense,
hardcore’s `toObject` works a lot like a souped up, specialized sax parser. This
is the walk sequence for the above document:

 01. bf. elemR
 02. bf. elemA
 03. bf. attr
 04. af. attr
 05. bf. elemB
 06. bf. *abc*
 07. af. *abc*
 08. af. elemB
 09. bf. elemC
 10. bf. *def*
 11. af. *def*
 12. af. elemC
 13. af. elemA
 14. af. elemR

##### `match`

This is the only required property for a rule. There are four types of matches.
More specific matches must come before more generic matches, because only the
earliest matching rule will be applied.

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

##### `rename`

This can be a string or a function that returns a string. If it’s a function,
its arguments are the original name and the node. If present, `rename` overrides
the `opts.renamer` function if it was supplied.

##### `before` and `coerce`

The `before` function receives the original Node and whatever *would* be its
generic representation (baseVal). It returns a value which will represent this
node in the result object. It’s fine to just mutate the baseVal and return that.

```js
function before(node, baseVal) { /* ... */ }
```

The baseVal of a node is always an object (e.g. Element) or a string (e.g.
Text, Attribute). If you return a primitive, but the node has children, the
children will end up being ignored unless `collapse` was true (because otherwise
they no longer have anything to get attached to)

There is one special case, `undefined`. Returning `undefined` will cause the
node to be ignored. Indeed, this is what `ignore` is really shorthand for.

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

Depending on the node type, coerce behaves a bit differently. For nodes with a
string baseVal, like Attribute, the string value will simply be cast to the new
type. But if the baseVal is not a sting, the textual content of the node’s
immediate children is what will get cast.

```xml
<cat name="Spottis" age="12">
   <perfect>yes</perfect>
   <fur>white / black</fur>
</cat>
```

```js
const rules = [
   { match: [ Attribute, 'age' ], coerce: Number },
   { match: [ Element, 'adorableness' ], coerce: Boolean },
   { match: [ Element, 'fur' ], coerce: String }
   { match: [ Element, 'cat' ], collapse: true }
];

// ...

{ name: 'Spottis', age: 12, perfect: true, fur: 'white / black' }
```

The Boolean coercion recognizes common analogue values like ‘yes’ and ‘N’.

##### `after` and `afterPlural`

After children are processed (and attached to the baseVal as properties, if
applicable), the `after` function will be called. It receives the assembled
object or value and may return a new value. The return value will supplant the
former value. Unlike `before`, returning `undefined` will be taken literally in
this phase.

The `transform` function also receives the original node and the name:

`function after(val, node, name) {}`

This is the most powerful tool at your disposal, because this is the best time
to perform more aggressive manipulations of the result object’s structure.
Rather than being limited to ignoring or collapsing a node, you can completely
alter the object at any branch. Most users will not need this much. It invites
some of the imperative logic we’re trying to get away from, but sometimes when
dealing with complex documents, that can’t be avoided. At least this lets us
keep things well-organized.

An `afterPlural` function, if provided, is the same, but gets called with the
resulting array as its value. This special ‘after’ is included because the
`after` of a plural rule applies to the individual array members (which map
back to nodes) rather than the resulting collective array. Its primary use cases
would be to sort, filter, or reduce.

##### `plural`

If `plural` is true, the node will be treated as an array member. Depending on
what you’re aiming for, this may be the only option you really need. By default,
a node will only become an array member if it has siblings of the same name.
This can lead to problems when a node *may or may not* have such siblings,
since you want to have a consistent result regardless.

You can also set `plural` explicitly to `false`. If you do, it will never be an
array and if there are same-name siblings, the last one will overwrite any
previous.

##### `asArray`

With `asArray`, a node will be represented as an array of its children.
Therefore this option only makes sense when applied to nodes that have children
in the first place. Most users won’t need it, but when it is needed it’s
critical (e.g. HTML) because it allows child sequence to be explicitly
preserved. The tradeoff is significantly more verbose, difficult to use output.

##### `ignore`

An ignored node is eliminated from the result. Its children will also be
ignored -- unless `collapse` is true, in which case they will be inherited by
the ignored node’s parent.

##### `collapse`

If collapse is `true`, the node’s children will be treated as children of this
node’s parent. There are two common cases for this:

 - The node is ignored but its children should not be.
 - The node is to become a primitive value, and therefore cannot carry children.

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

The targetted child becomes the value of the parent, replacing it but assuming
its name. This is useful in cases where a document has an unnecessarily complex
hierarchy, which is a common problem in XML. Effectively it’s just a variation
on ignore-collapse where names work differently. Note however that to use this
functionality means that if the targetted child node had siblings, they would be
omitted from the result.

### `toJSON()` and `toYAML()`

The options for these include all of the options for `toObject` with these
differences and additions:

 - `asComment`: An extra filtered transform. Nodes matching will be included in
   the output as comments. Note that JSON technically does not allow comments,
   though many implementations permit them anyway. Default for YAML:
   `[ Comment ]`. Default for JSON: `undefined`.
 - `quote`: This is only applicable for `toYAML`. The value can be a single
   quote, a double quote, an empty string, or one of the YAML string block
   prefixes. If undefined, but `pretty` is true, then no-quotes will be favored,
   but when necessary, or when the string is long, '>-' will be used.
 - `tab`: This is only applicable for `toJSON`. As with `toXML`, it’s the indent
   string. Defaults to `'\t'`.

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
this context, like ‘ID’ and ‘URL’. Numbers with decimals are also handled:
'xyz\_1.2' => 'xyz1\_2'

#### `hardcore.renamers.lower`

Entirely to lowercase.

#### `hardcore.renamers.snake`

Snake case -- lowercase with underscores between words. Studies have shown that
users of snake case are 0.7% more likely to quote statistics about reading speed
and identifier naming.

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

There is also a `siblings` property, which returns an array of the node’s
siblings (that is, its immediate parent’s children, but not including itself).

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

**Argument Object**

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

**XML Example**

```xml
<hello>yes<what/></hello>
```

That’s a "hello" element with two children, a Text node and another Element.

**Argument Object**

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

**Argument Object**

 - `namespace`: Optional.
 - `key`: Required.
 - `value`: Defaults to ''.

Properties are the same.

#### `hardcore.nodes.Comment`

A comment can contain pretty much any text except the sequence '--'. It also
can’t end with '-'. If you set a value with these sequences they’ll be corrected
to '- -' and '- ' respectively.

**Argument Object**

 - `content`: The text of the comment. Defaults to ''.

The only property is `content`.

#### `hardcore.nodes.Text`

Text nodes require '<'' and ']]>' to be escaped. This will be done automatically
if needed.

**Argument Object**

 - `content`: The text itself.

The only property is `content`. Remember that for nodes that only take a single
argument, it’s okay to just supply the value instead of an object, so
`new Text('some text')` is understood.

#### `hardcore.nodes.ProcessingInstruction`

A processing instruction is a directive that targets a specific interepreting
agent, or something like that. They’re the ones that begin with '<?', except for
the xml declaration.

**Argument Object**

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

**Argument Object**

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

**Argument Object**

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

**Argument Object**

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

Properties are `keyword` and `children`. The children object is the same as the
one used by `DoctypeExternal`, and it may be empty.

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
   which of these are valid on the root element.
 - `type`: For non-root ChildElementGroups, the type may only be "CHOICE" or
   "SEQUENCE". For the root, see the description at ElementDeclaration.

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

**XML Example**

```xml
<!ATTLIST pizza topping (anchovies|olives|sadness) "anchovies">
```

In this example, pizza is the name of the element, and topping is the name of
its one attribute. This is followed by an enumeration of valid values and a
default value to use if the attribute is absent.

When `pretty` is used with `toXML()`, the definitions within will be aligned as
a table:

```xml
<!ATTLIST student_name
    student_no               ID                       #REQUIRED
    tutor_1                  IDREF                    #IMPLIED
    tutor_2                  IDREF                    #IMPLIED>
```

**Argument Object**

 - `namespace`: Optional.
 - `name`: Element name, required.

Instance properties are `defs` (an AttributeDefinitions object) plus those
above. AttributeDefinitions is like `children`; it has array methods. It is
allowed to be empty, and its members must be AttributeDefinitions.

#### `hardcore.nodes.AttributeDefinition`

A single AttributeDefinition is a member of the `defs` described above. The
example given for AttListDeclaration will suffice, too. 

This is another relatively complicated one.

**Argument Object**

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

**XML Example**

```xml
<!ENTITY greeting "hello">
```

Then you could use '&greeting;' anywhere that entity references are allowed.
It could be that simple, anyway, but this is XML.

**Argument Object**

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

**XML Example**

```xml
<!NOTATION xml-is-stupid PUBLIC "eh">
```

**Argument Object**

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
