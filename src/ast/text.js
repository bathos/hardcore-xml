const name = value => {
  if (value === null || value === undefined) {
    return String(value);
  }

  return value.constructor.name;
};

export default {
  attDefType:            'Attdef must have valid type, e.g. CDATA, IDREFS, ...',
  attlistNeedsElement:   'Attlist declaration requires element name.',
  cdataHasLength:        'CDATA text length cannot be zero unless section.',
  commentNoDoubleHyphen: 'Comment content cannot include "--".',
  conformsToAttDef:      'Attribute must conform to the attribute definition.',
  csDeterminism:         'ContentSpec cannot be ambiguous or need lookaheads.',
  csElementNeedsName:    'ContentSpec ELEMENT type requires valid name.',
  csElementNoChildren:   'ContentSpec ELEMENT type can have no children',
  csNameOnlyElement:     'ContentSpec name only applies to type ELEMENT.',
  csNeedsChildren:       'ContentSpec CHOICE and SEQUENCE must have children.',
  csQualifier:           'ContentSpec qualifier must be *, +, ? or undefined.',
  csType:                'ContentSpec type must be CHOICE ELEMENT or SEQUENCE.',
  csValue:               'contentSpec must be ANY, EMPTY, or ContentSpec node.',
  defaultValMatch:       'Attdef default value must match attdef type.',
  doctypeFirst:          'Doctype must appear before the root element.',
  doctypeMatchesRoot:    'Root element must match doctype name.',
  entityIntOrExt:        'Entity must have either a value or an external ID.',
  entityNotationID:      'Unparsed entity requires external ID.',
  entityNotationType:    'Entity notation requires type UNPARSED & vice versa.',
  entityType:            'Entity type must be GENERAL, PARAMETER, or UNPARSED.',
  entityValue:           'Entity value must be valid codepoint array.',
  externalSubset:        'Doctype external must be ExternalSubset if defined.',
  fixedNeedsDefault:     'Fixed attribute requires explicit default value.',
  idNoDefault:           'ID attribute cannot have a default or fixed value.',
  matchesContent:        'Element content must match content spec.',
  mixedChildrenQual:     'Mixed content spec children cannot have qualifiers.',
  mixedChildrenType:     'Mixed content spec children must be type "ELEMENT"',
  mixedNeedsCSN:         'Element declaration "mixed" needs ContentSpec node.',
  mixedQualifier:        'Mixed content spec must have qualifier "*".',
  needsRoot:             'Document must have a root element.',
  noNotationEmpty:       'EMPTY element cannot have NOTATION type attribute.',
  noSectionTerminus:     'CDATA where section===true cannot contain "]]>"',
  noQMGT:                'PI instruction cannot include "?>".',
  oneDoctype:            'Document may have only one doctype declaration.',
  oneRoot:               'Document may have only one root element.',
  requiredNoDefault:     'Required attribute cannot have a default value.',
  targetNotXML:          'PI target cannot be "xml" (case insensitive).',

  alsoSystem:   thing => `${ thing } must have systemID if it has publicID.`,
  attDefDupe:   thing => `Element cannot have more than one ${ thing } attdef.`,
  declared:     thing => `${ thing } must be declared.`,
  invalidChar:  thing => `${ thing } cannot include illegal XML characters.`,
  isBoolean:    thing => `${ thing } must be a boolean value.`,
  isName:       thing => `${ thing } must be a valid XML name.`,
  isPublicID:   thing => `${ thing } public ID must use restricted characters.`,
  isString:     thing => `${ thing } must be a string.`,
  notationDecl: thing => `${ thing } notation must be declared.`,
  notEnumType:  thing => `${ thing } is not an enumerated type.`,
  requireDoc:   thing => `${ thing } validation requires document.`,
  requireDTD:   thing => `${ thing } validation requires doctype.`,
  systemQuotes: thing => `${ thing } system ID cannot contain both ' and ".`,
  validEnum:    thing => `${ thing } requires a valid, non-empty enumeration.`,
  redeclared:  (t, n) => `${ t } "${ n }" cannot be declared more than once.`,
  validChild:  (p, c) => `${ p } cannot have ${ name(c) } as a child.`
};
