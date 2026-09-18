// Every local reference resolves, and every shipped file is reachable.
//
// The second half is the half that earned this file: `publications/2005/` once
// carried two PDFs that were byte-identical copies of the 2007 ones and that
// nothing had linked to for years. Nothing was broken, so nothing complained.
// An orphan check is the only thing that notices a file the site stopped using.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allFiles, exists, isTooling, localRefs, read } from "./helpers/site.mjs";

// Files the site serves without index.html naming them: crawler and platform
// conventions fetched by path, and the icons iOS and browsers probe for at the
// root by name rather than by <link>.
const SERVED_BY_CONVENTION = new Set([
  "index.html",
  "CNAME",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "humans.txt",
  "site.webmanifest",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
]);

const INDEXNOW_KEY_FILE = /^[0-9a-f]{32}\.txt$/;

test("every local href/src in index.html resolves to a file", () => {
  const missing = localRefs().filter((ref) => !exists(ref));
  assert.deepEqual(missing, [], `index.html points at files that do not exist: ${missing.join(", ")}`);
});

test("every icon the manifest declares exists", () => {
  const { icons = [] } = JSON.parse(read("site.webmanifest"));
  assert.ok(icons.length > 0, "site.webmanifest declares no icons");
  const missing = icons.map((i) => i.src.replace(/^\//, "")).filter((src) => !exists(src));
  assert.deepEqual(missing, [], `site.webmanifest names icons that do not exist: ${missing.join(", ")}`);
});

test("every shipped file is referenced, or served by convention", () => {
  const referenced = new Set(localRefs());
  for (const icon of JSON.parse(read("site.webmanifest")).icons ?? []) {
    referenced.add(icon.src.replace(/^\//, ""));
  }

  const orphans = allFiles().filter(
    (f) =>
      !referenced.has(f) &&
      !SERVED_BY_CONVENTION.has(f) &&
      !isTooling(f) &&
      !INDEXNOW_KEY_FILE.test(f),
  );
  assert.deepEqual(
    orphans,
    [],
    "files ship but nothing links to them. Delete them, or add them to " +
      `SERVED_BY_CONVENTION with the reason: ${orphans.join(", ")}`,
  );
});
