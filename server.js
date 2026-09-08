import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import { marked } from "marked";
import multer from "multer";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const inboxDirectory = path.join(__dirname, "private", "markdown-inbox");
const postsDirectory = path.join(__dirname, "posts");
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;

if (!adminPassword || !sessionSecret) {
  throw new Error("ADMIN_PASSWORD and SESSION_SECRET must be set in .env");
}

await fs.mkdir(inboxDirectory, { recursive: true });
await fs.mkdir(postsDirectory, { recursive: true });

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(
  session({
    name: "s4lm0n_admin",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, extension === ".md" || extension === ".markdown");
  },
});

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireAdmin(request, response, next) {
  if (request.session.isAdmin === true) {
    next();
    return;
  }

  response.status(401).json({ error: "Authentication required" });
}

function requireCsrf(request, response, next) {
  if (request.session.csrfToken && safeEqual(request.body?.csrfToken || "", request.session.csrfToken)) {
    next();
    return;
  }

  response.status(403).json({ error: "Invalid request token" });
}

function safeFilename(originalName) {
  const baseName = path.basename(originalName, path.extname(originalName));
  const normalized = baseName.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${timestamp}-${normalized || "note"}.md`;
}

function markdownFileName(fileName) {
  const safeName = path.basename(fileName);
  if (!safeName.endsWith(".md")) {
    throw new Error("Invalid Markdown filename");
  }
  return safeName;
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^\uFEFF?---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, "");
}

function frontmatterTitle(markdown) {
  const frontmatter = markdown.match(/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---/m)?.[1];
  return frontmatter?.match(/^title:\s*(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, "");
}

async function listMarkdownFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

function postTitle(markdown, fileName) {
  return frontmatterTitle(markdown) || markdown.match(/^#\s+(.+)$/m)?.[1].trim() || path.basename(fileName, ".md");
}

function postExcerpt(markdown) {
  const text = stripFrontmatter(markdown)
    .replace(/^```[\s\S]*?```/gm, "")
    .replace(/[#>*`_[\]-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 150 ? `${text.slice(0, 147)}...` : text;
}

function withTitle(markdown, title) {
  return `---\ntitle: ${title.replace(/[\r\n]/g, " ")}\n---\n\n${stripFrontmatter(markdown).trimStart()}`;
}

app.get("/admin", (_request, response) => {
  response.sendFile(path.join(__dirname, "admin.html"));
});

app.post("/api/admin/login", (request, response) => {
  const password = typeof request.body.password === "string" ? request.body.password : "";

  if (!safeEqual(password, adminPassword)) {
    response.status(401).json({ error: "Invalid password" });
    return;
  }

  request.session.regenerate((error) => {
    if (error) {
      response.status(500).json({ error: "Could not start session" });
      return;
    }

    request.session.isAdmin = true;
    request.session.csrfToken = crypto.randomBytes(32).toString("hex");
    response.json({ csrfToken: request.session.csrfToken });
  });
});

app.post("/api/admin/logout", requireAdmin, (request, response) => {
  request.session.destroy(() => response.status(204).end());
});

app.get("/api/admin/files", requireAdmin, async (_request, response) => {
  response.json({ files: await listMarkdownFiles(inboxDirectory) });
});

app.get("/api/admin/published", requireAdmin, async (_request, response) => {
  response.json({ files: await listMarkdownFiles(postsDirectory) });
});

app.get("/api/admin/preview/:source/:fileName", requireAdmin, async (request, response) => {
  const fileName = markdownFileName(request.params.fileName);
  const directory = request.params.source === "published" ? postsDirectory : inboxDirectory;

  try {
    const markdown = await fs.readFile(path.join(directory, fileName), "utf8");
    response.json({ fileName, title: postTitle(markdown, fileName), html: marked.parse(stripFrontmatter(markdown)) });
  } catch {
    response.status(404).json({ error: "Markdown file not found" });
  }
});

app.post("/api/admin/publish", requireAdmin, requireCsrf, async (request, response) => {
  try {
    const fileName = markdownFileName(request.body.fileName || "");
    await fs.rename(path.join(inboxDirectory, fileName), path.join(postsDirectory, fileName));
    response.status(201).json({ fileName });
  } catch {
    response.status(404).json({ error: "Draft not found" });
  }
});

app.post("/api/admin/unpublish", requireAdmin, requireCsrf, async (request, response) => {
  try {
    const fileName = markdownFileName(request.body.fileName || "");
    await fs.rename(path.join(postsDirectory, fileName), path.join(inboxDirectory, fileName));
    response.json({ fileName });
  } catch {
    response.status(404).json({ error: "Published post not found" });
  }
});

app.post("/api/admin/rename", requireAdmin, requireCsrf, async (request, response) => {
  const title = typeof request.body.title === "string" ? request.body.title.trim() : "";
  const directory = request.body.source === "published" ? postsDirectory : inboxDirectory;

  if (!title || title.length > 120) {
    response.status(400).json({ error: "Title must be between 1 and 120 characters" });
    return;
  }

  try {
    const fileName = markdownFileName(request.body.fileName || "");
    const filePath = path.join(directory, fileName);
    const markdown = await fs.readFile(filePath, "utf8");
    await fs.writeFile(filePath, withTitle(markdown, title));
    response.json({ fileName, title });
  } catch {
    response.status(404).json({ error: "Markdown file not found" });
  }
});

app.post("/api/admin/delete", requireAdmin, requireCsrf, async (request, response) => {
  try {
    const fileName = markdownFileName(request.body.fileName || "");
    const directory = request.body.source === "published" ? postsDirectory : inboxDirectory;
    await fs.unlink(path.join(directory, fileName));
    response.status(204).end();
  } catch {
    response.status(404).json({ error: "Markdown file not found" });
  }
});

app.post(
  "/api/admin/upload",
  requireAdmin,
  upload.single("markdown"),
  requireCsrf,
  async (request, response) => {
    if (!request.file) {
      response.status(400).json({ error: "Only Markdown files are accepted" });
      return;
    }

    const fileName = safeFilename(request.file.originalname);
    await fs.writeFile(path.join(inboxDirectory, fileName), request.file.buffer, { flag: "wx" });
    response.status(201).json({ fileName });
  },
);

app.get("/", (_request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/posts", async (_request, response) => {
  const files = await listMarkdownFiles(postsDirectory);
  const posts = await Promise.all(
    files.map(async (fileName) => {
      const markdown = await fs.readFile(path.join(postsDirectory, fileName), "utf8");
      const stats = await fs.stat(path.join(postsDirectory, fileName));
      return {
        fileName,
        title: postTitle(markdown, fileName),
        excerpt: postExcerpt(markdown),
        publishedAt: stats.mtime.toISOString(),
        url: `/post/${encodeURIComponent(fileName)}`,
      };
    }),
  );
  response.json({ posts });
});

app.get("/post/:fileName", async (request, response) => {
  try {
    const fileName = markdownFileName(request.params.fileName);
    const markdown = await fs.readFile(path.join(postsDirectory, fileName), "utf8");
    const title = postTitle(markdown, fileName);
    response.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} - s4lm0n</title><link rel="stylesheet" href="/style.css"><link rel="icon" href="/favicon.svg" type="image/svg+xml"></head><body><main class="article-page"><a class="article-back" href="/">&larr; Back to home</a><article class="article-content">${marked.parse(stripFrontmatter(markdown))}</article></main></body></html>`);
  } catch {
    response.status(404).send("Post not found");
  }
});

app.use(express.static(__dirname, { index: false }));

app.listen(port, () => {
  console.log(`s4lm0n blog running at http://localhost:${port}`);
  console.log(`Private Markdown inbox at http://localhost:${port}/admin`);
});