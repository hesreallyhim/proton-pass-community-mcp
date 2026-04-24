// fast-check-based property test (doubles as scorecard's Fuzzing signal for JS/TS).
//
// Scorecard's Fuzzing check matches JS/TS via an import of `fast-check`
// (or `@fast-check/ava`, `@fast-check/jest`, `@fast-check/vitest`) in any
// `*.js | *.jsx | *.ts | *.tsx` file (see `checks/raw/fuzzing.go`
// `languageFuzzSpecs` entry for JavaScript/TypeScript). The two import
// lines below are therefore load-bearing - do not remove them, do not
// rewrite them as dynamic `await import()`, and do not alias the module
// to a different name. Keep the string literal `'fast-check'` intact.
//
// Install and run locally (Vitest):
//
//     npm install --save-dev fast-check vitest
//     npx vitest run
//
// This file is written for Vitest but works unchanged under Jest if you
// swap the `import { describe, test } from 'vitest'` line for Jest's
// globals. For Ava / Jest-specific bindings, use `@fast-check/ava` or
// `@fast-check/jest` instead - both also satisfy the scorecard regex.

import * as fc from "fast-check";
import { describe, test } from "vitest";

// Placeholder parser. Replace with a call into your real package.
function parseInput(raw: string): string | null {
  if (raw.length === 0) return null;
  return raw.toUpperCase();
}

describe("fuzz: parseInput", () => {
  test("never throws on arbitrary string input", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = parseInput(input);
        // Invariant: if the parser accepts the input, result is a string.
        if (result !== null && typeof result !== "string") {
          throw new Error(`parseInput returned non-string: ${typeof result}`);
        }
      }),
      { numRuns: 1000 },
    );
  });

  test("never throws on arbitrary byte-like input", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 4096 }), (bytes) => {
        const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        parseInput(decoded);
      }),
      { numRuns: 1000 },
    );
  });
});
