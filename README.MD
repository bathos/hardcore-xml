# hardcore xml

A validating xml parser.

## wat

### why

I don’t have a particularly good answer. AFAIK, there is no existing validating
XML parser available for node. I’ve spent a lot of time working with XML, and I
enjoy projects like this ... but yeah, people don’t really use DTDs anymore. You
probably don’t need this.

### how hardcore

I’ve tried to follow the XML 1.0 specification closely. There’s a whole lot more
in there than I think most people realize. It’s a monster — far more complex
than parsing most programming languages, actually, if you’re going whole-hog.
Realistically, there’s no way that I got everything right. That said, in theory
it can do the following:

- parse xml, including dtds
- ...also including external dtd subsets, external entities, etc
- apply default attribute values according to the DTD
- normalize attribute values according to the DTD
- validate element content and attributes according to the DTD
- expand general entities and parameter entities
- hook up unparsed entities & notation types to the resulting AST
- sniff encodings according to the spec-prescribed algorithm
- normalize newline sequences according to the xml spec
- poop out an AST that retains knowledge of the DTD, so you can make edits and
  still call `.validate()` at any time

The AST nodes also provide methods for selecting, manipulating, transforming,
and reserializing content. However! When reserializing a document that had an
internal DTD, the internal DTD will not be retained, and entities will not be
"unexpanded", etc. The AST root is Document, but the sum value of the DTD is
reflected as the behavior of that Document, not as AST nodes in their own right.

> Regarding that last bit, I think you could argue XML is a lossy format. It
> could probably be done but (a) maintaining a mapping between source references
> and their expansions would take this to a whole other level of complexity and
> (b) the correct behavior might be considered ambiguous. For example, if we
> edit a value which was included via reference expansion, have we severed the
> reference mapping in that location, or have we altered the replacement text
> for the referenced entity?

### how awful is xml

oh my god it’s so awful yeah

## i want to use this

okay, first I should mention it is node 7+ only (maybe 6?) cause I am an
asshole.

there’s a bunch of stuff exposed but you probably want `XMLParser`. It’s a
writable stream. The main event is 'complete', which serves up an AST.

```
import fs from 'fs';
import { XMLProcessor } from 'hardcore';

const xmlProcessor = new XMLProcessor(opts);

xmlProcessor.on('error', whatever);
xmlProcessor.on('complete', ast => ...);

fs.createReadStream('poop.svg').pipe(xmlProcessor);
```

The constructor expects a config object — we’ll get to that in a bit.

Alternative API:

```
import fs from 'fs';
import { parseXML } from 'hardcore';

parseXML(stringOrBufferOrStream, opts)
  .then(ast => ...)
  .catch(err => ...);
```

even if you prefer the promise API, I recommend passing in a stream if it makes
sense, since it can process the input asynchronously for real (I think some
other xml parsers for node with apparently streaming interfaces actually just
wait for the data to finish loading before parsing begins, which is like ... why
are you a stream???).

## parsing options

### opts.dereference

Since the main reason you would choose to use this over another lib is that you
want to handle DTDs, and most often DTDs are external, this is the most
important thing to configure.

hardcore does not fetch http resources for you. that’s kind of out-of-band and
it has security implications. When we encounter an external reference, we’ll
call your `dereference` function, which should have this signature:

```
resolveExternal(type, { publicID, systemID, systemIDEncoded });
````

- `type` can be 'ENTITY' or 'DTD'.
- either one or both of `publicID` and `systemID` will be a string.
- for 'DTD', `systemID`/`systemIDEncoded` is always defined
- for 'DTD', `name` will also be defined

The function should return a (node) buffer or (ideally) a stream representing
the requested external resource, or a promise which resolves to one of those
two.

Somewhat confusingly, the "system" ID typically represents something generically
public (as a regular URL) while the "public" ID seems to be a string which would
require domain-specific knowledge to link to anything.

In practice, since system ID is almost always an http url, you could just fetch
it over the wire. But I wouldn’t recommend doing this blindly. It’s likely that
you either:

- already have some idea of what external resources you need
- know exactly what external resources you need

In the former case, you could maybe whitelist specific DTD-hosting domains that
seem like a safe bet, such as w3.org. You’d probably want to cache the results,
too. In the latter case, you could simply include the DTDs in your own
application and pull them off the local file system, which is the safest and
most reliable option.

The `systemIDEncoded` is just a URL-encoded version of the original system ID
string. Which one is preferable may vary depending on your resolution scheme.

Omitting this option is possible depending on the document content. If no
resolution mechanism is provided, hardcore will just skip over trying to load
these resources. Since external resources may affect how a document is parsed,
parsing may yield a different result than if the external resources had been
provided, and, in certain cases, parsing will be impossible (e.g. if the
document includes a reference to an entity which was only defined externally).

### opts.maxExpansionCount & opts.maxExpansionSize

A cool thing you can do with entity expansion is write a tiny XML file that
[consumes gigabytes of memory](https://en.wikipedia.org/wiki/Billion_laughs)
when parsed.

In order to prevent these attacks, there are default limits set on the number
of expansions, in total, that may occur (`maxExpansionCount`) and the number of
codepoints (not bytes) which a single top-level expansion may yield in total
(`maxExpansionSize`).

These default to 10,000 and 20,000 respectively. Setting them to `Infinity`
effectively disables this feature.

## what else

### Decoder

import { Decoder } from 'hardcore';

This is a writable stream expecting buffer input. It does encoding sniffing in
accord with what’s described in the XML spec and is set up to respond to inline
encoding declarations. It supports utf8, utf16 le/be, utf32, etc, plus all the
oldschool iso-8859 and cp125* encodings, ascii and Shift_JIS.

I would use iconv-lite instead (who knows how much I borked this, decoding is
fun but hard) except it didn’t seem like there were any non-messy ways for me to
graft the specific behaviors prescribed by the XML spec onto an iconv stream.
Aside from the sniffing algorithm (which is not generic — it involves,
potentially, seeking "<" or "<?" in various encodings), it was critical for us
to be able to synchronously change decoding methods (within certain boundaries)
upon discovery of the encoding declaration — meaning, potentially, while a
single buffer chunk is midway through processing — and alternatives out there
just did not provide any hooks for us to do something like this.
