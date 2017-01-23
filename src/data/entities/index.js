import {
  AMPERSAND, EIGHT, FOUR, HASH, NINE, SEMICOLON, SIX, THREE, TWO, ZERO
} from '../codepoints';

// Note that the predefined entities map to character references, not literal
// characters, which is an important distinction when doing ‘real’ expansion
// since literal '&' is actually the start of another reference.

export default {
  xml: new Map([
    [ 'amp',  [ AMPERSAND, HASH, THREE, EIGHT, SEMICOLON ] ], // & -- &#38;
    [ 'apos', [ AMPERSAND, HASH, THREE,  NINE, SEMICOLON ] ], // ' -- &#39;
    [ 'gt',   [ AMPERSAND, HASH,   SIX,   TWO, SEMICOLON ] ], // > -- &#62;
    [ 'lt',   [ AMPERSAND, HASH,   SIX,  ZERO, SEMICOLON ] ], // < -- &#60;
    [ 'quot', [ AMPERSAND, HASH, THREE,  FOUR, SEMICOLON ] ]  // " -- &#34;
  ])
};
