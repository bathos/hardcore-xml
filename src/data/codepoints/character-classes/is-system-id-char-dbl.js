import isXMLChar from './is-xml-char';

export default cp =>
  cp !== 0x000022 &&
  isXMLChar(cp);
