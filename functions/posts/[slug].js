 <meta name="color-scheme" content="light">
 <title>文章 - GlobalViewNet</title>
 <style>
    * {
      box-sizing: border-box;
    }
    * { box-sizing: border-box; }

   body {
     margin: 0;
@@ -54,9 +52,7 @@ export async function onRequestGet({ params }) {
     text-decoration: none;
   }

    .back:hover {
      color: #111;
    }
    .back:hover { color: #111; }

   h1 {
     margin: 0 0 12px;
@@ -83,9 +79,7 @@ export async function onRequestGet({ params }) {
     line-height: 1.45;
   }

    #content p {
      margin: 1em 0;
    }
    #content p { margin: 1em 0; }

   #content img {
     display: block;
@@ -191,8 +185,9 @@ export async function onRequestGet({ params }) {
     let value = escapeHtml(text);
     const codeItems = [];

      // 使用字符编码匹配反引号，避免与外层模板字符串冲突
     value = value.replace(
        /`([^`]+)`/g,
        /\x60([^\x60]+)\x60/g,
       function (_, code) {
         const index = codeItems.length;
         codeItems.push("<code>" + code + "</code>");
