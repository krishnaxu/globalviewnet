import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_FILE = path.join(ROOT, "wechat-news.json");

const QUERIES = [
  "DrG的雍熙路",
  "金斯瑞 DrG的雍熙路",
  "ADC DrG的雍熙路",
  "AIDD DrG的雍熙路",
  "细胞治疗 DrG的雍熙路",
  "基因治疗 DrG的雍熙路",
  "核酸药物 DrG的雍熙路",
  "抗体药物 DrG的雍熙路"
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/130.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Referer: "https://weixin.sogou.com/"
};

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .
