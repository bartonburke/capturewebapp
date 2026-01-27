// Custom Node.js module loader to resolve:
// 1. @/ path aliases from tsconfig.json
// 2. Extensionless .ts imports (Next.js convention → Node.js)

import path from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');

export function resolve(specifier, context, next) {
  let resolvedSpecifier = specifier;

  // Step 1: Resolve @/ alias to project root
  if (resolvedSpecifier.startsWith('@/')) {
    resolvedSpecifier = pathToFileURL(
      path.join(ROOT, resolvedSpecifier.slice(2))
    ).href;
  }

  // Step 2: Try adding .ts extension for extensionless imports
  // Only for file:// URLs or relative paths that don't already have an extension
  if (
    resolvedSpecifier.startsWith('file://') ||
    resolvedSpecifier.startsWith('./') ||
    resolvedSpecifier.startsWith('../')
  ) {
    let filePath;
    if (resolvedSpecifier.startsWith('file://')) {
      filePath = new URL(resolvedSpecifier).pathname;
    } else if (context.parentURL) {
      const parentDir = path.dirname(new URL(context.parentURL).pathname);
      filePath = path.resolve(parentDir, resolvedSpecifier);
    }

    if (filePath && !path.extname(filePath)) {
      for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const candidate = filePath + ext;
        if (existsSync(candidate)) {
          resolvedSpecifier = pathToFileURL(candidate).href;
          break;
        }
      }
    }
  }

  return next(resolvedSpecifier, context);
}
