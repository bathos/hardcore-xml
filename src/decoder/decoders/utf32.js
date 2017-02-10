// UTF32 is effectively 1:1 with the results we’re interested in (actual
// codepoints), but it’s still more complex than the one-byte mappings since we
// may receive a buffer whose length is not divisible by 4, in which case some
// portion is placed back in reserve.

export default function * (chunk) {
  let buffer = this.reserved
    ? Buffer.concat([ this.reserved, chunk ])
    : chunk;

  const extraByteCount = buffer.length % 4;

  if (extraByteCount) {
    this.reserved = buffer.slice(-extraByteCount);
    buffer = buffer.slice(0, -extraByteCount);
  } else {
    this.reserved = undefined;
  }

  // To support exotic byte orders, as mentioned in the XML spec, we may need to
  // flip the 16-bit pairs before continuing.

  if (this.flipped) {
    buffer.swap16();
  }

  const methodKey = `readUInt32${ this.endianness }`;
  const count     = buffer.length / 4;

  for (let offset = 0; offset < count; offset++) {
    yield buffer[methodKey](offset * 4);
  }
}
