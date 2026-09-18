// The structured data, the canonical URL and the sitemap all describe the same
// site. Each of these fails silently in production: a malformed JSON-LD block
// is simply ignored by search engines, and a stale sitemap is believed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HOST, allFiles, html, read } from "./helpers/site.mjs";

const ORIGIN = `https://${HOST}`;

const jsonLd = () => {
  const blocks = [...html().matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1, `expected exactly one JSON-LD block, found ${blocks.length}`);
  return JSON.parse(blocks[0][1]); // throws, and a throw is the failure
};

test("the JSON-LD block is valid JSON and describes a Person", () => {
  const data = jsonLd();
  assert.equal(data["@context"], "https://schema.org");
  assert.equal(data["@type"], "Person");
  for (const field of ["name", "jobTitle", "url", "image", "sameAs"]) {
    assert.ok(data[field], `JSON-LD is missing ${field}`);
  }
});

test("every absolute self-reference uses the canonical origin", () => {
  const data = jsonLd();
  const selfRefs = [data.url, data.image, ...[...html().matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]), ...[...html().matchAll(/<meta property="og:(?:url|image)" content="([^"]+)"/g)].map((m) => m[1])];
  for (const ref of selfRefs) {
    assert.ok(ref.startsWith(ORIGIN), `${ref} does not start with ${ORIGIN}`);
  }
});

test("sameAs entries are absolute https URLs", () => {
  for (const url of jsonLd().sameAs) {
    assert.match(url, /^https:\/\//, `sameAs entry is not an https URL: ${url}`);
  }
});

test("the page declares a title, description and canonical", () => {
  for (const [what, pattern] of [
    ["title", /<title>[^<]{10,}<\/title>/],
    ["meta description", /<meta name="description" content="[^"]{50,}"/],
    ["canonical", /<link rel="canonical" href="[^"]+"/],
    ["lang", /<html lang="[a-z]{2}"/],
  ]) {
    assert.match(html(), pattern, `index.html is missing a usable ${what}`);
  }
});

test("the sitemap lists exactly the HTML pages the site publishes", () => {
  const listed = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const published = allFiles()
    .filter((f) => f.endsWith(".html"))
    .map((f) => `${ORIGIN}/${f === "index.html" ? "" : f}`);
  assert.deepEqual(listed.sort(), published.sort(), "sitemap.xml and the published pages disagree");
});

test("every sitemap lastmod is a real date, and not in the future", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const m of read("sitemap.xml").matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
    assert.match(m[1], /^\d{4}-\d{2}-\d{2}$/, `lastmod is not YYYY-MM-DD: ${m[1]}`);
    assert.ok(!Number.isNaN(Date.parse(m[1])), `lastmod is not a real date: ${m[1]}`);
    assert.ok(m[1] <= today, `lastmod is in the future: ${m[1]}`);
  }
});

test("robots.txt points at the sitemap on this host", () => {
  assert.match(read("robots.txt"), new RegExp(`Sitemap:\\s*${ORIGIN}/sitemap\\.xml`));
});

test("CNAME and the canonical origin agree", () => {
  assert.equal(read("CNAME").trim(), HOST);
});
