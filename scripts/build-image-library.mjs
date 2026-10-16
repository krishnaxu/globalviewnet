
import fs from "node:fs/promises";
import path from "node:path";

const API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "GlobalViewNet/1.0 (website image library)";
const TARGET_COUNT = 40;
const SEARCH_LIMIT = 100;

const CATEGORIES = {
  tech: "technology science artificial intelligence",
  business: "business office finance",
  culture: "culture art museum architecture",
  life: "lifestyle food travel nature",
};

const ROOT = "public/images/library";

function escapeHtml(value = "") {
  return value.replace(/<[^>]*>/g, "").trim();
}

function extensionFromType(contentType = "") {
  if (contentType.includes("image/jpeg")) return ".jpg";
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/webp")) return ".webp";
  return null;
}

function allowedLicense(license = "") {
  return /^(CC0|CC BY(?:-SA)?(?:\s|$)|Public domain)/i.test(
    license.trim()
  );
}

async function searchImages(searchTerm) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: searchTerm,
    gsrnamespace: "6",
    gsrlimit: String(SEARCH_LIMIT),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200",
    format: "json",
    origin: "*",
  });

  const response = await fetch(`${API}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Wikimedia API 错误：${response.status}`);
  }

  const data = await response.json();
  return Object.values(data.query?.pages || {});
}

for (const [category, searchTerm] of Object.entries(CATEGORIES)) {
  const outputDir = path.join(ROOT, category);
  await fs.mkdir(outputDir, { recursive: true });

  const manifestPath = path.join(outputDir, "sources.json");
  let records = [];

  try {
    records = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (!Array.isArray(records)) records = [];
  } catch {
    records = [];
  }

  const existingFiles = new Set(
    await fs.readdir(outputDir).catch(() => [])
  );

  const knownSources = new Set(
    records.map(record => record.source).filter(Boolean)
  );

  let nextNumber = 1;
  for (const filename of existingFiles) {
    const match = filename.match(
      new RegExp(`^${category}-(\\d+)\\.`)
    );
    if (match) nextNumber = Math.max(nextNumber, Number(match[1]) + 1);
  }

  let added = 0;

  if (records.length < TARGET_COUNT) {
    const pages = await searchImages(searchTerm);

    for (const page of pages) {
      if (records.length >= TARGET_COUNT) break;

      const info = page.imageinfo?.[0];
      if (!info) continue;

      const meta = info.extmetadata || {};
      const license = escapeHtml(meta.LicenseShortName?.value || "");

      if (!allowedLicense(license)) continue;

      const source = info.descriptionurl || "";
      if (!source || knownSources.has(source)) continue;

      const imageUrl = info.thumburl || info.url;
      if (!imageUrl) continue;

      try {
        const imageResponse = await fetch(imageUrl, {
          headers: { "User-Agent": USER_AGENT },
        });

        if (!imageResponse.ok) continue;

        const contentType =
          imageResponse.headers.get("content-type") || "";
        const extension = extensionFromType(contentType);
        if (!extension) continue;

        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        if (buffer.length === 0) continue;

        const filename = `${category}-${nextNumber}${extension}`;
        nextNumber++;

        await fs.writeFile(path.join(outputDir, filename), buffer);

        records.push({
          filename,
          title: page.title || filename,
          source,
          author: escapeHtml(meta.Artist?.value || "Unknown"),
          license,
          licenseUrl: meta.LicenseUrl?.value || "",
        });

        knownSources.add(source);
        added++;
      } catch (error) {
        console.warn("图片下载失败：", source, error.message);
      }
    }
  }

  await fs.writeFile(
    manifestPath,
    JSON.stringify(records, null, 2) + "\n"
  );

  console.log(
    `${category}: 当前 ${records.length} 条来源记录，本次新增 ${added} 张图片。`
  );
}
