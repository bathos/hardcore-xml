// Shift JIS is a straightforward variable byte encoding where there are two
// ranges of bytes representing characters directly and two ranges which act as
// surrogates. In the latter case, one reads the pair as a single 16 bit number.
// In both cases we can just consult a mapping table.

export default function * (chunk) {
  const buffer = this.reserved
    ? Buffer.concat([ this.reserved, chunk ])
    : chunk;

  this.reserved = undefined;

  for (let i = 0; i < buffer.length; i++) {
    const byteA = buffer[i];

    // Regular ASCII characters 0x00-0x7E, as well as a set of kana characters,
    // 0xA1-0xDF:

    if (this.codepage[byteA]) {
      yield this.codepage[byteA];
      continue;
    }

    // The remainder of bytes initialize two-byte references (or are invalid).
    // If this was the last byte in the buffer, we place it in reserve and exit.

    if (i === buffer.length - 1) {
      this.reserved = buffer.slice(-1);
      return;
    }

    // We concatenate the two bytes to read them as a single 16-bit number.

    const byteB      = buffer[++i];
    const doubleByte = (byteA << 8) + byteB;
    const codepoint  = this.codepage[doubleByte];

    if (codepoint) {
      yield codepoint;
    } else {
      this.badValue(doubleByte);
    }
  }
}
