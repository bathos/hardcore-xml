import isXMLChar from './is-xml-char';

export default Object.assign(cp =>
  cp !== 0x000022 &&
  cp !== 0x000025 &&
  cp !== 0x000026 &&
  isXMLChar(cp),
  { description: 'valid double-quoted entity value' }
);
