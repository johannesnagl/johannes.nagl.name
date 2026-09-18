// The IndexNow key is its own file NAME, and three places have to say the same
// thing: the key file at the site root, the submit script, and CLAUDE.md's
// worked example. Rotating the key means shipping a new file, and any of the
// other two left behind makes every submission 403 with nothing failing locally.
//
// The key file must also stay OUT of `_config.yml`'s exclude list, because a
// key the engines cannot fetch is a key that does not work.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allFiles, read } from "./helpers/site.mjs";

const keyFiles = allFiles().filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));

test("exactly one key file is published, at the site root", () => {
  assert.equal(keyFiles.length, 1, `expected one IndexNow key file at the root, found ${keyFiles.length}`);
});

test("the key file contains its own name, which is what the engines check", () => {
  const key = keyFiles[0].replace(/\.txt$/, "");
  assert.equal(read(keyFiles[0]).trim(), key);
});

test("the script and CLAUDE.md both carry the published key", () => {
  const key = keyFiles[0].replace(/\.txt$/, "");
  for (const path of ["scripts/indexnow.sh", "CLAUDE.md"]) {
    assert.ok(read(path).includes(key), `${path} does not carry the published key ${key}`);
  }
});

test("the script targets this host", () => {
  assert.match(read("scripts/indexnow.sh"), /^HOST="johannes\.nagl\.name"$/m);
});
