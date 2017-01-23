// UTF8 is another variable length encoding and it’s the most complex of the
// ones we support, though it seems very elegant. Since I’m no good at math, I
// just adapted this from the very lucid implementation at
// http://www.json.org/JSON_checker/utf8_decode.c. I removed the sanity checks
// against yielding surrogate codepoints, however, since this is redundant in
// our context (the lexer will throw on these anyway during a more restrictive
// check against any illegal xml characters).

const continuation = byte => {
  if ((byte & 0xC0) === 0x80) {
    return byte & 0x3F;
  }

  throw new Error(
    `0x${ byte.toString(16) } is an invalid continuation byte in UTF8.`
  );
};

export default function * (chunk) {
  const buffer = this.reserved
    ? Buffer.concat([ this.reserved, chunk ])
    : chunk;

  this.reserved = undefined;

  const count = buffer.length;

  for (let i = 0; i < count; i++) {
    const a = buffer[i];

    if ((a & 0x80) === 0) {
      yield a;
      continue;
    }

    if (count === i + 1) {
      this.reserved = buffer.slice(i);
      return;
    }

    const b = continuation(buffer[++i]);

    if ((a & 0xE0) === 0xC0) {
      if (b >= 0) {
        const codepoint = ((a & 0x1F) << 6) | b;

        if (codepoint >= 128) {
          yield codepoint;
          continue;
        }
      }

      this.badValue(b);
    }

    if (count === i + 1) {
      this.reserved = buffer.slice(i);
      return;
    }

    const c = continuation(buffer[++i]);

    if ((a & 0xF0) === 0xE0) {
      if ((b | c) >= 0) {
        const codepoint = ((a & 0x0F) << 12) | (b << 6) | c;

        if (codepoint >= 2048) {
          yield codepoint;
          continue;
        }
      }

      this.badValue(c);
    }

    if (count === i + 1) {
      this.reserved = buffer.slice(i);
      return;
    }

    const d = continuation(buffer[++i]);

    if ((a & 0xF8) === 0xF0) {
      if ((b | c | d) >= 0) {
        const codepoint = ((a & 0x07) << 18) | (b << 12) | (c << 6) | d;

        if (codepoint >= 65536) {
          yield codepoint;
          continue;
        }
      }

      this.badValue(d);
    }

    this.badValue(a);
  }
}
