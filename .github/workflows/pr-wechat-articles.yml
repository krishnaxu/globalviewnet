
name: PR WeChat Articles Fetch

on:
  workflow_dispatch:
  schedule:
    - cron: "37 3 * * 3"

permissions:
  contents: write

concurrency:
  group: pr-wechat-articles-fetch
  cancel-in-progress: false

jobs:
  fetch-wechat-articles:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Fetch WeChat articles
        run: node scripts/pr-wechat-articles.mjs

      - name: Commit WeChat archive
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add content/pr-portfolio/wechat-articles.json
          if git diff --cached --quiet; then
            echo "No WeChat article changes to commit."
          else
            git commit -m "Update PR WeChat article archive"
            git push
          fi
