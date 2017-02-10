import isPublicIDCharDbl from './is-xml-char';

export default Object.assign(cp =>
  cp !== 0x000027 &&
  isPublicIDCharDbl(cp),
  { description: 'valid single-quoted public ID' }
);
