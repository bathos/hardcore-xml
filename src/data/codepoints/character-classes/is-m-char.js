export default Object.assign(cp =>
  cp === 0x00004D ||
  cp === 0x00006D,
  { description: '"m" or "M"' }
);
