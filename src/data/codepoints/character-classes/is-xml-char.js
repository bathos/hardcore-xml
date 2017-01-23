export default cp =>
  cp === 0x00009 ||
  cp === 0x0000A ||
  cp === 0x0000D ||
  (cp >= 0x00020 && cp <= 0x00D7FF) ||
  (cp >= 0x0E000 && cp <= 0x00FFFD) ||
  (cp >= 0x10000 && cp <= 0x10FFFF);
