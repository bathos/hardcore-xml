import isCDATAChar from './is-cdata-char';

export default Object.assign(cp =>
  cp !== 0x000022 &&
  isCDATAChar(cp),
  { description: 'valid double-quoted attribute' }
);
