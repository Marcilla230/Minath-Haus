# 清代浙江进士题名碑录时空图谱

3D 数字人文演示（React + Three.js + Vite）。

## 启动（方案一）

```bash
cd "/Users/ltrsmac/Desktop/jinshi-atlas"
npm install   # 首次或依赖变更时
npm run dev
```

浏览器访问：**http://127.0.0.1:5173/**

## 构建

```bash
npm run build
npm run preview
```

数据文件：`public/data.csv`

## 部署到公网（非 localhost）

本项目是纯前端静态站，构建后 `dist/` 可部署到任意静态托管平台。已验证 `npm run build` 可成功构建。

### 方式 A：Vercel（推荐，免费 HTTPS）

1. 将 `jinshi-atlas` 推送到 GitHub 仓库  
2. 打开 [vercel.com](https://vercel.com) → Import 该仓库  
3. 框架选 **Vite**，构建命令 `npm run build`，输出目录 `dist`（仓库内已有 `vercel.json`）  
4. 部署完成后会得到 `https://xxx.vercel.app` 公网地址  

### 方式 B：Netlify

1. 推送到 GitHub  
2. [netlify.com](https://www.netlify.com) → Add new site → Import  
3. Build command: `npm run build`，Publish directory: `dist`（已有 `netlify.toml`）  

### 方式 C：Cloudflare Pages

Build command: `npm run build`，Output: `dist`

### 方式 D：GitHub Pages

仓库已包含 `.github/workflows/deploy.yml`。推送到 GitHub 的 `main` 分支后：

1. 打开 GitHub 仓库 → Settings → Pages
2. Source 选择 **GitHub Actions**
3. 等待 Actions 跑完后，会得到 `https://你的用户名.github.io/仓库名/`

workflow 会自动把 Vite 的 `BASE_PATH` 设置为 `/${仓库名}/`，因此 `public/data.csv` 和前端资源都能在 GitHub Pages 子路径下正常加载。

### 本地先预览构建结果

```bash
npm run build
npm run preview
```

### 注意

- `public/data.csv` 会随构建一起发布，访客可直接加载数据，无需后端服务器  
- 3D 页面体积较大，首次打开可能需几秒加载  
- 若使用自定义域名或根路径托管，可将 `BASE_PATH` 留空，默认 `/`
