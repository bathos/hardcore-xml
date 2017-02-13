// This is the full list of multi-character classes which must be matched in
// various productions in XML.
//
// Some, like isCommentChar, define not the "legal characters" specifically, but
// rather the set of legal characters not including potential terminal sequence
// start characters.
//
// Each submodule is a single function that tests whether a codepoint belongs to
// the set. Using codepoints is massively faster than regex, and also faster
// than using Set (fwiw; it’s not like I’ve been specifically aiming for
// performance or anything so I’m sure whatever bottlenecks may exist would be
// elsewhere, anyway).
//
// Each function has a "description" property which is used when composing
// failed expectation messages during processing.

export { default as isAttValueCharDbl }    from './is-att-value-char-dbl';
export { default as isAttValueCharSng }    from './is-att-value-char-sng';
export { default as isCDATAChar }          from './is-cdata-char';
export { default as isCDATASectionChar }   from './is-cdata-section-char';
export { default as isCommentChar }        from './is-comment-char';
export { default as isDecChar }            from './is-dec-char';
export { default as isEncContinueChar }    from './is-enc-continue-char';
export { default as isEncStartChar }       from './is-enc-start-char';
export { default as isHexChar }            from './is-hex-char';
export { default as isNameContinueChar }   from './is-name-continue-char';
export { default as isNameStartChar }      from './is-name-start-char';
export { default as isProcInstValueChar }  from './is-proc-inst-value-char';
export { default as isPublicIDCharDbl }    from './is-public-id-char-dbl';
export { default as isPublicIDCharSng }    from './is-public-id-char-sng';
export { default as isSystemIDCharDbl }    from './is-system-id-char-dbl';
export { default as isSystemIDCharSng }    from './is-system-id-char-sng';
export { default as isWhitespaceChar }     from './is-whitespace-char';
export { default as isXMLChar }            from './is-xml-char';
