#!/usr/bin/env node
// Lint src/styles.css for invalid Tailwind v4 utility syntax.
// Catches issues that only surface during `vite build`, such as:
//   - `@utility name::after` or `@utility name:hover` (pseudo in the name)
//   - `@utility name with space` (non-token names)
//   - `@import "url(https://...)"` of a remote stylesheet (Lightning CSS can't fetch)
//   - `@tailwind base/components/utilities` (v3 directive, no-op in v4)
//   - `@utility` nested inside `@layer` / `@theme`

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), "src/styles.css");
const src = readFileSync(file, "utf8");
const lines = src.split(/\r?\n/);

const errors = [];
const push = (line, msg) => errors.push(`src/styles.css:${line}: ${msg}`);

// Track brace depth for @layer / @theme nesting detection.
const stack = []; // entries: { kind: 'layer'|'theme'|'other', depth }
let depth = 0;

const VALID_NAME = /^[a-z][a-z0-9-]*$/;

lines.forEach((raw, i) => {
  const lineNo = i + 1;
  const line = raw.replace(/\/\*.*?\*\//g, "");
  const trimmed = line.trim();

  // v3 directive check
  if (/^@tailwind\s+(base|components|utilities)\b/.test(trimmed)) {
    push(lineNo, `\`${trimmed}\` is a v3 directive; use \`@import "tailwindcss";\` instead.`);
  }

  // Remote @import
  const importMatch = trimmed.match(/^@import\s+["']([^"']+)["']/);
  if (importMatch && /^https?:\/\//.test(importMatch[1])) {
    push(
      lineNo,
      `remote \`@import "${importMatch[1]}"\` breaks Lightning CSS; load via <link> in __root.tsx.`,
    );
  }

  // @utility name validation
  const utilMatch = trimmed.match(/^@utility\s+([^\s{]+)/);
  if (utilMatch) {
    const name = utilMatch[1];
    if (name.includes("::") || name.includes(":")) {
      push(
        lineNo,
        `\`@utility ${name}\` has a pseudo-selector in the name; move it inside the body with \`&\`.`,
      );
    } else if (!VALID_NAME.test(name)) {
      push(
        lineNo,
        `\`@utility ${name}\` is invalid; names must be lowercase alphanumeric with hyphens.`,
      );
    }
    const insideBad = stack.find((s) => s.kind === "layer" || s.kind === "theme");
    if (insideBad) {
      push(lineNo, `\`@utility\` cannot be nested inside \`@${insideBad.kind}\`.`);
    }
  }

  // Track @layer / @theme blocks (naive but sufficient for our styles.css)
  const atBlock = trimmed.match(/^@(layer|theme)\b/);
  const opensBrace = /\{\s*$/.test(trimmed);
  if (atBlock && opensBrace) {
    stack.push({ kind: atBlock[1], openedAt: depth });
    depth++;
    return;
  }

  // Count braces to maintain depth
  for (const ch of line) {
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (stack.length && stack[stack.length - 1].openedAt === depth) {
        stack.pop();
      }
    }
  }
});

if (errors.length) {
  console.error("styles.css lint failed:\n" + errors.map((e) => "  " + e).join("\n"));
  process.exit(1);
}
console.log("styles.css lint passed.");
