// Shared readers for the gates. Everything here is dependency-free on purpose:
// see CLAUDE.md -> "The gate" for why this repository has no lockfile.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const HOST = "johannes.nagl.name";

export const read = (path) => readFileSync(join(ROOT, path), "utf8");

export const html = () => read("index.html");

/** Every file in the repository, repo-relative, excluding dotfiles and node_modules. */
export function allFiles(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) allFiles(full, out);
    else out.push(relative(ROOT, full));
  }
  return out;
}

export const exists = (repoPath) => {
  try {
    return statSync(join(ROOT, repoPath)).isFile();
  } catch {
    return false;
  }
};

/** Local (same-origin) references made by index.html, as repo-relative paths. */
export function localRefs() {
  const source = html();
  const refs = new Set();
  for (const m of source.matchAll(/(?:href|src)="([^"]+)"/g)) refs.add(m[1]);
  for (const m of source.matchAll(/srcset="([^"]+)"/g)) {
    // srcset is a comma-separated list of "url descriptor" pairs.
    for (const candidate of m[1].split(",")) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) refs.add(url);
    }
  }
  return [...refs]
    .filter((r) => r.startsWith("/"))
    // Strip query and fragment: `/#anchor` is this page, not a missing file.
    .map((r) => decodeURIComponent(r.split(/[?#]/)[0].replace(/^\//, "")))
    .filter(Boolean)
    .map((r) => (r.endsWith("/") ? `${r}index.html` : r));
}

/** Contents of each inline <script>/<style>, exactly as CSP hashes them. */
export function inlineBlocks(tag) {
  const pattern = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, "g");
  return [...html().matchAll(pattern)].map((m) => ({ attrs: m[1], body: m[2] }));
}

/**
 * A path is TOOLING if it exists to build or check the site rather than to be
 * served by it. Two gates need this answer — the orphan check (tooling is not
 * an orphan) and the published-file-set check (tooling must be excluded from
 * the site) — and they disagreed the first time they each defined it. One
 * definition, used by both.
 */
export const isTooling = (path) =>
  [/^test\//, /^scripts\//, /^package(-lock)?\.json$/, /^CLAUDE\.md$/, /^node_modules\//].some((r) =>
    r.test(path),
  );

/**
 * `<style>` bodies inside same-origin SVG assets the page references.
 *
 * These are subject to the PAGE's `style-src`, not the SVG's own — WebKit
 * enforces this for SVGs loaded as images and icons, and a hash-pinned policy
 * that only covers index.html refuses them. The symptom is a console error
 * ("Refused to apply a stylesheet...") and a favicon that stops following
 * prefers-color-scheme, with the page itself looking perfectly fine.
 */
export function svgStyleBlocks() {
  const out = [];
  for (const ref of localRefs()) {
    if (!ref.endsWith(".svg") || !exists(ref)) continue;
    for (const m of read(ref).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
      out.push({ file: ref, body: m[1] });
    }
  }
  return out;
}
