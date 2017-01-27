export default Object.assign(cp =>
  cp === 0x000058 ||
  cp === 0x000078,
  { description: '"x" or "X"' }
);
