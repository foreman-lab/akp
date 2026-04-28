// Intentional adversarial fixture: this file lives under src/.hidden/ so the
// ts-repo extractor's hidden-directory filter (skip names starting with `.`)
// is exercised by the existing strict-equality test on emitted module ids.
export const hidden = true;
