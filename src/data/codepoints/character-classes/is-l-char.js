export default Object.assign(cp =>
  cp === 0x00004C ||
  cp === 0x00006C,
  { description: '"l" or "L"' }
);
