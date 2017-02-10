export default Object.assign(cp =>
  cp >= 0x000030 && cp <= 0x000039,
  { description: 'decimal number' }
);
