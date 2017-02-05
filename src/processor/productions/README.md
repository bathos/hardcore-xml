# Production drivers

The production drivers follow a common pattern overall but vary somewhat from
case to case according to practical concerns.

All drivers may yield:

- number: this represents a codepoint that should be _recycled_; that is, the
  last codepoint received was a "greed artifact" and should be re-yielded to the
  next consumer.
- string: this represents a failed expectation message. the processor will emit
  an error.
- object: this represents an instruction signal for the processor, altering its
  behavior

The small, frequently reused drivers in "drivers.js" follow the same rules
except that some also have return values (which vary according to case).

## Terminal productions

Terminal productions are entrypoints. Their first yield is the root AST node,
and they expect to see a final EOF token. Terminal productions may return rather
than yield expectation strings, since this distinction makes no difference at
the entrypoint.

- `DOCUMENT`: The only entrypoint, as far as the main API goes.
- `EXT_SUBSET`: External DTD subset.
- `EXT_ENTITY`: External parsed or general entity.

The latter two are employed when dereferencing external entities during the
parsing of a document.

## Other grammar productions

Other productions most often take arguments that provide an operation context
and have no return value. This is usually the parent AST node. There may be
additional optional arguments, and these typically indicate a different starting
point (the consequence of context-specific disambiguation activity).

### COMMENT

- Begins after "<!"
- First argument: parent node

### ELEMENT

- Begins after "<n" or "<name"
- First argument: parent node
- Second argument: first codepoint of name (if no third arg)
- Third argument: element name (if not second arg)

The third argument is used by the DOCUMENT production, which may need to confirm
that the root element name matches the doctype.

### PROC_INST

- Begins after "<?" or "<?target"
- First argument: parent node
- Second argument: target name (optional)

The second argument is sometimes used by the three terminal productions, which
may need to distinguish between a processing instruction and an xml or text
declaration in the initial position.
