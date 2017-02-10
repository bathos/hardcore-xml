import isCDATAChar from './is-cdata-char';

export default Object.assign(cp =>
  cp !== 0x000027 &&
  isCDATAChar(cp),
  { description: 'valid single-quoted attribute' }
);
