// Retain the old command as an entry point to the current all-bank validation.
// The old 18-book / split-PDF snapshot no longer describes the reader catalog.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
require('./check-question-resources.cjs');
