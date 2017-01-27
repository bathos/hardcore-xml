export default Object.assign(cp =>
  cp === 0x00002D ||
  cp === 0x00002E ||
  (cp >= 0x000030 && cp <= 0x000039) ||
  (cp >= 0x000041 && cp <= 0x00005A) ||
  cp === 0x00005F ||
  (cp >= 0x000061 && cp <= 0x00007A),
  { description: 'valid encoding name continuation' }
);
