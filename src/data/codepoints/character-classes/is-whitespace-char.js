export default Object.assign(cp =>
  cp === 0x000009 ||
  cp === 0x00000A ||
  cp === 0x00000D ||
  cp === 0x000020,
  { description: 'whitespace' }
);
