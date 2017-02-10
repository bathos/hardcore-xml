export default Object.assign(cp =>
  (cp >= 0x000041 && cp <= 0x00005A) ||
  (cp >= 0x000061 && cp <= 0x00007A),
  { description: 'valid encoding name start' }
);
