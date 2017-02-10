import cp1250     from './one-byte/cp-1250';
import cp1251     from './one-byte/cp-1251';
import cp1252     from './one-byte/cp-1252';
import cp1253     from './one-byte/cp-1253';
import cp1254     from './one-byte/cp-1254';
import cp1255     from './one-byte/cp-1255';
import cp1256     from './one-byte/cp-1256';
import cp1257     from './one-byte/cp-1257';
import cp1258     from './one-byte/cp-1258';
import iso88591   from './one-byte/iso-8859-1';
import iso88592   from './one-byte/iso-8859-2';
import iso88593   from './one-byte/iso-8859-3';
import iso88594   from './one-byte/iso-8859-4';
import iso88595   from './one-byte/iso-8859-5';
import iso88596   from './one-byte/iso-8859-6';
import iso88597   from './one-byte/iso-8859-7';
import iso88598   from './one-byte/iso-8859-8';
import iso88599   from './one-byte/iso-8859-9';
import iso885910  from './one-byte/iso-8859-10';
import iso885911  from './one-byte/iso-8859-11';
import iso885913  from './one-byte/iso-8859-13';
import iso885914  from './one-byte/iso-8859-14';
import iso885915  from './one-byte/iso-8859-15';
import iso885916  from './one-byte/iso-8859-16';
import shiftjis   from './shift-jis/shift-jis';
import usascii    from './one-byte/us-ascii';

// 4.3.3 Character Encoding in Entities
//
// In an encoding declaration, the values "UTF-8", "UTF-16", "ISO-10646-UCS-2",
// and "ISO-10646-UCS-4" should be used for the various encodings and
// transformations of Unicode/ISO/IEC 10646, the values "ISO-8859-1",
// "ISO-8859-2", ... "ISO-8859-n" (where n is the part number) should be used
// for the parts of ISO 8859, and the values "ISO-2022-JP", "Shift_JIS", and
// "EUC-JP" should be used for the various encoded forms of JIS X-0208-1997. It
// is recommended that character encodings registered (as charsets) with the
// Internet Assigned Numbers Authority [IANA-CHARSETS], other than those just
// listed, be referred to using their registered names; other encodings should
// use names starting with an "x-" prefix. XML processors should match character
// encoding names in a case-insensitive way and should either interpret an
// IANA-registered name as the encoding registered at IANA for that name or
// treat it as unknown (processors are, of course, not required to support all
// IANA-registered encodings).
//
// -----------------------------------------------------------------------------
//
// While the spec only demands recognition of UTF8, 16, 32, and UCS-2/4, we do
// support a variety of other encodings (mainly: the easy ones). Beyond case
// insensitivity we also strip non alphanumeric characters when matching
// (despite the fact that this mashes numbers together, I haven’t seen any cases
// where this results in ambiguity). The names below come from
//
//    http://www.iana.org/assignments/character-sets/character-sets.xhtml
//
// as described above; however, those marked with "*" are additions I included,
// some of which are obvious (ASCII) and some of which I pulled from iconv-lite.

export default {
  ANSIX341968:        { codepage: usascii,   type: 'ONEBYTE'  },
  ANSIX341986:        { codepage: usascii,   type: 'ONEBYTE'  },
  ARABIC:             { codepage: iso88596,  type: 'ONEBYTE'  },
  ARABIC8:            { codepage: iso88596,  type: 'ONEBYTE'  }, // *
  ASCII:              { codepage: usascii,   type: 'ONEBYTE'  }, // *
  ASMO708:            { codepage: iso88596,  type: 'ONEBYTE'  },
  CELTIC:             { codepage: iso885914, type: 'ONEBYTE'  }, // *
  CELTIC8:            { codepage: iso885914, type: 'ONEBYTE'  }, // *
  CP367:              { codepage: usascii,   type: 'ONEBYTE'  },
  CP819:              { codepage: iso88591,  type: 'ONEBYTE'  },
  CP1250:             { codepage: cp1250,    type: 'ONEBYTE'  }, // *
  CP1251:             { codepage: cp1251,    type: 'ONEBYTE'  }, // *
  CP1252:             { codepage: cp1252,    type: 'ONEBYTE'  }, // *
  CP1253:             { codepage: cp1253,    type: 'ONEBYTE'  }, // *
  CP1254:             { codepage: cp1254,    type: 'ONEBYTE'  }, // *
  CP1255:             { codepage: cp1255,    type: 'ONEBYTE'  }, // *
  CP1256:             { codepage: cp1256,    type: 'ONEBYTE'  }, // *
  CP1257:             { codepage: cp1257,    type: 'ONEBYTE'  }, // *
  CP1258:             { codepage: cp1258,    type: 'ONEBYTE'  }, // *
  CSASCII:            { codepage: usascii,   type: 'ONEBYTE'  },
  CSISO885913:        { codepage: iso885913, type: 'ONEBYTE'  },
  CSISO885914:        { codepage: iso885914, type: 'ONEBYTE'  },
  CSISO885915:        { codepage: iso885915, type: 'ONEBYTE'  },
  CSISO885916:        { codepage: iso885916, type: 'ONEBYTE'  },
  CSISOLATIN1:        { codepage: iso88591,  type: 'ONEBYTE'  },
  CSISOLATIN2:        { codepage: iso88592,  type: 'ONEBYTE'  },
  CSISOLATIN3:        { codepage: iso88593,  type: 'ONEBYTE'  },
  CSISOLATIN4:        { codepage: iso88594,  type: 'ONEBYTE'  },
  CSISOLATIN5:        { codepage: iso88599,  type: 'ONEBYTE'  },
  CSISOLATIN6:        { codepage: iso885910, type: 'ONEBYTE'  },
  CSISOLATINARABIC:   { codepage: iso88596,  type: 'ONEBYTE'  },
  CSISOLATINCYRILLIC: { codepage: iso88595,  type: 'ONEBYTE'  },
  CSISOLATINGREEK:    { codepage: iso88597,  type: 'ONEBYTE'  },
  CSISOLATINHEBREW:   { codepage: iso88598,  type: 'ONEBYTE'  },
  CSSHIFTJIS:         { codepage: shiftjis,  type: 'SHIFTJIS' },
  CSTIS620:           { codepage: iso885911, type: 'ONEBYTE'  },
  CSUCS4:             {                      type: 'UTF32'    },
  CSUNICODE:          { noSurrogates: true,  type: 'UTF16'    },
  CSUTF8:             {                      type: 'UTF8'     },
  CSUTF16:            {                      type: 'UTF16'    },
  CSUTF16BE:          { endianness: 'BE',    type: 'UTF16'    },
  CSUTF16LE:          { endianness: 'LE',    type: 'UTF16'    },
  CSUTF32:            {                      type: 'UTF32'    },
  CSUTF32BE:          { endianness: 'BE',    type: 'UTF32'    },
  CSUTF32LE:          { endianness: 'LE',    type: 'UTF32'    },
  CSWINDOWS1250:      { codepage: cp1250,    type: 'ONEBYTE'  },
  CSWINDOWS1251:      { codepage: cp1251,    type: 'ONEBYTE'  },
  CSWINDOWS1252:      { codepage: cp1252,    type: 'ONEBYTE'  },
  CSWINDOWS1253:      { codepage: cp1253,    type: 'ONEBYTE'  },
  CSWINDOWS1254:      { codepage: cp1254,    type: 'ONEBYTE'  },
  CSWINDOWS1255:      { codepage: cp1255,    type: 'ONEBYTE'  },
  CSWINDOWS1256:      { codepage: cp1256,    type: 'ONEBYTE'  },
  CSWINDOWS1257:      { codepage: cp1257,    type: 'ONEBYTE'  },
  CSWINDOWS1258:      { codepage: cp1258,    type: 'ONEBYTE'  },
  CYRILLIC:           { codepage: iso88595,  type: 'ONEBYTE'  },
  ECMA114:            { codepage: iso88596,  type: 'ONEBYTE'  },
  ECMA118:            { codepage: iso88597,  type: 'ONEBYTE'  },
  ELOT928:            { codepage: iso88597,  type: 'ONEBYTE'  },
  GREEK:              { codepage: iso88597,  type: 'ONEBYTE'  },
  GREEK8:             { codepage: iso88597,  type: 'ONEBYTE'  },
  HEBREW:             { codepage: iso88598,  type: 'ONEBYTE'  },
  HEBREW8:            { codepage: iso88598,  type: 'ONEBYTE'  }, // *
  IBM367:             { codepage: usascii,   type: 'ONEBYTE'  },
  IBM819:             { codepage: iso88591,  type: 'ONEBYTE'  },
  ISO646IRV1991:      { codepage: usascii,   type: 'ONEBYTE'  },
  ISO646US:           { codepage: usascii,   type: 'ONEBYTE'  },
  ISO10646UCS2:       { noSurrogates: true,  type: 'UTF16'    },
  ISO10646UCS4:       {                      type: 'UTF32'    },
  ISO88591:           { codepage: iso88591,  type: 'ONEBYTE'  },
  ISO88592:           { codepage: iso88592,  type: 'ONEBYTE'  },
  ISO88593:           { codepage: iso88593,  type: 'ONEBYTE'  },
  ISO88594:           { codepage: iso88594,  type: 'ONEBYTE'  },
  ISO88595:           { codepage: iso88595,  type: 'ONEBYTE'  },
  ISO88596:           { codepage: iso88596,  type: 'ONEBYTE'  },
  ISO88597:           { codepage: iso88597,  type: 'ONEBYTE'  },
  ISO88598:           { codepage: iso88598,  type: 'ONEBYTE'  },
  ISO88599:           { codepage: iso88599,  type: 'ONEBYTE'  },
  ISO885910:          { codepage: iso885910, type: 'ONEBYTE'  },
  ISO885911:          { codepage: iso885911, type: 'ONEBYTE'  },
  ISO885913:          { codepage: iso885913, type: 'ONEBYTE'  },
  ISO885914:          { codepage: iso885914, type: 'ONEBYTE'  },
  ISO885915:          { codepage: iso885915, type: 'ONEBYTE'  },
  ISO885916:          { codepage: iso885916, type: 'ONEBYTE'  },
  ISO8859101992:      { codepage: iso885910, type: 'ONEBYTE'  },
  ISO8859141998:      { codepage: iso885914, type: 'ONEBYTE'  },
  ISO8859162001:      { codepage: iso885916, type: 'ONEBYTE'  },
  ISOCELTIC:          { codepage: iso885914, type: 'ONEBYTE'  },
  ISOIR6:             { codepage: usascii,   type: 'ONEBYTE'  },
  ISOIR100:           { codepage: iso88591,  type: 'ONEBYTE'  },
  ISOIR101:           { codepage: iso88592,  type: 'ONEBYTE'  },
  ISOIR109:           { codepage: iso88593,  type: 'ONEBYTE'  },
  ISOIR110:           { codepage: iso88594,  type: 'ONEBYTE'  },
  ISOIR126:           { codepage: iso88597,  type: 'ONEBYTE'  },
  ISOIR127:           { codepage: iso88596,  type: 'ONEBYTE'  },
  ISOIR138:           { codepage: iso88598,  type: 'ONEBYTE'  },
  ISOIR144:           { codepage: iso88595,  type: 'ONEBYTE'  },
  ISOIR148:           { codepage: iso88599,  type: 'ONEBYTE'  },
  ISOIR157:           { codepage: iso885910, type: 'ONEBYTE'  },
  ISOIR199:           { codepage: iso885914, type: 'ONEBYTE'  },
  ISOIR226:           { codepage: iso885916, type: 'ONEBYTE'  },
  L1:                 { codepage: iso88591,  type: 'ONEBYTE'  },
  L2:                 { codepage: iso88592,  type: 'ONEBYTE'  },
  L3:                 { codepage: iso88593,  type: 'ONEBYTE'  },
  L4:                 { codepage: iso88594,  type: 'ONEBYTE'  },
  L5:                 { codepage: iso88599,  type: 'ONEBYTE'  },
  L6:                 { codepage: iso885910, type: 'ONEBYTE'  },
  L8:                 { codepage: iso885914, type: 'ONEBYTE'  },
  L10:                { codepage: iso885916, type: 'ONEBYTE'  },
  LATIN1:             { codepage: iso88591,  type: 'ONEBYTE'  },
  LATIN2:             { codepage: iso88592,  type: 'ONEBYTE'  },
  LATIN3:             { codepage: iso88593,  type: 'ONEBYTE'  },
  LATIN4:             { codepage: iso88594,  type: 'ONEBYTE'  },
  LATIN5:             { codepage: iso88599,  type: 'ONEBYTE'  },
  LATIN6:             { codepage: iso885910, type: 'ONEBYTE'  },
  LATIN8:             { codepage: iso885914, type: 'ONEBYTE'  },
  LATIN9:             { codepage: iso885915, type: 'ONEBYTE'  },
  LATIN10:            { codepage: iso885916, type: 'ONEBYTE'  },
  MSKANJI:            { codepage: shiftjis,  type: 'SHIFTJIS' },
  SHIFTJIS:           { codepage: shiftjis,  type: 'SHIFTJIS' },
  THAI:               { codepage: iso885911, type: 'ONEBYTE'  }, // *
  THAI8:              { codepage: iso885911, type: 'ONEBYTE'  }, // *
  TIS620:             { codepage: iso885911, type: 'ONEBYTE'  }, // **
  TIS62025291:        { codepage: iso885911, type: 'ONEBYTE'  }, // * **
  TIS62025330:        { codepage: iso885911, type: 'ONEBYTE'  }, // * **
  TURKISH:            { codepage: iso88599,  type: 'ONEBYTE'  }, // *
  TURKISH8:           { codepage: iso88599,  type: 'ONEBYTE'  }, // *
  UCS2:               { noSurrogates: true,  type: 'UTF16'    }, // *
  UCS4:               {                      type: 'UTF32'    }, // *
  US:                 { codepage: usascii,   type: 'ONEBYTE'  },
  USASCII:            { codepage: usascii,   type: 'ONEBYTE'  },
  UTF8:               {                      type: 'UTF8'     },
  UTF16:              {                      type: 'UTF16'    },
  UTF16BE:            { endianness: 'BE',    type: 'UTF16'    },
  UTF16LE:            { endianness: 'LE',    type: 'UTF16'    },
  UTF32:              {                      type: 'UTF32'    },
  UTF32BE:            { endianness: 'BE',    type: 'UTF32'    },
  UTF32LE:            { endianness: 'LE',    type: 'UTF32'    },
  WINDOWS1250:        { codepage: cp1250,    type: 'ONEBYTE'  },
  WINDOWS1251:        { codepage: cp1251,    type: 'ONEBYTE'  },
  WINDOWS1252:        { codepage: cp1252,    type: 'ONEBYTE'  },
  WINDOWS1253:        { codepage: cp1253,    type: 'ONEBYTE'  },
  WINDOWS1254:        { codepage: cp1254,    type: 'ONEBYTE'  },
  WINDOWS1255:        { codepage: cp1255,    type: 'ONEBYTE'  },
  WINDOWS1256:        { codepage: cp1256,    type: 'ONEBYTE'  },
  WINDOWS1257:        { codepage: cp1257,    type: 'ONEBYTE'  },
  WINDOWS1258:        { codepage: cp1258,    type: 'ONEBYTE'  }
};

// ** TIS620 is technically not identical to ISO-8859-9 because it has one fewer
//    assigned codepoint, but IANA-CHARSETS expressly indicates that they should
//    be conflated.

// BOMs, including two strange byte orders (flipped: true) that are specifically
// mentioned in the spec.

export const BOMS = [
  { bytes: [ 0x00, 0x00, 0xFE, 0xFF ], enc: 'UTF32BE', flipped: false },
  { bytes: [ 0xFF, 0xFE, 0x00, 0x00 ], enc: 'UTF32LE', flipped: false },
  { bytes: [ 0x00, 0x00, 0xFF, 0xFE ], enc: 'UTF32BE', flipped: true  },
  { bytes: [ 0xFE, 0xFF, 0x00, 0x00 ], enc: 'UTF32LE', flipped: true  },
  { bytes: [ 0xFF, 0xFE ],             enc: 'UTF16BE'                 },
  { bytes: [ 0xFE, 0xFF ],             enc: 'UTF16LE'                 },
  { bytes: [ 0xEF, 0xBB, 0xBF ],       enc: 'UTF8'                    }
];

// In addition to the BOM-based detection, a heuristic is prescribed based on
// the appearance of "<" or "<?" in various encodings. (They also describe the
// signature of all "<?xm" of ASCII compatible encodings, but we can ignore this
// since we do not support any encodings which do not fall in this category, and
// the fallback will just be UTF-8).

export const SIGNALS = [
  // "<"
  { bytes: [ 0x00, 0x00, 0x00, 0x3C ], enc: 'UTF32BE', flipped: false },
  { bytes: [ 0x3C, 0x00, 0x00, 0x00 ], enc: 'UTF32LE', flipped: false },
  { bytes: [ 0x00, 0x00, 0x3C, 0x00 ], enc: 'UTF32BE', flipped: true  },
  { bytes: [ 0x00, 0x3C, 0x00, 0x00 ], enc: 'UTF32LE', flipped: true  },

  // "<?"
  { bytes: [ 0x00, 0x3C, 0x00, 0x3F ], enc: 'UTF16BE'                 },
  { bytes: [ 0x3C, 0x00, 0x3F, 0x00 ], enc: 'UTF16LE'                 }
];
