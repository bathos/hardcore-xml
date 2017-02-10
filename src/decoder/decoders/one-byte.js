// These are the simplest cases: 1 byte is 1 codepoint. We just need to map them
// using conversion tables (and mind the gaps).

export default function * (buffer) {
  for (const byte of buffer) {
    const cp = this.codepage[byte];

    if (cp === undefined) {
      this.badValue(byte);
    }

    yield cp;
  }
}
