
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, "content", "posts");
const STATE_FILE = path.join(
  ROOT,
  ".github",
  "cms-newsletter-state.json"
);
const API_URL = "https://api.buttondown.com/v1/emails";
const SITE_URL = "https://globalviewnet.pages.dev";

const apiKey = process.env.BUTTONDOWN_API_KEY;

if (!apiKey) {
  throw new Error("Missing BUTTONDOWN_API_KEY");
}

function parseFrontmatter(markdown) {
  const match = markdown.match(
    /^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/
  );

  if (!match) return {};

  const fields = {};
  const lines = match[1].split(/\r?\n/);

  for (const line of lines) {
    const field = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!field) continue;

    let value = field[2].trim();

    if (value.startsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {}
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    fields[field[1]] = value;
  }

  return fields;
}

function isPublished(value) {
  return String(value).trim().toLowerCase() === "true";
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) return {};

  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

async function createDraft(subject, body, slug) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      subject,
      body,
      status: "draft",
      slug: `cms-${slug}`
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Buttondown API error ${response.status}: ${JSON.stringify(result)}`
    );
  }

  if (!result.id) {
    throw new Error("Buttondown did not return an email ID");
  }

  return result;
}

async function main() {
  const before = process.env.BEFORE_SHA;
  const after = process.env.AFTER_SHA;

  if (!before || !after || /^0+$/.test(before)) {
    throw new Error("Cannot determine changed CMS files safely");
  }

  const changedFiles = execFileSync(
    "git",
    ["diff", "--name-only", before, after, "--", "content/posts/"],
    { encoding: "utf8" }
  )
    .split(/\r?\n/)
    .filter(file => /^content\/posts\/.+\.md$/i.test(file));

  const state = readState();
  let created = 0;

  for (const relativeFile of changedFiles) {
    const fullPath = path.join(ROOT, relativeFile);

    // Deleted files do not create emails.
    if (!fs.existsSync(fullPath)) continue;

    const markdown = fs.readFileSync(fullPath, "utf8");
    const meta = parseFrontmatter(markdown);
    const slug = path.basename(relativeFile).replace(/\.md$/i, "");

    // Never process RSS items or unpublished CMS articles.
    if (!isPublished(meta.published)) continue;
    if (relativeFile.includes("/auto-news/")) continue;

    // Prevent duplicate drafts for the same CMS article.
    if (state[slug]) {
      console.log(`Already processed: ${slug}`);
      continue;
    }

    const titleZh = String(meta.title_zh || meta.title || slug);
    const titleEn = String(meta.title_en || meta.title || titleZh);
    const excerptZh = String(meta.excerpt_zh || meta.excerpt || "");
    const excerptEn = String(meta.excerpt_en || meta.excerpt || "");

    const urlZh = `${SITE_URL}/posts/${encodeURIComponent(slug)}`;
    const urlEn = `${urlZh}?lang=en`;

    const subject = `GlobalViewNet | ${titleZh}`;

    const body = [
      "# GlobalViewNet",
      "",
      "## 中文",
      "",
      `### ${titleZh}`,
      "",
      excerptZh,
      "",
      `[阅读全文](${urlZh})`,
      "",
      "---",
      "",
      "## English",
      "",
      `### ${titleEn}`,
      "",
      excerptEn,
      "",
      `[Read the full article](${urlEn})`,
      "",
      "---",
      "",
      "You're receiving this editorial highlight from GlobalViewNet.",
      ""
    ].join("\n");

    const email = await createDraft(subject, body, slug);

    state[slug] = {
      email_id: email.id,
      created_at: new Date().toISOString()
    };

    created++;
    console.log(`Draft created for ${slug}: ${email.id}`);
  }

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(state, null, 2) + "\n",
    "utf8"
  );

  console.log(`Finished. New drafts created: ${created}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
