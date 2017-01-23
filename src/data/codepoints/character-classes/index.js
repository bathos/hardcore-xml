// This is the full list of multi-character classes which must be matched in
// various productions in XML.
//
// Each submodule is a single function that tests whether a codepoint belongs to
// the set. I experimented with various approaches here. Using an actual Set
// object is very fast — but this pattern is still faster. Relative to either,
// regex is glacially slow. I usually don’t worry a great deal about such things
// but given we must test almost every codepoint passing through the stream with
// one of these functions, I figured it was might be a spot that was worth it.

export { default as isAttValueCharDbl }  from './is-att-value-char-dbl';
export { default as isAttValueCharSng }  from './is-att-value-char-sng';
export { default as isCDATAChar }        from './is-cdata-char';
export { default as isDecChar }          from './is-dec-char';
export { default as isEncContinueChar }  from './is-enc-continue-char';
export { default as isEncStartChar }     from './is-enc-start-char';
export { default as isHexChar }          from './is-hex-char';
export { default as isLChar }            from './is-l-char';
export { default as isMChar }            from './is-m-char';
export { default as isNameContinueChar } from './is-name-continue-char';
export { default as isNameStartChar }    from './is-name-start-char';
export { default as isPublicIDCharDbl }  from './is-public-id-char-dbl';
export { default as isPublicIDCharSng }  from './is-public-id-char-sng';
export { default as isSystemIDCharDbl }  from './is-system-id-char-dbl';
export { default as isSystemIDCharSng }  from './is-system-id-char-sng';
export { default as isWhitespaceChar }   from './is-whitespace-char';
export { default as isXChar }            from './is-x-char';
export { default as isXMLChar }          from './is-xml-char';
