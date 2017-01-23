import isCDATAChar from './is-cdata-char';

export default cp =>
  cp !== 0x000027 &&
  isCDATAChar(cp);
