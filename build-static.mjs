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

function getPublishedAt(markdown, filePath) {
  const frontmatterDate = markdown.match(/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---/m)?.[1]
    ?.match(/^date:\s*(.+)$/m)?.[1].trim();
  return frontmatterDate ? new Date(frontmatterDate).toISOString() : fs.stat(filePath).then((stats) => stats.mtime.toISOString());
}

function getExcerpt(markdown) {
  const text = stripFrontmatter(markdown)
    .replace(/^```[\s\S]*?```/gm, "")
    .replace(/[#>*`_[\]-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 150 ? `${text.slice(0, 147)}...` : text;
}

async function listFiles(directory, relativeDirectory = "") {
  const entries = await fs.readdir(path.join(directory, relativeDirectory), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(directory, relativePath)));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

function articlePage(title, html, relativeDirectory) {
  const directoryDepth = relativeDirectory ? relativeDirectory.split(path.sep).length : 0;
  const rootPrefix = "../".repeat(directoryDepth + 1);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} - s4lm0n</title>
    <link rel="stylesheet" href="${rootPrefix}style.css" />
    <link rel="icon" href="${rootPrefix}favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <main class="article-page">
      <a class="article-back" href="${rootPrefix}">&larr; Back to home</a>
      <article class="article-content">${html}</article>
    </main>
  </body>
</html>`;
}

await fs.rm(outputDirectory, { recursive: true, force: true });
await fs.mkdir(path.join(outputDirectory, "posts"), { recursive: true });
await fs.copyFile(path.join(root, "index.html"), path.join(outputDirectory, "index.html"));
await fs.copyFile(path.join(root, "style.css"), path.join(outputDirectory, "style.css"));
await fs.copyFile(path.join(root, "spider.jpg"), path.join(outputDirectory, "spider.jpg"));
await fs.copyFile(path.join(root, "favicon.svg"), path.join(outputDirectory, "favicon.svg"));

const sourceFiles = await listFiles(sourceDirectory);
const posts = [];

for (const relativeFileName of sourceFiles.filter((fileName) => fileName.endsWith(".md"))) {
  const sourcePath = path.join(sourceDirectory, relativeFileName);
  const relativeDirectory = path.dirname(relativeFileName) === "." ? "" : path.dirname(relativeFileName);
  const markdown = await fs.readFile(sourcePath, "utf8");
  const title = getTitle(markdown, relativeFileName);
  const outputName = `${relativeFileName}.html`;
  const outputPath = path.join(outputDirectory, "posts", outputName);

  posts.push({
    fileName: relativeFileName,
    title,
    excerpt: getExcerpt(markdown),
    publishedAt: await getPublishedAt(markdown, sourcePath),
    url: `posts/${outputName.split(path.sep).map(encodeURIComponent).join("/")}`,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    articlePage(title, marked.parse(stripFrontmatter(markdown)), relativeDirectory),
  );
}

posts.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
const postsJson = JSON.stringify({ posts }, null, 2);
await fs.writeFile(path.join(outputDirectory, "posts.json"), postsJson);
await fs.writeFile(path.join(root, "posts.json"), postsJson);

for (const fileName of sourceFiles.filter((fileName) => !fileName.endsWith(".md") && !fileName.endsWith(".html"))) {
  const outputPath = path.join(outputDirectory, "posts", fileName);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.copyFile(path.join(sourceDirectory, fileName), outputPath);
}

for (const post of posts) {
  await fs.copyFile(
    path.join(outputDirectory, "posts", `${post.fileName}.html`),
    path.join(sourceDirectory, `${post.fileName}.html`),
  );
}

console.log(`Built ${posts.length} static post(s) into dist/`);