export default Object.assign(cp =>
  (cp >= 0x000030 && cp <= 0x000039) ||
  (cp >= 0x000041 && cp <= 0x000046) ||
  (cp >= 0x000061 && cp <= 0x000066),
  { description: 'valid hex number' }
);
