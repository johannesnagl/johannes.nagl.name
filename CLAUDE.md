# johannes.nagl.name

A one-page personal site: a single hand-written `index.html` with its CSS and JS
inline, a few images, a handful of PDFs, and the crawler files. **There is no
build.** `index.html` is the deploy artifact, served as-is.

Hosting is **statichost.eu**, not GitHub Pages. Their builder clones the
repository and publishes a directory; this site publishes the repository ROOT
with no build step, configured in their dashboard rather than by a
`statichost.yml` in the repo. With automatic deployments enabled, **a push to
`main` is a production deploy**, and the gate below is the only thing between a
commit and a visitor.

Two leftovers from a previous setup, both harmless and both worth knowing:
`CNAME` is a GitHub Pages artifact that statichost.eu ignores, and the repo's
GitHub Pages config is still enabled — `https://johannesnagl.github.io/johannes.nagl.name/`
answers 200 with a copy of this site. That is duplicate content pointing at no
canonical; turning Pages off in repository settings is the fix.

## Before you commit or push

Run this, in this order, and make it pass:

```bash
node --test test/*.test.mjs
```

That is the whole local gate, and CI runs the same command plus Lighthouse. Note that GitHub Actions is a
pre-push signal only — it does not deploy anything; statichost.eu does. If
you changed an inline `<script>` or `<style>`, re-pin the CSP first:

```bash
node scripts/csp-hashes.mjs --write
```

### Why there are no dependencies

This repository has no `node_modules` and no lockfile, and that is a decision
rather than an omission. Every gate is `node:test` plus `node:fs`. The
accessibility and performance checks that genuinely need a browser run in CI
against a pinned action, so Chrome is never a dependency of this repository.

A static CV site that pulled in a headless browser to check itself would carry a
larger supply-chain surface than everything that surface is guarding. If you add
a dependency, you are also adding `npm audit` to the gate and a lockfile to
review — decide that on purpose.

### Prove a new gate before you trust it

A gate that cannot fail is worse than no gate, because it reads as coverage.
Every check in `test/` was watched failing on a real defect before it was
committed. Do the same for the next one: break the thing on purpose, watch the
test go red, then fix it.

## What each gate guards

| Gate | What it catches |
|---|---|
| `test/links-and-assets.test.mjs` | A local `href`/`src` pointing at nothing, and — the half that earned its keep — a file that ships while nothing links to it. |
| `test/metadata.test.mjs` | Malformed JSON-LD, a self-reference on the wrong origin, a sitemap that disagrees with the published pages, a `lastmod` that is not a real past date. All of these fail *silently* in production: search engines ignore broken structured data and believe a stale sitemap. |
| `test/csp.test.mjs` | An inline script edited without re-pinning its hash. See below. |
| `test/published-file-set.test.mjs` | A tooling file that would become a public URL on the site. |
| `test/indexnow-key.test.mjs` | The IndexNow key disagreeing between the key file, the script and this document. |

## The CSP is hash-pinned

`index.html` ships one `Content-Security-Policy` meta tag with a SHA-256 hash
per inline block. It used to ship `script-src 'unsafe-inline'` across two
separate meta tags.

Pinning has one failure mode a permissive policy does not: **edit an inline
script by a single character and the browser silently stops running it**, with
nothing local to say so. That is why `test/csp.test.mjs` does not store the
hashes a second time — it recomputes them from `index.html` and compares them to
the shipped policy. Forgetting to re-pin fails the gate instead of the site.

### "Refused to apply a stylesheet" is usually a browser extension

A hash-pinned `style-src` refuses CSS that content blockers inject, and Safari
reports it against the PAGE — `(johannes.nagl.name, line 1, x2)` — which reads
exactly like a defect in this repository. It is not. The giveaway is other
console lines from the same extension: a message from `autoconsent.js` (the
cookie-banner auto-dismisser in DuckDuckGo Privacy Essentials, Ghostery and
others) cannot possibly come from this site, because `script-src` is pinned to
three inline hashes with no `'self'` and no external origin. The page is
incapable of loading an external script.

Before believing such a report, check whether the page's OWN stylesheet applied:

```js
getComputedStyle(document.body).display   // "grid" = fine, "block" = really broken
```

`"grid"` means the policy is working as designed and the noise belongs to the
viewer's browser. Do not loosen the policy to silence it: `'unsafe-inline'` is
ignored whenever hashes are present, so the only way to stop the message is to
un-pin the policy entirely, which trades a real protection for a quieter
console in one person's browser.

### style-src also covers SVGs the page references

`favicon.svg` contains a `<style>` block, and a `<style>` inside an SVG the page
references is governed by **this page's** `style-src`, not by the SVG's own.
WebKit enforces that for SVGs loaded as images and icons. The first pinned
policy covered only `index.html`, so the browser refused the icon's stylesheet:
the page rendered perfectly, the only symptom was a console line ("Refused to
apply a stylesheet...") and a favicon that had quietly stopped following
`prefers-color-scheme`.

`scripts/csp-hashes.mjs` now walks every local `.svg` the page references and
hashes its `<style>` blocks too, and `test/csp.test.mjs` asserts each one is
covered. Edit `favicon.svg`'s CSS and the gate fails until you re-pin.

`frame-ancestors`, `report-uri` and `sandbox` are ignored in a `<meta>` policy,
so they are deliberately absent here rather than present and inert. They are not
impossible, though: statichost.eu's edge already sends
`strict-transport-security` (with `preload`) and `x-content-type-options`, so
`frame-ancestors` belongs in the host's header configuration, not in this file.

## Everything in this repository is a public URL

The host publishes the repository root as-is. Verified against the live site:
`/CNAME`, `/robots.txt` and every PDF answer 200, and only `/.git` is withheld.
There is no ignore file and no build step filtering anything out, so
`CLAUDE.md`, `package.json`, `test/` and `scripts/` are all served too.

This was originally written here as a Jekyll `exclude:` list in `_config.yml`,
on the assumption that the host was GitHub Pages. It was not, Jekyll never ran,
and the test asserting that list passed while guarding **nothing** — a green
gate over an imaginary protection, which is the precise failure this repository
is supposed to catch. The file is gone.

`test/published-file-set.test.mjs` now asserts two things that are actually true
here: every file matches a reviewed "yes, this is public" pattern, and no file
carries secret-shaped content. There is no private half of this repository to
put a secret in.

If you ever want tooling off the public site, the fix is a `statichost.yml` with
a build step that assembles a `dist/` and `public: dist` — a deliberate change
to how the site deploys, not a config tweak.

## Search engines: IndexNow

After a change to the page SET or the WORDS, push exactly those URLs:

```bash
./scripts/indexnow.sh /
```

**Not** for styling, an interaction, an image recompression or a Lighthouse fix.
The engines rate-limit the host, and a ping for a page that reads exactly as it
did teaches them this host's pings are noise. Most commits here should not run
this script. `202` is not `200` — it means the key is not validated yet, so
check the key file is reachable and submit again in a few minutes.

The key is `fcec64544715f6fdc6b054e56539a89a`, and it lives in three places that
have to agree: the file `fcec64544715f6fdc6b054e56539a89a.txt` at the site root,
`scripts/indexnow.sh`, and this paragraph. Rotating it means changing all three;
the gate will tell you if you missed one.

## The sitemap records content changes, not deploys

`lastmod` is the date the page's WORDS last changed — the same test the IndexNow
rule applies. A contrast fix, a CLS fix or a recompressed image does not move
it. This has already been misread once: the four commits after `f2082b9` all
looked like drift and were not.

`sitemap.xml` lists HTML pages only. `llms.txt`, `robots.txt` and `humans.txt`
are conventions fetched by path, not pages, and the gate asserts the sitemap
matches exactly the published `.html` files.

## Accessibility and performance are gates, not polish

CI runs Lighthouse (`.github/lighthouserc.json`) and fails the build below its
thresholds for accessibility, performance, best practices and SEO, plus an
explicit CLS budget. Every one of those categories was fixed reactively at least
once — `de98985`, `027f237`, `4828d33`, `356c236` are all post-hoc Lighthouse
repairs. The budget exists so the next regression fails in a pull request
instead of on the live site.

Verify layout at roughly 375 / 768 / 1280 when changing anything structural.

### A category score of 1.00 is not a clean page

Lighthouse weights some axe audits at **zero**, so an audit can score 0 while
its category still reads a perfect 1.00. That is not hypothetical here: the
first calibration run scored accessibility 1.00 with
`label-content-name-mismatch` at 0, on four links whose `aria-label` did not
contain their own visible text. Speech-input users could see "yetanother.one"
and say it, and nothing would match, because the accessible name was "Yet
another one" (WCAG 2.5.3, Label in Name).

The budget therefore asserts those audits **by name** as well as by category. If
you add an `aria-label` to something with visible text, the label has to contain
that text.

### connect-src is 'self', not 'none'

The page fetches nothing, so `'none'` looks right and is not. Lighthouse reads
`/robots.txt` with a same-origin `fetch()` from inside the page; `'none'` blocks
it, and the SEO audit then reports "robots.txt is not valid" — a policy problem
wearing the costume of a content problem. It cost one calibration round to find.
The generator in `scripts/csp-hashes.mjs` carries the reason inline.

## Content

The page is English-only by design, and there is no analytics and no cookie of
any kind beyond the `theme` key in `localStorage`. Keep it that way unless you
are deciding otherwise on purpose.
