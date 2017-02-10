import isXMLChar from './is-xml-char';

export default Object.assign(cp =>
  cp !== 0x000027 &&
  isXMLChar(cp),
  { description: 'valid single-quoted system ID' }
);
