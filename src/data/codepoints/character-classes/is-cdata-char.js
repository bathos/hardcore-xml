import isXMLChar from './is-xml-char';

export default Object.assign(cp =>
  cp !== 0x000026 &&
  cp !== 0x00003C &&
  isXMLChar(cp),
  { description: 'valid CDATA' }
);
