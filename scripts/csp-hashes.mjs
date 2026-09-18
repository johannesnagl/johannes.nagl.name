#!/usr/bin/env node
// Re-pin the CSP after editing an inline <script> or <style> in index.html.
//
// Run it with no arguments to PRINT what the policy should be; run it with
// --write to replace the meta tag in place. `npm test` compares the shipped
// policy against a fresh computation, so forgetting this step fails the gate
// rather than the live site.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const PATH = new URL("../index.html", import.meta.url);
const source = readFileSync(PATH, "utf8");

const hashes = (tag) =>
  [...source.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))]
    .map((m) => `'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`)
    .join(" ");

// frame-ancestors, report-uri and sandbox are IGNORED in a <meta> policy, and
// GitHub Pages serves no custom headers, so they are deliberately absent rather
// than present and inert.
const policy = [
  "default-src 'self'",
  `script-src ${hashes("script")}`,
  `style-src ${hashes("style")}`,
  "img-src 'self' data:",
  "font-src 'self'",
  // 'self', not 'none': the page itself fetches nothing, but a same-origin
  // fetch of /robots.txt is how auditing tools (Lighthouse's SEO check among
  // them) read it, and 'none' blocks that from inside the page — which reads
  // as a malformed robots.txt rather than as a policy problem.
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const tag = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`;

if (!process.argv.includes("--write")) {
  console.log(tag);
  process.exit(0);
}

const existing = /^[ \t]*<meta http-equiv="Content-Security-Policy"[^>]*\/>\n?/gm;
const found = source.match(existing) ?? [];
if (found.length === 0) {
  console.error("no CSP meta tag found in index.html; add one, then re-run");
  process.exit(1);
}
// Collapse however many CSP tags exist into one: browsers enforce multiple
// policies as an INTERSECTION, which makes a second tag a silent tightening
// nobody reads as one.
const indent = found[0].match(/^[ \t]*/)[0];
let seen = false;
const next = source.replace(existing, () => (seen ? "" : ((seen = true), `${indent}${tag}\n`)));
writeFileSync(PATH, next);
console.error(`re-pinned CSP (replaced ${found.length} tag${found.length === 1 ? "" : "s"})`);
