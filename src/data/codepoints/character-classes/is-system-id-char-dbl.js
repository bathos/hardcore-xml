import isXMLChar from './is-xml-char';

export default Object.assign(cp =>
  cp !== 0x000022 &&
  isXMLChar(cp),
  { description: 'valid double-quoted system ID' }
);
