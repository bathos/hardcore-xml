import {
  isNameContinueChar,
  isNameStartChar,
  isPublicIDCharDbl,
  isPublicIDCharSng,
  isSystemIDCharDbl,
  isSystemIDCharSng,
  isWhitespaceChar,

  EQUALS_SIGN, P_UPPER, QUOTE_DBL, QUOTE_SNG, S_UPPER,

  PUBLIC_CPS, SYSTEM_CPS
} from '../data/codepoints';

// GENERIC /////////////////////////////////////////////////////////////////////

// Eats codepoints matching pred zero or more times.

export const asterisk = function * (pred, acc) {
  const isFn = pred instanceof Function;

  while (true) {
    const cp = yield;

    if (isFn ? pred(cp) : cp === pred) {
      acc && acc.push(cp);
      continue;
    }

    yield cp;

    return acc;
  }
};

// Eats codepoint matching pred exactly once. Optional expectation message.

export const one = function * (pred, exp, acc) {
  const cp = yield;

  if (pred instanceof Function ? pred(cp) : cp === pred) {
    acc && acc.push(cp);
  } else {
    yield (
      exp ||
      pred.description ||
      (Number.isFinite(pred) ? `"${ String.fromCodePoint(pred) }"` : 'EOF')
    );
  }

  return acc;
};

// Eats codepoint matching one of the predicates once, and returns it.

export const oneOf = function * (...preds) {
  const cp = yield;

  if (preds.some(pred => pred instanceof Function ? pred(cp) : cp === pred)) {
    return cp;
  }

  // Going to just say last member never includes comma...

  yield preds
    .map(pred => pred.description || `"${ String.fromCodePoint(pred) }"`)
    .join(', ')
    .replace(/, ([^,]+)$/, ' or $1');
};

// Eats codepoints matching one or more times. Optional expectation message.

export const plus = function * (pred, exp, acc) {
  yield * one(pred, exp, acc);
  return yield * asterisk(pred, acc);
};

// Eats codepoints matching pred zero or one times.

export const question = function * (pred, acc) {
  const cp = yield;

  if (pred instanceof Function ? pred(cp) : cp === pred) {
    acc && acc.push(cp);
  } else {
    yield cp;
  }

  return acc;
};

// Eats codepoints matching exactly the input series. Index may be provided to
// begin at a point other than the start.

export const series = function * (expectedCPs, startIndex, acc) {
  const subset = startIndex
    ? expectedCPs.slice(startIndex)
    : expectedCPs;

  let index = startIndex;

  for (const expectedCP of subset) {

    const cp = yield;

    if (cp === expectedCP) {
      acc && acc.push(cp);
      index++;
      continue;
    }

    const str = String.fromCodePoint(...expectedCPs);
    const chr = String.fromCodePoint(expectedCP);
    const exp = `"${ chr }" of "${ str }"`;
    const cnt = expectedCPs.filter(cp => cp === expectedCP).length;

    if (cnt > 1) {
      const n = expectedCPs
        .slice(0, index + 1)
        .filter(cp => cp === expectedCP)
        .length;

      // We can be lazy — three Ts in ATTLIST is as high as it goes.

      const ordinal =
        n === 1 ? 'first' :
        n === 2 ? 'second' :
                  'third';

      yield `${ ordinal } ${ exp }`;
    } else {
      yield exp;
    }
  }

  return acc;
};

// SPECIFIC MINOR PRODUCTIONS //////////////////////////////////////////////////
//
// A handful of sequences that appear frequently as smaller pieces of larger
// markup productions and do not correspond to nodes. Thrown in here for
// convenience.

// Returns whole name string. May be seeded with initial codepoint.

export const accreteName = function * (initCp) {
  const cp = initCp || (yield);

  if (isNameStartChar(cp)) {
    const cps = yield * asterisk(isNameContinueChar, [ cp ]);
    return String.fromCodePoint(...cps);
  }

  yield isNameStartChar.description;
};

// Eat-and-toss equals sign sequence, appearing in element attributes, xml and
// text declarations.

export const equals = function * () {
  yield * asterisk(isWhitespaceChar);
  yield * one(EQUALS_SIGN);
  yield * asterisk(isWhitespaceChar);
};

// External ID (PUBLIC "foo" "bar" etc) appears in many markup declarations.
// Always expects the initial CP. If second arg is true, permits PUBLIC external
// ID without the system literal (odd case for NOTATION declaration).

export const externalID = function * (initCP, permitPublicAlone) {
  let publicID;

  const cp = initCP || (yield * oneOf(P_UPPER, S_UPPER));

  if (cp === P_UPPER) {
    const publicCPs = [];

    yield * series(PUBLIC_CPS, 1);
    yield * plus(isWhitespaceChar);

    const delim = yield * oneOf(QUOTE_DBL, QUOTE_SNG);
    const pred = delim === QUOTE_DBL ? isPublicIDCharDbl : isPublicIDCharSng;

    yield * asterisk(pred, publicCPs);
    yield * one(delim);

    publicID = String
      .fromCodePoint(...publicCPs)
      .replace(/[\n\r\t ]{2,}/g, ' ')
      .replace(/(?:^ +| +$)/g, '');

    const afterCP = yield;

    if (!isWhitespaceChar(afterCP)) {
      if (permitPublicAlone) {
        yield afterCP;
        return { publicID };
      }

      yield 'whitespace before systemID literal';
    }

    yield * asterisk(isWhitespaceChar);

    const nextCP = yield;

    if (nextCP === QUOTE_DBL || nextCP === QUOTE_SNG) {
      yield nextCP;
    } else if (permitPublicAlone) {
      yield nextCP;
      return { publicID };
    } else {
      yield '""" or "\'" beginning systemID literal';
      return;
    }
  } else {
    yield * series(SYSTEM_CPS, 1);
    yield * plus(isWhitespaceChar);
  }

  const systemCPs = [];

  const delim = yield * oneOf(QUOTE_DBL, QUOTE_SNG);
  const pred = delim === QUOTE_DBL ? isSystemIDCharDbl : isSystemIDCharSng;

  yield * asterisk(pred, systemCPs);
  yield * one(delim);

  const systemID = String.fromCodePoint(...systemCPs);

  return { publicID, systemID };
};
