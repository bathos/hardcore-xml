import isPublicIDCharDbl from './is-xml-char';

export default cp =>
  cp !== 0x000027 &&
  isPublicIDCharDbl(cp);
