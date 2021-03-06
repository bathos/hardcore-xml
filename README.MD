[![Build Status](https://travis-ci.org/bathos/hardcore-xml.svg)](https://travis-ci.org/bathos/hardcore-xml)
[![Coverage Status](https://coveralls.io/repos/github/bathos/hardcore-xml/badge.svg?branch=master)](https://coveralls.io/github/bathos/hardcore-xml?branch=master)
[![npm version](https://badge.fury.io/js/hardcore.svg)](https://badge.fury.io/js/hardcore)

# hardcore xml

A validating xml parser / processor / builder thing.


<!-- MarkdownTOC autolink=true bracket=round depth=4 -->

- [wat](#wat)
  - [why](#why)
  - [how hardcore](#how-hardcore)
  - [stuff to know](#stuff-to-know)
- [i want to use this](#i-want-to-use-this)
  - [i have a string make it be xml](#i-have-a-string-make-it-be-xml)
  - [i have a stream that all menafiefiewfheiniupu9](#i-have-a-stream-that-all-menafiefiewfheiniupu9)
- [options](#options)
  - [`opts.dereference`](#optsdereference)
  - [`opts.encoding`](#optsencoding)
  - [`opts.maxExpansionCount` / `opts.maxExpansionSize`](#optsmaxexpansioncount--optsmaxexpansionsize)
  - [`opts.path`](#optspath)
- [ast nodes](#ast-nodes)

<!-- /MarkdownTOC -->

## wat

In the XML spec, two kinds of processors are defined: validating and
non-validating. A validating processor can handle external references and is
guaranteed to apply all effects of markup declarations found in the internal DTD
or introduced via external entities — some of which may influence the actual
output in additon to defining validity constraints.

### why

I don’t have a particularly good answer.

AFAIK, there is no existing validating XML processor available for node. In
fact there maybe isn’t any XML processor available for node which fits the
formal definition of even a non-validating parser. Most are forgiving of illegal
sequences even in "strict mode".

But why do you want it be strict? And who actually _uses_ DTDs?

1. You don’t
2. Nobody

I’ve spent a lot of time working with XML, and I enjoy projects like this ...
but yeah, you probably don’t need these features.

That said, I think it’s a pretty good XML library! Even if you don’t need DTDs
and aren’t worried about the sanctimony of formal XML spec compliance, the AST
it generates has an API for manipulation, querying, reserializing, and
transformation that may prove useful to you.

### how hardcore

I’ve tried to follow the XML 1.0 specification closely. There’s a whole lot more
in there than I think most people realize. It’s a monster if you’re going
whole-hog. Realistically, it’s unlikely that I got every last detail correct. In
theory it can do the following though:

- Decoding
 - Handles a wide range of encodings out of the box
 - Honors the encoding sniffing algorithm outlined in the spec
 - Honors the encoding specified by an xml/text declaration
 - Permits user-override of encoding with out-of-band info
 - Normalizes newlines according to spec rules
- Parsing
 - Applies well-formedness constraints
 - Outputs error messages with informative messages and context
 - Applies validity constraints at the earliest possible time
 - Normalizes attribute whitespace according to spec rules
 - Normalizes tokenized attribute whitespace according to spec rules
 - Provides default attribute values when defined by a markup declaration
 - Recognizes the difference between whitespace CDATA and non-semantic
   whitespace in elements with declared content specifications
 - Resolves external parsed entities, including external DTD subsets
-- Expands entities, including both parameter and general entities
 - Places upper limits on entity expansion to avoid Billion Laughs attacks
- AST
 - Provides simplified DOM tree
 - Nodes inherit from Array. Proxy lets us maintain knowledge of lineage.
 - Nodes are entirely mutable
 - Everything is ‘live’ — for example, alterations to an element declaration
   node will effect subsequent behavior of instances of that element.
 - `node.validate()` may be called at any time to confirm validity again.
 - `node.serialize()` lets you output XML as a string again.
 - `node.findDeep()`, `node.filterDeep()` allow querying in plain JS.
 - `node.prevSibling`, `node.parent`, etc help you navigate the tree.
 - `node.toJSON()` returns a POJO representation of the tree.
 - You can also create new documents using the AST node constructors even
   without processing a document.

### stuff to know

There is a caveat about reserialization to XML. XML is, in a sense, a lossy
format. Once entities have been expanded, especially in a context where
subsequent manipulation of the AST is permitted, it’s tough to say how one would
turn them back into references safely. When you made some edit, did it unlink
the reference, or did it alter the definition of the entity replacement text
itself? Likewise we do not retain knowledge of which attribute values were
supplied as defaults and which were not, and we do not retain knowledge of the
pre-normalized linebreaks or pre-normalized attribute value text.

One thing which is not supported is _not_ validating. Well, more specifically,
it does not support ignoring a doctype declaration and its consequences. You
actually can do non-validation simply by not having a doctype declaration in a
document; in such a case, undeclared elements and attributes are inherently
valid, all being content type "ANY" and attribute type "CDATA" implicitly.

Note that the existence of a doctype declaration immediately makes any element
or attribute which was not declared an error. Thus a document with the a DTD
like `<!DOCTYPE foo>` (which is technically grammatically valid) nonetheless
will fail validation by definition, as the element `foo` is not declared.

In the future I might introduce granular customization of validation behavior
such that users may enable or disable the application of select constraints. I’m
not sure yet if this corresponds to important use cases so I have not attempted
it yet.

Even if that does get introduced, it should be noted that hardcore cannot be
used to parse HTML. XHTML would be fine, but HTML is not a form of XML. HTML has
different parsing rules and a different set of possible AST nodes from XML.
Despite appearances, it’s not just a matter of degrees of ‘strictness’. The
existence of super XML-looking things like `<!DOCTYPE` in html is just a vestige
of the language’s heritage and these constructs do not mean the same things,
follow the same grammar, or have the same effects.

However, MathML and SVG, both of which can appear within HTML documents, do
follow the XML grammar (and they have DTDs as well). Both are suitable for
processing with hardcore.

## i want to use this

okay, first I should mention it is node 7+ only (maybe 6?) cause I am an
asshole.

the module exposes several objects.

- `hardcore.ast`: namespace object with AST node constructors
- `hardcore.parse`: convenience method wrapping `Processor`
- `hardcore.Processor`: main meats
- `hardcore.Decoder`: base class underlying `Processor`

### i have a string make it be xml

```
import hardcore from 'hardcore';

hardcore
  .parse(myString, opts)
  .then(ast => ...)
  .catch(err => ...);
```

In this form, the first argument may be a string, a `Buffer`, or a `Readable`
stream. We’ll come back to what the options are.

### i have a stream that all menafiefiewfheiniupu9

If your input is a stream, you might prefer to use `Processor` directly since it
always feels really good when you get to type `pipe`:

```
import fs from 'fs';
import hardcore from 'hardcore';

const processor = new Processor(opts);

processor.on('ast', ast => ...);
processor.on('error', err => ...);

fs.createReadStream('poop.svg').pipe(xmlProcessor);
```

The incoming stream chunks must be buffers, not strings.

`Processor` is a `Writable` stream. It’s also _actually_ a writable stream, by
which I mean it processes incoming data as it becomes available. I mention this
because I’ve seen other parsers that implement the stream interface but actually
just accrete the sum of all data before beginning the parsing itself.

I haven’t benchmarked hardcore or anything and don’t actually care to, but it’s
admittedly probably considerably heavier than alternatives — I favor code I can
still read later over optimization, or at least that’s what I tell myself. That
said, you could say that the ability to process chunks asynchronously makes
other optimizations unnecessary: you can always just adjust the incoming flow if
you have to worry about eight megabyte xml documents or something.

## options

These are the options for both `new Processor(opts)` and `parse(thing, opts)`.

### `opts.dereference`

This is optional only if the document is known to contain no references to
external entities. Otherwise, it is necessary that you provide it.

The value should be a function like this:

```
opts.dereference = ({ name, path, pathEncoded, publicID, systemID, type }) => {
  /* ... */
  return {
    encoding: optionalEncodingString,
    entity: stringOrbufferOrStreamOrPromiseThatResolvesToStringOrBufferOrStream
  };
};
```

The `type` will either be `'DTD'` or `'ENTITY'` (technically both are entities
in XML parlance, but here we mean the kind declared with `<!ENTITY...`).

Depending on the specific declaration that defined the external reference,
`publicID` may not be defined. The other members should always be defined.

> Notation declarations are the one kind of external reference that may lack a
> system ID, but notations are not entities and do not get dereferenced during
> processing.

Despite the amount of data provided, most likely you will only be interested in
either `path` or `pathEncoded` (which is just a url-encoded version of the
former). Before I explain why, first some background:

In practice (and quite confusingly), `systemID` is usually a public http URL
while `publicID` is one of those weird theoretical "-//" strings that appears in
standards specifications a lot but nobody ever actually uses. So `systemID` is
the one you want.

But the system ID (i.e., the url) might be relative to the referencing context
(which might itself be an external entity), so you need to know that context.
That’s why `path` is provided — it is the resolved path of the ‘requesting
context’ plus the systemID, and normally that means it will end up being an
absolute URL.

You may wonder: why not just have hardcore fetch these resources automatically?

There are a few reasons. First is security, I guess. I mean it’s just kind of
weird to have a parser making random HTTP requests behind the scenes, it’s not
something you do.

But also, in practice, you usually know in advance what external resources you
need. Rather than fetch them over the wire (again, it would be weird to have a
parser error caused by network traffic conditions), you likely will have made
them locally available as part of your application. Or even if you do decide to
fetch them online, you might want to keep a whitelist of permitted hosts or
cache the responses. So the particular implementation is in your hands.

I would expect that in the majority of cases you would just do something like

```
opts.dereference = ({ path }) => {
  const filePath = myMapOfEntities[path];
  return { entity: fs.createReadStream(filePath) };
};
```

Note that a general or parameter entity is not dereferenced until the first time
it is actually referenced, and it will only be requested for the first item.

It is permitted to specify encoding here since it can technically vary by file
and might come from out-of-band info like HTTP headers. By default, if an
explicit encoding was declared for the document, that will propagate to entity
expansions.

### `opts.encoding`

You don’t normally need to provide this, but you can supply the input encoding
as out-of-band information, for example when it comes to you via an HTTP header.
Note that, if there is an xml or text declaration that declares the encoding in
the file itself, it cannot contradict this.

When this is not provided and there is no inline encoding declaration, hardcore
will still be able to recognize UTF8, UTF16, or UTF32; and if the opening
character is "<", also UTF16le/be and UTF32le/be.

Supported encodings include those above, plus common one-byte encodings and
SHIFT-JIS. If you need something else, you’ll have to decode it to one of these
with iconvlite or similar before piping it in.

### `opts.maxExpansionCount` / `opts.maxExpansionSize`

These default to 10000 and 20000 respectively. These options exist to prevent
entity expansion attacks. If you want to disable them, you can set them to
`Infinity`. The first refers to the total number of entity expansions which may
occur during the processing of a single entity; the latter refers to the total
number of codepoints (not bytes) that may be the replacement text of a single
entity which is referenced.

### `opts.path`

This optional parameter lets you specify the base URI for a document such that
external entities with relative URLs as their system IDs can be understood.

I think it is atypical to need to provide this, since more often relative urls
are used only for entities which are components of an external DTD. References
to the external DTDs from documents, in contrast, are typically made using
absolute paths, making the document’s location irrelevant.

## ast nodes

See [AST Nodes](ast.md) for details on the individual node types.
