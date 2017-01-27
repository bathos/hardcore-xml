import isXMLChar from './is-xml-char';

export default Object.assign(cp =>
  cp !== 0x00003F &&
  isXMLChar(cp),
  { description: 'processing instruction value' }
);
