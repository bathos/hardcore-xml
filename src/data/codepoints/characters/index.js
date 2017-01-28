// This is the full list of codepoints which must be uniquely matched in various
// productions in XML, plus several digits which are used in the definitions of
// predefined entities.
//
// EOF is represented by an object because it:
// - must be truthy (null is not) so that we can do "cp || yield"
// - must be NaNish (symbol is incomparable) so value checks fail correctly

export const A_LOWER           = 'a'.codePointAt(0);
export const A_UPPER           = 'A'.codePointAt(0);
export const AMPERSAND         = '&'.codePointAt(0);
export const ASTERISK          = '*'.codePointAt(0);
export const B_UPPER           = 'B'.codePointAt(0);
export const BRACKET_LEFT      = '['.codePointAt(0);
export const BRACKET_RIGHT     = ']'.codePointAt(0);
export const C_LOWER           = 'c'.codePointAt(0);
export const C_UPPER           = 'C'.codePointAt(0);
export const COMMA             = ','.codePointAt(0);
export const CR                = '\r'.codePointAt(0);
export const D_LOWER           = 'd'.codePointAt(0);
export const D_UPPER           = 'D'.codePointAt(0);
export const E_LOWER           = 'e'.codePointAt(0);
export const E_UPPER           = 'E'.codePointAt(0);
export const EIGHT             = '8'.codePointAt(0);
export const EOF               = {};
export const EQUALS_SIGN       = '='.codePointAt(0);
export const EXCLAMATION_POINT = '!'.codePointAt(0);
export const F_UPPER           = 'F'.codePointAt(0);
export const FOUR              = '4'.codePointAt(0);
export const G_LOWER           = 'g'.codePointAt(0);
export const G_UPPER           = 'G'.codePointAt(0);
export const GREATER_THAN      = '>'.codePointAt(0);
export const HASH_SIGN         = '#'.codePointAt(0);
export const HYPHEN            = '-'.codePointAt(0);
export const I_LOWER           = 'i'.codePointAt(0);
export const I_UPPER           = 'I'.codePointAt(0);
export const K_UPPER           = 'K'.codePointAt(0);
export const L_LOWER           = 'l'.codePointAt(0);
export const L_UPPER           = 'L'.codePointAt(0);
export const LESS_THAN         = '<'.codePointAt(0);
export const LF                = '\n'.codePointAt(0);
export const M_LOWER           = 'm'.codePointAt(0);
export const M_UPPER           = 'M'.codePointAt(0);
export const N_LOWER           = 'n'.codePointAt(0);
export const N_UPPER           = 'N'.codePointAt(0);
export const NINE              = '9'.codePointAt(0);
export const O_LOWER           = 'o'.codePointAt(0);
export const O_UPPER           = 'O'.codePointAt(0);
export const ONE               = '1'.codePointAt(0);
export const P_UPPER           = 'P'.codePointAt(0);
export const PARENTHESIS_LEFT  = '('.codePointAt(0);
export const PARENTHESIS_RIGHT = ')'.codePointAt(0);
export const PERCENT_SIGN      = '%'.codePointAt(0);
export const PERIOD            = '.'.codePointAt(0);
export const PIPE              = '|'.codePointAt(0);
export const PLUS_SIGN         = '+'.codePointAt(0);
export const Q_UPPER           = 'Q'.codePointAt(0);
export const QUESTION_MARK     = '?'.codePointAt(0);
export const QUOTE_DBL         = '"'.codePointAt(0);
export const QUOTE_SNG         = '\''.codePointAt(0);
export const R_LOWER           = 'r'.codePointAt(0);
export const R_UPPER           = 'R'.codePointAt(0);
export const S_LOWER           = 's'.codePointAt(0);
export const S_UPPER           = 'S'.codePointAt(0);
export const SEMICOLON         = ';'.codePointAt(0);
export const SIX               = '6'.codePointAt(0);
export const SLASH             = '/'.codePointAt(0);
export const SPACE             = ' '.codePointAt(0);
export const T_LOWER           = 't'.codePointAt(0);
export const T_UPPER           = 'T'.codePointAt(0);
export const TAB               = '\t'.codePointAt(0);
export const THREE             = '3'.codePointAt(0);
export const TWO               = '2'.codePointAt(0);
export const U_UPPER           = 'U'.codePointAt(0);
export const V_LOWER           = 'v'.codePointAt(0);
export const X_LOWER           = 'x'.codePointAt(0);
export const X_UPPER           = 'X'.codePointAt(0);
export const Y_LOWER           = 'y'.codePointAt(0);
export const Y_UPPER           = 'Y'.codePointAt(0);
export const ZERO              = '0'.codePointAt(0);
