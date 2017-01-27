# XML Productions

## Productions of the Regular Language

```text
AttDef             ::= S Name S AttType S DefaultDecl
AttlistDecl        ::= '<!ATTLIST' S Name AttDef* S? '>'
Attribute          ::= Name Eq AttValue
AttType            ::= StringType | TokenizedType | EnumeratedType
AttValue           ::= '"' ([^<&"] | Reference)* '"' |  "'" ([^<&'] | Reference)* "'"
CData              ::= (Char* - (Char* ']]>' Char*))
CDEnd              ::= ']]>'
CDSect             ::= CDStart CData CDEnd
CDStart            ::= '<![CDATA['
Char               ::= #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
CharData           ::= [^<&]* - ([^<&]* ']]>' [^<&]*)
CharRef            ::= '&#' [0-9]+ ';' | '&#x' [0-9a-fA-F]+ ';'
DeclSep            ::= PEReference | S
DefaultDecl        ::= '#REQUIRED' | '#IMPLIED' | (('#FIXED' S)? AttValue)
EmptyElemTag       ::= '<' Name (S Attribute)* S? '/>' [WFC: Unique Att Spec]
EncName            ::= [A-Za-z] ([A-Za-z0-9._] | '-')*
EncodingDecl       ::= S 'encoding' Eq ('"' EncName '"' | "'" EncName "'" )
EntityDecl         ::= GEDecl | PEDecl
EntityDef          ::= EntityValue | (ExternalID NDataDecl?)
EntityRef          ::= '&' Name ';'
EntityValue        ::= '"' ([^%&"] | PEReference | Reference)* '"' |  "'" ([^%&'] | PEReference | Reference)* "'"
EnumeratedType     ::= NotationType | Enumeration
Enumeration        ::= '(' S? Nmtoken (S? '|' S? Nmtoken)* S? ')'
Eq                 ::= S? '=' S?
ETag               ::= '</' Name S? '>'
ExternalID         ::= 'SYSTEM' S SystemLiteral | 'PUBLIC' S PubidLiteral S SystemLiteral
GEDecl             ::= '<!ENTITY' S Name S EntityDef S? '>'
Ignore             ::= Char* - (Char* ('<![' | ']]>') Char*)
Misc               ::= Comment | PI | S
Mixed              ::= '(' S? '#PCDATA' (S? '|' S? Name)* S? ')*' | '(' S? '#PCDATA' S? ')'
Name               ::= NameStartChar (NameChar)*
NameChar           ::= NameStartChar | "-" | "." | [0-9] | #xB7 | [#x0300-#x036F] | [#x203F-#x2040]
Names              ::= Name (#x20 Name)*
NameStartChar      ::= ":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
NDataDecl          ::= S 'NDATA' S Name
Nmtoken            ::= (NameChar)+
Nmtokens           ::= Nmtoken (#x20 Nmtoken)*
NotationDecl       ::= '<!NOTATION' S Name S (ExternalID | PublicID) S? '>'
NotationType       ::= 'NOTATION' S '(' S? Name (S? '|' S? Name)* S? ')'
PEDecl             ::= '<!ENTITY' S '%' S Name S PEDef S? '>'
PEDef              ::= EntityValue | ExternalID
PEReference        ::= '%' Name ';'
PI                 ::= '<?' PITarget (S (Char* - (Char* '?>' Char*)))? '?>'
PITarget           ::= Name - (('X' | 'x') ('M' | 'm') ('L' | 'l'))
prolog             ::= XMLDecl? Misc* (doctypedecl Misc*)?
PubidChar          ::= #x20 | #xD | #xA | [a-zA-Z0-9] | [-'()+,./:=?;!*#@$_%]
PubidLiteral       ::= '"' PubidChar* '"' | "'" (PubidChar - "'")* "'"
PublicID           ::= 'PUBLIC' S PubidLiteral
Reference          ::= EntityRef | CharRef
S                  ::= (#x20 | #x9 | #xD | #xA)+
SDDecl             ::= S 'standalone' Eq (("'" ('yes' | 'no') "'") | ('"' ('yes' | 'no') '"'))
STag               ::= '<' Name (S Attribute)* S? '>'
StringType         ::= 'CDATA'
SystemLiteral      ::= ('"' [^"]* '"') | ("'" [^']* "'")
TextDecl           ::= '<?xml' VersionInfo? EncodingDecl S? '?>'
TokenizedType      ::= 'ID' | 'IDREF' | 'IDREFS' | 'ENTITY' | 'ENTITIES' | 'NMTOKEN' | 'NMTOKENS'
VersionInfo        ::= S 'version' Eq ("'" VersionNum "'" | '"' VersionNum '"')
VersionNum         ::= '1.' [0-9]+
XMLDecl            ::= '<?xml' VersionInfo EncodingDecl? SDDecl? S? '?>'

## The Rest

children           ::= (choice | seq) ('?' | '*' | '+')?
choice             ::= '(' S? cp ( S? '|' S? cp )+ S? ')'
Comment            ::= '<!--' ((Char - '-') | ('-' (Char - '-')))* '-->'
conditionalSect    ::= includeSect | ignoreSect
content            ::= CharData? ((element | Reference | CDSect | PI | Comment) CharData?)*
contentspec        ::= 'EMPTY' | 'ANY' | Mixed | children
cp                 ::= (Name | choice | seq) ('?' | '*' | '+')?
doctypedecl        ::= '<!DOCTYPE' S Name (S ExternalID)? S? ('[' intSubset ']' S?)? '>'
document           ::= prolog element Misc*
element            ::= EmptyElemTag | STag content ETag
elementdecl        ::= '<!ELEMENT' S Name S contentspec S? '>'
extParsedEnt       ::= TextDecl? content
extSubset          ::= TextDecl? extSubsetDecl
extSubsetDecl      ::= ( markupdecl | conditionalSect | DeclSep)*
ignoreSect         ::= '<![' S? 'IGNORE' S? '[' ignoreSectContents* ']]>'
ignoreSectContents ::= Ignore ('<![' ignoreSectContents ']]>' Ignore)*
includeSect        ::= '<![' S? 'INCLUDE' S? '[' extSubsetDecl ']]>'
intSubset          ::= (markupdecl | DeclSep)*
markupdecl         ::= elementdecl | AttlistDecl | EntityDecl | NotationDecl | PI | Comment
seq                ::= '(' S? cp ( S? ',' S? cp )* S? ')'
```

However, because of entity expansion, nearly all regular productions are not.
There is really only one list.
