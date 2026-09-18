// EVERYTHING in this repository is a public URL.
//
// statichost.eu's builder clones the repo and publishes a directory; this site
// publishes the repository ROOT, with no build step. Verified against the live
// host: /CNAME, /robots.txt and every PDF answer 200, and only /.git is
// withheld. There is no ignore file and no Jekyll `exclude:` — an earlier
// version of this gate asserted a Jekyll exclude list and was guarding nothing,
// because Jekyll does not run here. That is the exact failure this file now
// exists to prevent, so it asserts only things that are true of THIS host.
//
// Two consequences, and both are gates below:
//   1. Adding a file to the repository publishes it. That is a decision, so the
//      inventory is reviewed rather than implicit.
//   2. A secret committed here is a secret served over HTTPS to anyone. There
//      is no private half of this repository to hide it in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allFiles, read } from "./helpers/site.mjs";

// Every path pattern that is knowingly published. Adding a file that matches
// nothing here fails this test: decide it is public, then add it.
const REVIEWED = [
  /^index\.html$/,
  /^(robots|humans|llms)\.txt$/,
  /^sitemap\.xml$/,
  /^site\.webmanifest$/,
  /^CNAME$/, // vestigial GitHub Pages artifact; harmless, see CLAUDE.md
  /^favicon\.(ico|svg)$/,
  /^favicon-\d+x\d+\.png$/,
  /^apple-touch-icon\.png$/,
  /^android-chrome-\d+x\d+\.png$/,
  /^images\/.+\.(avif|jpg|png)$/,
  /^publications\/\d{4}\/.+\.pdf$/,
  /^[0-9a-f]{32}\.txt$/, // the IndexNow key, which is public by design
  // Tooling. Published too, because this host publishes the root. Nothing here
  // is sensitive, and that is a property to keep rather than assume.
  /^CLAUDE\.md$/,
  /^package\.json$/,
  /^statichost\.yml$/,
  /^test\/.+\.mjs$/,
  /^scripts\/.+\.(sh|mjs)$/,
];

test("every file in the repository is a reviewed public file", () => {
  const unreviewed = allFiles().filter((f) => !REVIEWED.some((r) => r.test(f)));
  assert.deepEqual(
    unreviewed,
    [],
    "these files would be served at https://johannes.nagl.name/. Add them to " +
      `REVIEWED once you have decided they are public: ${unreviewed.join(", ")}`,
  );
});

// A deliberately small, dependency-free secret scan. It is not gitleaks, and it
// does not read git history — it reads the working tree, which is the thing
// that gets published. Anything it catches is already one commit from public.
const SECRET_SHAPES = [
  [/-----BEGIN (RSA|EC|OPENSSH|PGP|DSA)? ?PRIVATE KEY/, "a private key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key id"],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, "a GitHub token"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}\b/, "a Slack token"],
  [/\bsk-[A-Za-z0-9]{32,}\b/, "an API secret key"],
  [/\b(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*["'][^"'\s]{8,}["']/i, "an assigned secret"],
];

test("no published file carries anything secret-shaped", () => {
  const findings = [];
  for (const file of allFiles()) {
    if (!/\.(html|txt|xml|json|webmanifest|mjs|js|sh|yml|md)$/.test(file)) continue;
    const body = read(file);
    for (const [pattern, what] of SECRET_SHAPES) {
      // This file necessarily contains the patterns it searches for.
      if (file === "test/published-file-set.test.mjs") continue;
      if (pattern.test(body)) findings.push(`${file}: looks like ${what}`);
    }
  }
  assert.deepEqual(findings, [], `secret-shaped content in files that are served publicly:\n${findings.join("\n")}`);
});
