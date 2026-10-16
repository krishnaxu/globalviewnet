import fs from "node:fs/promises";
import path from "node:path";

const API =
  "https://commons.wikimedia.org/w/api.php";

const OUT = "public/images/library/tech";
const USER_AGENT =
  "GlobalViewNetImageLibrary/1.0 (personal website)";

const params = new URLSearchParams({
  action: "query",
  generator: "search",
  gsrsearch: "technology",
  gsrnamespace: "6",
  gsrlimit: "2",
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
  throw new Error(`API 请求失败：${response.status}`);
}

const data = await response.json();
const pages = Object.values(data.query?.pages || {});

await fs.mkdir(OUT, { recursive: true });

const records = [];

for (const page of pages) {
  const info = page.imageinfo?.[0];
  if (!info) continue;

  const meta = info.extmetadata || {};
  const license = meta.LicenseShortName?.value || "";
 const allowed = /^(CC0|CC BY(?:-SA)?(?:\s|$)|Public domain)/i.test(license);
