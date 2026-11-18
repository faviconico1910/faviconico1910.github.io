# Security Review Summary

Date: 2026-11-18

## Findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟠 HIGH | `server.js` | 17, 292 | Private Markdown inbox can be exposed by the broad Express static middleware | 10/10 |
| 2 | 🟠 HIGH | `admin.html`; `server.js`; `build-static.mjs` | `admin.html:153`; `server.js:185,286`; `build-static.mjs:63,105` | Unsanitized Markdown and title HTML can cause stored XSS | 9/10 |

## 1. Private inbox exposed by static middleware

`inboxDirectory` points to `private/markdown-inbox`, but `express.static(__dirname)` serves the entire repository root, including private files. Git ignores this directory, and `.gitignore` prevents it from being committed, but a guessed or discovered local URL could still be served by the Node server.

Recommended mitigation:

- Move private storage outside the static root.
- Serve assets only from a dedicated public directory.
- As defense in depth, reject `/private/` and `/private/markdown-inbox/` before static middleware.

## 2. Unsanitized Markdown and title HTML

Markdown is converted with `marked.parse()` and inserted into `innerHTML` or generated HTML without sanitization. Frontmatter titles are also inserted directly into `<title>` elements. An uploaded Markdown file containing raw HTML or crafted title content could cause script execution in the admin preview or a published article.

Recommended mitigation:

- Add an HTML sanitizer and configure a strict allowlist.
- Remove scripts, event handlers, unsafe URL schemes, and active elements.
- HTML-escape title and frontmatter data before inserting it into templates.
- Add a restrictive Content Security Policy to the Node and static page responses.

## Deployment and exposure assessment

- The public GitHub Pages deployment is generated from `posts/` by `build-static.mjs`.
- The GitHub Pages workflow deploys only the `dist/` directory.
- `/admin`, `/api/admin/*`, and the private inbox are Express server features, not part of the GitHub Pages static artifact.
- No real secret or credential was found in the reviewed source or workflow.
- `.env` and `private/markdown-inbox/` are listed in `.gitignore`.
- The session configuration uses `httpOnly`, `sameSite=Strict`, CSRF tokens for state-changing admin actions, and timing-safe password comparison.
- No public third-party JavaScript, public API, form, redirect, or iframe was found.
- GitHub Actions uses official checkout, Node setup, Pages artifact, and Pages deploy actions.

This review is read-only with respect to application behavior. Only this review report should be included in the commit.
