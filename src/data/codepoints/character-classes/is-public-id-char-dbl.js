export default Object.assign(cp =>
  cp === 0x00000A ||
  cp === 0x00000D ||
  cp === 0x000020 ||
  cp === 0x000021 ||
  (cp >= 0x000023 && cp <= 0x000025) ||
  (cp >= 0x000027 && cp <= 0x00002F) ||
  (cp >= 0x000030 && cp <= 0x000039) ||
  cp === 0x00003A ||
  cp === 0x00003B ||
  cp === 0x00003D ||
  (cp >= 0x00003F && cp <= 0x00005A) ||
  cp === 0x00005F ||
  (cp >= 0x000061 && cp <= 0x00007A),
  { description: 'valid double-quoted public ID' }
);
