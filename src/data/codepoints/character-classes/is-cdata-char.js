import isXMLChar from './is-xml-char';

export default Object.assign(cp =>
  cp !== 0x000026 &&
  cp !== 0x00003C &&
  cp !== 0x00005D &&
  isXMLChar(cp),
  { description: 'valid CDATA' }
);
