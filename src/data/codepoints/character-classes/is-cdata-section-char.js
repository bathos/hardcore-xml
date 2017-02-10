import isXMLChar from './is-xml-char';

export default Object.assign(cp =>
  cp !== 0x00005D &&
  isXMLChar(cp),
  { description: 'valid CDATA section content' }
);
