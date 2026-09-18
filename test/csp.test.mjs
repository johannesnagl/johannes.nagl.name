// The CSP is hash-pinned, and this test is what keeps it pinned.
//
// `script-src 'unsafe-inline'` was the policy here until the hashes went in. A
// hash-pinned policy has one failure mode that a permissive one does not: edit
// an inline script by a single character and the page silently stops running
// it in production, because the hash no longer matches and nothing local said
// so. So the hashes are not written down twice — they are RECOMPUTED here from
// index.html and compared against the policy index.html ships. Editing a script
// without re-pinning fails this test rather than the live site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { html, inlineBlocks, svgStyleBlocks } from "./helpers/site.mjs";

const sha256 = (body) => `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;

function policy() {
  const tags = [...html().matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/g)];
  assert.equal(tags.length, 1, `expected exactly one CSP meta tag, found ${tags.length}`);
  const directives = new Map();
  for (const part of tags[0][1].split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) directives.set(name, values);
  }
  return directives;
}

test("script-src pins the hash of every inline script, and nothing else", () => {
  const expected = inlineBlocks("script").map((b) => sha256(b.body)).sort();
  const actual = policy().get("script-src") ?? [];
  assert.deepEqual(
    actual.filter((v) => v.startsWith("'sha256-")).sort(),
    expected,
    "index.html's inline scripts and the script-src hashes disagree. " +
      "Re-pin with: node scripts/csp-hashes.mjs",
  );
});

test("style-src pins the hash of every inline style, and nothing else", () => {
  // Including <style> inside referenced SVGs: those are governed by the PAGE's
  // style-src, and omitting them refused favicon.svg's stylesheet in WebKit
  // while the page itself rendered perfectly — a live defect visible only in
  // the console, and the reason this test does not stop at index.html.
  const expected = [
    ...new Set([...inlineBlocks("style"), ...svgStyleBlocks()].map((b) => sha256(b.body))),
  ].sort();
  const actual = policy().get("style-src") ?? [];
  assert.deepEqual(
    actual.filter((v) => v.startsWith("'sha256-")).sort(),
    expected,
    "the inline styles (index.html AND referenced SVGs) disagree with the " +
      "style-src hashes. Re-pin with: node scripts/csp-hashes.mjs --write",
  );
});

test("every referenced SVG's stylesheet is covered by style-src", () => {
  const pinned = policy().get("style-src") ?? [];
  for (const block of svgStyleBlocks()) {
    assert.ok(
      pinned.includes(sha256(block.body)),
      `${block.file} has a <style> block that style-src does not allow; ` +
        "WebKit will refuse it and the icon will stop adapting to the colour scheme",
    );
  }
});

test("no directive falls back to 'unsafe-inline' or 'unsafe-eval'", () => {
  for (const [name, values] of policy()) {
    for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'"]) {
      assert.ok(!values.includes(unsafe), `${name} contains ${unsafe}, which unpins the policy`);
    }
  }
});

test("the page carries no inline event handlers or style attributes", () => {
  // Either one needs 'unsafe-inline' (handlers) or 'unsafe-hashes' (styles) to
  // work under a pinned policy, so they must not creep back in.
  const handlers = [...html().matchAll(/\son[a-z]+\s*=/gi)].map((m) => m[0].trim());
  assert.deepEqual(handlers, [], `inline event handlers found: ${handlers.join(", ")}`);
  assert.equal((html().match(/\sstyle="/g) ?? []).length, 0, "inline style attributes found");
});

test("the policy sets the directives that have no sensible default", () => {
  // default-src does not cover these, so leaving them out leaves them open.
  for (const directive of ["default-src", "base-uri", "form-action", "object-src"]) {
    assert.ok(policy().has(directive), `CSP is missing ${directive}`);
  }
});
