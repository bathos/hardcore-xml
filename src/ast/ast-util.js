import {
  isNameContinueChar,
  isNameStartChar,
  isPublicIDCharDbl,
  isXMLChar
} from '../data/codepoints';

const MAX_INDEX = 2 ** 32 - 2;

const toCodepoints = str =>
  Array
    .from(str)
    .map(char => char.codePointAt(0));

export const compareAlpha =
  new Intl.Collator().compare;

export const escapeCDATA = str =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\]\]>/g, ']]&gt;');

export const extID = ({ publicID, systemID }, opts) => {
  const keyword       = publicID ? 'PUBLIC' : 'SYSTEM';
  const systemLiteral = systemID && quote(systemID, opts);
  const publicLiteral = publicID && quote(publicID, opts);

  return [ keyword, publicLiteral, systemLiteral ].filter(Boolean).join(' ');
};

export const format = (str, opts, outdented) => {
  const lines      = [];
  const words      = str.split(/ /g);
  const headPrefix = indent(opts);
  const restPrefix = outdented
    ? indent(Object.assign({}, opts, { depth: opts.depth + 1 }))
    : headPrefix;

  while (words.length) {
    const prefix = lines.length ? restPrefix : headPrefix;
    const width  = Math.max(opts.minWidth, opts.wrapColumn - prefix.length);

    let line = prefix + words.shift();
    let word;

    while (word = words.shift()) {
      const newLength = line.length + word.length + 1;

      if (newLength <= width) {
        line += ` ${ word }`;
      } else {
        words.unshift(word);
        break;
      }
    }

    lines.push(line);
  }

  return lines.join('\n');
};

export const indent = ({ depth, indent }) =>
  ' '.repeat(indent * depth);

export const isArrayIndex = key =>
  typeof key === 'string' &&
  key >= 0 &&
  String(Number.parseInt(key)) === key &&
  key < MAX_INDEX;

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

export const quote = (str, { preferSingle }, mayEscape) => {
  const delim = preferSingle
    ? mayEscape || !str.includes('\'') ? '\'' : '"'
    : mayEscape || !str.includes('"') ? '"' : '\'';

  const esc = delim === '"'
    ? '&quot;'
    : '&apos;';

  const value = mayEscape ? str.replace(new RegExp(delim, 'g'), esc) : str;

  return `${ delim }${ value }${ delim }`;
};

export const refOut = str => str
  .replace(/&#/g, '&#x26;#')
  .replace(/[<%'"]/g, char => `&#x${ char.codePointAt(0).toString(16) };`);

export const ws = str => str
  .replace(/\s+/g, ' ').trim();
