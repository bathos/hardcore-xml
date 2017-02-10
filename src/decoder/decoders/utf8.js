// UTF8 is another variable length encoding and it’s the most complex of the
// ones we support, though it seems very elegant. Since I’m no good at math, I
// just adapted this from the very lucid implementation at
// http://www.json.org/JSON_checker/utf8_decode.c.
//
// I did not include the guards against yielding surrogate codepoints, since
// that is redundant for us: the lexer must perform a more restrictive check
// anyway which will preclude these. I also did not replicate the >= 0 checks,
// but this was only because I was unable to find any byte values that _could_
// fail those checks ... my only guess was that they guard against non-byte
// input (which we won’t have), but possibly I’m just missing some part of the
// picture.

const continuation = byte => {
  if ((byte & 0xC0) === 0x80) {
    return byte & 0x3F;
  }

  throw new Error(
    `0x${ byte.toString(16) } is an invalid continuation byte in UTF8.`
  );
};

export default function * utf8(chunk) {
  const buffer = this.reserved
    ? Buffer.concat([ this.reserved, chunk ])
    : chunk;

  this.reserved = undefined;

  const count = buffer.length;

  for (let i = 0; i < count; i++) {
    // Special case: utf8 is the one decoder which may be switched over to a
    // different decoder after it starts. We need to account for that at this
    // level.

    if (this._decode !== utf8) {
      yield * this._decode(buffer.slice(i));
      return;
    }

    // Okay, regular stuff starts.

    const a = buffer[i];

    if (a < 0x80) {
      yield a;
      continue;
    }

    if ((a & 0xE0) === 0xC0) {
      if (count <= i + 1) {
        this.reserved = buffer.slice(i);
        return;
      }

      const b = continuation(buffer[++i]);

      const codepoint = ((a & 0x1F) << 6) | b;

      if (codepoint >= 128) {
        yield codepoint;
        continue;
      }

      this.badValue((a << 8) + buffer[i]);
    }

    if ((a & 0xF0) === 0xE0) {
      if (count <= i + 2) {
        this.reserved = buffer.slice(i);
        return;
      }

      const b = continuation(buffer[++i]);
      const c = continuation(buffer[++i]);

      const codepoint = ((a & 0x0F) << 12) | (b << 6) | c;

      if (codepoint >= 2048) {
        yield codepoint;
        continue;
      }

      this.badValue((a << 16) + (buffer[i-1] << 8) + buffer[i]);
    }

    if ((a & 0xF8) === 0xF0) {
      if (count <= i + 3) {
        this.reserved = buffer.slice(i);
        return;
      }

      const b = continuation(buffer[++i]);
      const c = continuation(buffer[++i]);
      const d = continuation(buffer[++i]);

      const codepoint = ((a & 0x07) << 18) | (b << 12) | (c << 6) | d;

      if (codepoint >= 65536) {
        yield codepoint;
        continue;
      }

      this.badValue([ a, buffer[i-2], buffer[i-1], buffer[i] ]
        .map(n => n.toString(16)).join('')
      );
    }

    this.badValue(a);
  }
}
