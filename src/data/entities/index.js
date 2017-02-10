import {
  AMPERSAND, EIGHT, FOUR, HASH_SIGN, NINE, SEMICOLON, SIX, THREE, TWO, ZERO
} from '../codepoints';

// Note that the predefined entities map to character references, not literal
// characters, which is an important distinction when doing ‘real’ expansion
// since literal '&' is actually the start of another reference.
//
// The formal definitions are:
//
// <!ENTITY lt     "&#38;#60;">
// <!ENTITY gt     "&#62;">
// <!ENTITY amp    "&#38;#38;">
// <!ENTITY apos   "&#39;">
// <!ENTITY quot   "&#34;">
//
// Note how lt and amp are double-escaped. This is for the aforementioned
// reasons. Why not the others? The spec states it would be "OPTIONAL but
// harmless" to give the others the same treatment, which makes sense when you
// take into account other rules. For example, during entity expansion within
// an attribute value, any ' or " is interpreted as chardata no matter what, and
// during entity expansion within element content, quotation marks have no
// special meaning and GT is legal (the sequence ]]> is illegal, but only when
// *literal*, if I understand correctly). However "<" is illegal in an attribute
// value, means markup start on encounter in CDATA, and "&" begins an entity
// reference in both, hence the need to ensure the expansion text is itself a
// character reference.
//
// This is very confusing ... but I think I finally understand it.
//
// Below we provide *post-parsing* values. In other words, we have done the
// "OPTIONAL but harmless" thing and made them all escaped char-refs. But since
// this is the value after parsing, the "escape" part is not seen (in each case,
// the implied source text for AMPERSAND would have been AMPERSAND, HASH_SIGN,
// THREE, EIGHT, SEMICOLON, as in lt and amp above, with the remainder being the
// same literal codepoints).

export default new Map([
  [ 'amp', {
    type: 'GENERAL',
    value: [ AMPERSAND, HASH_SIGN, THREE, EIGHT, SEMICOLON ] // & -- &#38;
  } ],
  [ 'apos', {
    type: 'GENERAL',
    value: [ AMPERSAND, HASH_SIGN, THREE,  NINE, SEMICOLON ] // ' -- &#39;
  } ],
  [ 'gt', {
    type: 'GENERAL',
    value: [ AMPERSAND, HASH_SIGN,   SIX,   TWO, SEMICOLON ] // > -- &#62;
  } ],
  [ 'lt', {
    type: 'GENERAL',
    value: [ AMPERSAND, HASH_SIGN,   SIX,  ZERO, SEMICOLON ] // < -- &#60;
  } ],
  [ 'quot', {
    type: 'GENERAL',
    value: [ AMPERSAND, HASH_SIGN, THREE,  FOUR, SEMICOLON ] // " -- &#34;
  } ],
]);
