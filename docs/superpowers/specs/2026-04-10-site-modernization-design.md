# Site Modernization — 2026 Best Practices

**Date**: 2026-04-10
**Scope**: johannes.nagl.name — static single-page personal portfolio on GitHub Pages

## Excluded from scope

- Content freshness (publications, skills, dates) — owner handles separately
- Twitter Card meta tags
- RSS/Atom feed
- `.well-known/` resources (security.txt etc.)

---

## 1. Image Optimization

**Problem**: Profile image is 878 KB at 2000x2000. No modern format, no size hints.

**Changes**:
- Resize `johannes-nagl.jpg` to 600px wide via `sips`
- Convert to AVIF via `sips` (native macOS support)
- Keep a 600px JPEG fallback
- Output files: `images/johannes-nagl-600.avif`, `images/johannes-nagl-600.jpg`
- Replace `<img>` with `<picture>` element:
  ```html
  <picture>
    <source srcset="images/johannes-nagl-600.avif" type="image/avif" />
    <img src="images/johannes-nagl-600.jpg" alt="Portrait of Johannes Nagl"
         width="600" height="600" fetchpriority="high" />
  </picture>
  ```
- Add `width`/`height` to prevent CLS

## 2. Meta & SEO

**Problem**: No OG tags, no canonical, weak title, empty manifest, no robots/sitemap/humans.

**Changes in `<head>`**:
- Title: `Johannes Nagl — CEO Product at Swat.io`
- `<link rel="canonical" href="https://johannes.nagl.name/" />`
- Open Graph tags:
  ```html
  <meta property="og:title" content="Johannes Nagl — CEO Product at Swat.io" />
  <meta property="og:description" content="..." />
  <meta property="og:image" content="https://johannes.nagl.name/images/johannes-nagl-600.jpg" />
  <meta property="og:url" content="https://johannes.nagl.name/" />
  <meta property="og:type" content="profile" />
  ```

**Profile image alt text**: Change `alt=""` to `alt="Portrait of Johannes Nagl"`

**`site.webmanifest`**:
- `"name": "Johannes Nagl"`, `"short_name": "J. Nagl"`

**New files**:
- `robots.txt`: Allow all, sitemap reference
- `sitemap.xml`: Single-URL sitemap with `lastmod`
- `humans.txt`: Credits

## 3. Structured Data (JSON-LD)

**Problem**: No machine-readable person data for search engines.

**Add to `<head>`**:
```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Johannes Nagl",
  "jobTitle": "CEO Product",
  "worksFor": { "@type": "Organization", "name": "Swat.io" },
  "url": "https://johannes.nagl.name",
  "sameAs": [
    "https://www.linkedin.com/in/johannes-nagl-social-media-management-experte/",
    "https://bsky.app/profile/johannes.nagl.name"
  ],
  "image": "https://johannes.nagl.name/images/johannes-nagl-600.jpg",
  "alumniOf": [
    { "@type": "CollegeOrUniversity", "name": "UAS Technikum Wien" }
  ]
}
```

## 4. Accessibility

**Problem**: No skip nav, no ARIA on icon links or custom element, no focus styles.

**Changes**:
- **Skip navigation**: Add visually-hidden link at top of `<body>` that jumps to `main` content. Becomes visible on `:focus`.
- **Icon links**: Add `aria-label` to each social/contact icon link (e.g., `aria-label="LinkedIn profile"`, `aria-label="Bluesky profile"`, `aria-label="Personal website"`)
- **`<time-duration>` custom element**: Set `aria-label` on the element after computing the duration text so screen readers announce it
- **Focus styles**: Add `:focus-visible` outline using accent color:
  ```css
  :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  ```

## 5. Security & Links

**Problem**: External links missing security attributes. PDF links give no user hint. No CSP. No HTTPS enforcement meta.

**Changes**:
- Add `rel="noopener noreferrer"` to all external `<a>` links (LinkedIn, Bluesky, personal site, external publications)
- Add `target="_blank"` to external links and PDF links
- Add `(PDF)` text indicator after publication PDF links
- Add to `<head>`:
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:" />
  <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests" />
  ```

## 6. Dark Mode Toggle

**Problem**: Dark mode is automatic-only via `prefers-color-scheme`. No user override.

**Implementation**:
- Small sun/moon toggle button, top-right corner, fixed position
- Inline `<script>` in `<head>` (before render) reads `localStorage.getItem('theme')` to prevent FOUC
- Sets `data-theme="light"` or `data-theme="dark"` on `<html>`
- CSS uses `[data-theme="dark"]` selector to override color variables (in addition to existing `prefers-color-scheme` fallback)
- Toggle button uses SVG icons, hidden in print
- Button has `aria-label="Toggle dark mode"`

## 7. Print Refinement

**Problem**: Print styles exist but are basic.

**Changes**:
- Hide: icon links SVGs, theme toggle, skip nav link
- Show URL after links: `a[href^="http"]::after { content: " (" attr(href) ")"; }`
- Suppress URL display for internal/anchor links
- Ensure black text on white background

## 8. SVG Favicon

**Problem**: No SVG favicon. Current favicons are raster-only.

**Changes**:
- Create `favicon.svg` — simple "JN" monogram or initial, with embedded `@media (prefers-color-scheme: dark)` for dark mode support
- Add `<link rel="icon" type="image/svg+xml" href="favicon.svg" />` to `<head>`
- Keep existing raster favicons as fallback

## 9. Content Security Policy

Covered in Section 5. Single meta tag approach since GitHub Pages doesn't support custom headers.

---

## Files Changed

| File | Action |
|------|--------|
| `index.html` | Major edits (meta, OG, JSON-LD, a11y, CSP, picture, toggle, print, favicon link) |
| `site.webmanifest` | Fill name/short_name |
| `images/johannes-nagl-600.avif` | New — optimized profile image |
| `images/johannes-nagl-600.jpg` | New — resized fallback |
| `favicon.svg` | New — SVG favicon with dark mode |
| `robots.txt` | New |
| `sitemap.xml` | New |
| `humans.txt` | New |

## Files NOT Changed

| File | Reason |
|------|--------|
| `images/johannes-nagl.jpg` | Keep original as source |
| `favicon.ico`, `*.png` favicons | Keep as raster fallbacks |
| `publications/*.pdf` | Content unchanged |
