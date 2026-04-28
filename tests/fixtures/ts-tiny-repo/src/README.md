<!-- Intentional adversarial fixture: a top-level FILE under src/ (not a
directory). The ts-repo extractor's `entry.isDirectory()` filter must skip
this file, otherwise the existing strict-equality test on emitted module
ids would fail (an extra `module.README` would appear). -->
