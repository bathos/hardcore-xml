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
