# 用 GitHub 自动更新画遇

目标：把此目录作为 GitHub 仓库根目录，连接现有 Cloudflare Worker `paintlight`。
代码仓库按项目所有者的选择设为 Public，供公开查看源码；网站由 Cloudflare 托管。

## 仓库结构

`package.json`、`package-lock.json`、`wrangler.json`、`public/` 和 `server/` 必须位于仓库根目录。
不要把 ZIP 文件本身当成网站源码上传，也不要再套一层 `paintlight-independent/` 目录。
`.gitignore` 已排除依赖、构建结果、本机授权状态和环境密钥文件。

## 在现有 Worker 连接仓库

在 Cloudflare 打开 `paintlight` → Settings → Build，连接 GitHub 仓库。
授权 Cloudflare 时，仅选择画遇的仓库即可。不要另外创建一个同名 Worker。

配置：

| 项目 | 值 |
|---|---|
| Production branch | `main` |
| Root directory | 仓库根目录 |
| Build command | `npm run check` |
| Deploy command | `npm run deploy` |
| Build variable `NODE_VERSION` | `24` |

依赖由 Cloudflare 根据 package-lock.json 安装。
构建阶段先运行已有 20 项检查；失败时不会进入部署阶段。
`npm run deploy` 使用 `wrangler deploy --keep-vars`，保留控制台配置的运行时变量。
D1、R2 等资源绑定需要显式保留在 wrangler.json 中，`--keep-vars` 不等于保留所有资源配置。
首次连接可能立即触发部署；成功后确认网址仍为原来的 Worker 地址。

## 之后如何修改

以 GitHub 仓库为唯一源码来源：取最新代码、修改、检查，再提交到 main。
Cloudflare 检测到提交后自动部署。需要先预览的大改动可以使用独立分支。
请避免同时在 Cloudflare 网页编辑器修改代码，否则下一次 GitHub 部署会覆盖这些未进入仓库的修改。

把 ChatGPT 连接 GitHub 与把 Cloudflare 连接 GitHub 是两次独立授权：前者用于协作代码，后者用于自动发布。
本文件只是已准备的配置说明，不表示仓库已创建、授权已完成或自动部署已接通。

官方说明：
- https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
