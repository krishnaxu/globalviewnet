import fs from "node:fs/promises";
import path from "node:path";

const API = "https://commons.wikimedia.org/w/api.php";
const OUT = "public/images/library/life";
const USER_AGENT = "GlobalViewNet/1.0 (website image library)";

const params = new URLSearchParams({
  action: "query",
  generator: "search",
 gsrsearch: "lifestyle",
  gsrnamespace: "6",
  gsrlimit: "20",
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
const pages = Object.values(data.query?.pages || {});

await fs.mkdir(OUT, { recursive: true });

const records = [];

for (const page of pages) {
  if (records.length >= 2) break;

  const info = page.imageinfo?.[0];
  if (!info) continue;

  const meta = info.extmetadata || {};
  const license = meta.LicenseShortName?.value || "";

  if (!/^(CC0|CC BY(?:-SA)?(?:\s|$)|Public domain)/i.test(license)) {
    continue;
  }

  const imageUrl = info.thumburl || info.url;
  if (!imageUrl) continue;

  const imageResponse = await fetch(imageUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!imageResponse.ok) continue;

  const contentType =
    imageResponse.headers.get("content-type") || "";

  let extension;

  if (contentType.includes("image/jpeg")) extension = ".jpg";
  else if (contentType.includes("image/png")) extension = ".png";
  else if (contentType.includes("image/webp")) extension = ".webp";
  else if (contentType.includes("image/avif")) extension = ".avif";
  else continue;

  const filename = `life-${records.length + 1}${extension}`;
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  if (buffer.length === 0) continue;

  await fs.writeFile(path.join(OUT, filename), buffer);

  records.push({
    filename,
    title: page.title,
    source: info.descriptionurl,
    author: meta.Artist?.value || "Unknown",
    license,
    licenseUrl: meta.LicenseUrl?.value || "",
  });
}

if (records.length === 0) {
  throw new Error("没有找到符合条件的图片，请检查运行日志。");
}

await fs.writeFile(
  path.join(OUT, "sources.json"),
  JSON.stringify(records, null, 2)
);

console.log(`成功保存 ${records.length} 张图片。`);
