import {
  isNameContinueChar,
  isNameStartChar,
  isPublicIDCharDbl,
  isXMLChar
} from '../data/codepoints';

const toCodepoints = str =>
  Array
    .from(str)
    .map(char => char.codePointAt(0));

export const escapeCDATA = str =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\]\]>/g, ']]&gt;');

export const isBoolean = bool =>
  typeof bool === 'boolean';

export const isCodepoints = arr =>
  arr instanceof Array &&
  arr.every(isXMLChar);

export const isName = str => {
  const [ head, ...rest ] = toCodepoints(str);
  return isNameStartChar(head) && rest.every(isNameContinueChar);
};

export const isNmtoken = str =>
  toCodepoints(str)
    .every(isNameContinueChar);

export const isPublicID = str =>
  toCodepoints(str)
    .every(isPublicIDCharDbl);

export const isSetOf = (set, pred) =>
  set instanceof Set &&
  Array.from(set).every(member => isString(member) && pred(member));

export const isString = str =>
  typeof str === 'string';

export const isXMLString = str =>
  toCodepoints(str)
    .every(isXMLChar);

export const noDoubleHyphen = str =>
  !str.includes('--');

export const noQMGT = str =>
  !str.includes('?>');

export const noSectionTerminus = str =>
  !str.includes(']]>');

export const notXML = str =>
  !/^xml$/i.test(str);

export const oneQuoteOnly = str =>
  !str.includes('\'') ||
  !str.includes('"');

export const serializeExternalID = ({ publicID, systemID }) => {
  const keyword       = publicID ? 'PUBLIC' : 'SYSTEM';
  const systemLiteral = systemID && serializeSystemLiteral(systemID);
  const publicLiteral = publicID && `"${ publicID }"`;

  return [ keyword, publicLiteral, systemLiteral ].filter(Boolean).join(' ');
};

export const serializeSystemLiteral = str =>
  str.includes('"')
    ? `'${ str }'`
    : `"${ str }"`;
