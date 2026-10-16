
import fs from "node:fs/promises";
import path from "node:path";

const API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "GlobalViewNet/1.0 (website image library)";
const TARGET_COUNT = 40;
const ROTATE_COUNT = 10;
const ROTATION_DAY = new Date().getUTCDate() === 1;
const SEARCH_LIMIT = 100;

const CATEGORIES = {
  tech: "technology science artificial intelligence",
  business: "business office finance",
  culture: "culture art museum architecture",
  life: "lifestyle food travel nature",
};

const ROOT = "public/images/library";

function clean(value = "") {
  return value.replace(/<[^>]*>/g, "").trim();
}

function allowedLicense(license = "") {
  return /^(CC0|CC BY(?:-SA)?(?:\s|$)|Public domain)/i.test(
    license.trim()
  );
}

function extensionFromType(type = "") {
  if (type.includes("image/jpeg")) return ".jpg";
  if (type.includes("image/png")) return ".png";
  if (type.includes("image/webp")) return ".webp";
  return null;
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
  const dir = path.join(ROOT, category);
  await fs.mkdir(dir, { recursive: true });

  const manifest = path.join(dir, "sources.json");
  let records = [];

  try {
    const parsed = JSON.parse(await fs.readFile(manifest, "utf8"));
    if (Array.isArray(parsed)) records = parsed;
  } catch {
    records = [];
  }

  const files = new Set(await fs.readdir(dir));

  // 只统计图片文件确实存在的记录
  records = records.filter(
    item => item.filename && files.has(item.filename)
  );

  const knownSources = new Set(
    records.map(item => item.source).filter(Boolean)
  );

  let nextNumber = 1;

  for (const filename of files) {
    const match = filename.match(
      new RegExp(`^${category}-(\\d+)\\.`)
    );
    if (match) {
      nextNumber = Math.max(nextNumber, Number(match[1]) + 1);
    }
  }

  const desiredNewCount =
    Math.max(0, TARGET_COUNT - records.length) +
    (ROTATION_DAY
      ? Math.min(ROTATE_COUNT, records.length)
      : 0);

  const newRecords = [];

  if (desiredNewCount > 0) {
    const pages = await searchImages(searchTerm);

    for (const page of pages) {
      if (newRecords.length >= desiredNewCount) break;

      const info = page.imageinfo?.[0];
      if (!info) continue;

      const meta = info.extmetadata || {};
      const license = clean(meta.LicenseShortName?.value || "");

      if (!allowedLicense(license)) continue;

      const source = info.descriptionurl || "";
      if (!source || knownSources.has(source)) continue;

      const imageUrl = info.thumburl || info.url;
      if (!imageUrl) continue;

      try {
        const response = await fetch(imageUrl, {
          headers: { "User-Agent": USER_AGENT },
        });

        if (!response.ok) continue;

        const extension = extensionFromType(
          response.headers.get("content-type") || ""
        );

        if (!extension) continue;

        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length) continue;

        const filename = `${category}-${nextNumber}${extension}`;
        nextNumber++;

        await fs.writeFile(path.join(dir, filename), buffer);

        newRecords.push({
          filename,
          title: page.title || filename,
          source,
          author: clean(meta.Artist?.value || "Unknown"),
          license,
          licenseUrl: meta.LicenseUrl?.value || "",
        });

        knownSources.add(source);
      } catch (error) {
        console.warn("图片下载失败：", source, error.message);
      }
    }
  }

  // 只有新图下载成功后，才淘汰旧图
  const removeCount = ROTATION_DAY
    ? Math.min(
        ROTATE_COUNT,
        newRecords.length,
        Math.max(0, records.length + newRecords.length - TARGET_COUNT)
      )
    : 0;

  const removedRecords = records.slice(0, removeCount);
  const keptRecords = records.slice(removeCount);
  const finalRecords = [...keptRecords, ...newRecords];

  // 先更新来源清单，再删除已淘汰图片
  await fs.writeFile(
    manifest,
    JSON.stringify(finalRecords, null, 2) + "\n"
  );

  for (const item of removedRecords) {
    await fs.unlink(path.join(dir, item.filename)).catch(error => {
      console.warn("旧图片删除失败：", item.filename, error.message);
    });
  }

  console.log(
    `${category}: 当前 ${finalRecords.length} 张记录，` +
    `新增 ${newRecords.length} 张，淘汰 ${removeCount} 张。`
  );
}
