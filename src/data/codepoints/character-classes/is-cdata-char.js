import isXMLChar from './is-xml-char';

export default cp =>
  cp !== 0x000026 &&
  cp !== 0x00003C &&
  isXMLChar(cp);
