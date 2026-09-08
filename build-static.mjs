import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { marked } from "marked";

const root = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.join(root, "posts");
const outputDirectory = path.join(root, "dist");

function stripFrontmatter(markdown) {
  return markdown.replace(/^\uFEFF?---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, "");
}

function getTitle(markdown, fileName) {
  const frontmatter = markdown.match(/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---/m)?.[1];
  return (
    frontmatter?.match(/^title:\s*(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, "") ||
    markdown.match(/^#\s+(.+)$/m)?.[1].trim() ||
    path.basename(fileName, ".md")
  );
}

function getExcerpt(markdown) {
  const text = stripFrontmatter(markdown)
    .replace(/^```[\s\S]*?```/gm, "")
    .replace(/[#>*`_[\]-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 150 ? `${text.slice(0, 147)}...` : text;
}

function articlePage(title, html) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} - s4lm0n</title>
    <link rel="stylesheet" href="../style.css" />
    <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <main class="article-page">
      <a class="article-back" href="../">&larr; Back to home</a>
      <article class="article-content">${html}</article>
    </main>
  </body>
</html>`;
}

await fs.rm(outputDirectory, { recursive: true, force: true });
await fs.mkdir(path.join(outputDirectory, "posts"), { recursive: true });
await fs.copyFile(path.join(root, "index.html"), path.join(outputDirectory, "index.html"));
await fs.copyFile(path.join(root, "style.css"), path.join(outputDirectory, "style.css"));
await fs.copyFile(path.join(root, "salmon-cartoon.svg"), path.join(outputDirectory, "salmon-cartoon.svg"));
await fs.copyFile(path.join(root, "favicon.svg"), path.join(outputDirectory, "favicon.svg"));

const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
const posts = [];

for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".md"))) {
  const markdown = await fs.readFile(path.join(sourceDirectory, entry.name), "utf8");
  const stats = await fs.stat(path.join(sourceDirectory, entry.name));
  const title = getTitle(markdown, entry.name);
  const outputName = `${entry.name}.html`;

  posts.push({
    fileName: entry.name,
    title,
    excerpt: getExcerpt(markdown),
    publishedAt: stats.mtime.toISOString(),
    url: `posts/${encodeURIComponent(outputName)}`,
  });

  await fs.writeFile(
    path.join(outputDirectory, "posts", outputName),
    articlePage(title, marked.parse(stripFrontmatter(markdown))),
  );
}

posts.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
const postsJson = JSON.stringify({ posts }, null, 2);
await fs.writeFile(path.join(outputDirectory, "posts.json"), postsJson);
await fs.writeFile(path.join(root, "posts.json"), postsJson);

for (const post of posts) {
  await fs.copyFile(
    path.join(outputDirectory, "posts", `${post.fileName}.html`),
    path.join(sourceDirectory, `${post.fileName}.html`),
  );
}

console.log(`Built ${posts.length} static post(s) into dist/`);