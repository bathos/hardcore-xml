// UTF16 is a variable length encoding that uses dedicated surrogate codepoints
// to describe codepoints above the BMP. It’s also the native encoding in JS,
// which is closely related to why String.prototype.length is broken (someone in
// the shrouded past took a nasty shortcut we still live with today: bytes / 2).
// The formula for translating surrogate pairs into codepoints is a bit more
// mathy than in ShiftJIS, but it’s still fairly simple.

const HIGH_SURROGATE_START = 0x0D800;
const HIGH_SURROGATE_END   = 0x0DBFF;
const LOW_SURROGATE_START  = 0x0DC00;
const LOW_SURROGATE_END    = 0x0DFFF;
const SMP_START            = 0x10000;

export default function * (chunk) {
  const buffer = this.reserved
    ? Buffer.concat([ this.reserved, chunk ])
    : chunk;

  this.reserved = undefined;

  // While an odd number of bytes will always indicate a remainder, we’ll put
  // off worrying about that since we might also have a remainder if we’re
  // dealing with surrogates anyway.

  const methodKey = `readUInt32${ this.endianness }`;
  const count     = Math.floor(buffer.length / 2);

  let offset = 0;

  for (; offset < count; offset++) {
    const doubleA = buffer[methodKey](offset * 2);

    if (doubleA < HIGH_SURROGATE_START || doubleA > LOW_SURROGATE_END) {
      yield doubleA;
    } else {
      // This function serves also to handle UCS2, which is simply UTF16 without
      // support for any codepoints over 0xFFFF. In that case, reaching here
      // represents an error.

      if (this.noSurrogates) {
        this.badValue(doubleA);
      }

      this.surrogatesSeen = true;

      // The first surrogate must be specifically a high surrogate.

      if (doubleA > HIGH_SURROGATE_END) {
        this.badValue(doubleA);
      }

      // If there are not at least two additional bytes yet to be read, we must
      // place these values in reserve and exit early.

      if (buffer.length - offset < 4) {
        this.reserved = this.buffer.slice(offset);
        return;
      }

      // The second surrogate must be specifically a low surrogate.

      const doubleB = buffer[methodKey](++offset * 2);

      if (doubleB < LOW_SURROGATE_START || doubleB > LOW_SURROGATE_END) {
        this.badValue(doubleB);
      }

      // Finally we stitch them together. Note that the bitshift is 10 places,
      // not 8. The surrogates may represent numbers above 1FFFF.

      const high = (doubleA - HIGH_SURROGATE_START) << 10;
      const low = doubleB - LOW_SURROGATE_START;

      yield SMP_START + high + low;
    }
  }

  if ((offset * 2) < buffer.length) {
    this.reserved = buffer.slice(offset * 2);
  }
}
