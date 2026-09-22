# Richology 能力图谱网站

这是主仓库内的静态网站。它直接消费 `../data/` 中的图谱真源，并提供“星图 / 地形”双视图、领域筛选、节点详情、关系探索和文本浏览。

## 本地运行

需要 Node.js 24+ 与 Python 3.12+：

```bash
npm install
npm run dev
```

默认地址为 `http://localhost:4321`。

## 验证

```bash
npm run check
npm run build
npm run test:e2e
npm audit
```

端到端测试在 macOS 使用系统 Chrome，在 CI 中使用 Playwright Chromium。

## 数据生成

`npm run data` 调用 `../tools/build_web_graph.py`，生成 `public/data/graph.json`。该文件是构建产物，不是新的内容真源。相同源数据和布局算法版本应生成字节一致的结果。

## 部署

`npm run build` 输出纯静态文件到 `dist/`，可部署到 Vercel、Netlify、Cloudflare Pages 或等价静态托管平台。构建目录设为 `site`，输出目录设为 `site/dist`。
