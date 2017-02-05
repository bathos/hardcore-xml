import ExtSubset from '../../ast/nodes/doctype-external';

export default function * () {
  const extSubset = new ExtSubset();

  yield extSubset;

}
