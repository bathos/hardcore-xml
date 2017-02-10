import isXMLChar from './is-xml-char';

export default Object.assign(cp =>
  cp !== 0x00002D &&
  isXMLChar(cp),
  { description: 'comment' }
);
