// Intentional adversarial fixture: this file lives under src/_internal/ so the
// ts-repo extractor's underscore-prefix filter (skip names starting with `_`)
// is exercised by the existing strict-equality test on emitted module ids.
export const internal = true;
