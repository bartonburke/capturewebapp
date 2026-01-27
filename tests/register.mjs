// Registers the @/ path alias resolver for Node.js module loading
// Usage: node --experimental-strip-types --import ./tests/register.mjs --test tests/**/*.test.ts

import { register } from 'node:module';

register('./resolve-aliases.mjs', import.meta.url);
