# 画遇 · 独立部署包

本包面向你自己的 Cloudflare 账户，目标 Worker 名称是 `paintlight`。
它不会修改 ChatGPT 下的旧网站，也不包含旧网站的个人上传、密钥或用户资料。

## 目前准备好的内容

- 267 幅真实馆藏图片、随机浏览、严格条件筛选、随画作变化的主题和本机收藏。
- 65 幅有核验后的场景标签；其余 202 幅先供随机探索。
- 免费馆藏搜索、来源切换、分页、Google/Bing 外部图片搜索。
- 可选直接 OpenAI API 调用：访客只使用自己临时填写的密钥，不自动消耗站长的模型额度。真实付费调用仍待验证。
- 个人画库的后端代码已保留，改为验证 Cloudflare Access 登录；需完成下面的账户配置才能上传。

## Windows：先发布公开画库

1. 安装 Node.js LTS（https://nodejs.org/，版本至少 22）。安装好后重新打开终端或文件夹窗口。
2. 完整解压本包，不要在压缩文件内运行。
3. 双击 `Deploy-Windows.cmd`。它会安装已锁定版本的依赖，打开浏览器要求你授权 Cloudflare 官方命令行工具，然后发布。
4. 授权时使用创建 `paintlight` 应用的同一个 Cloudflare 账户。若询问多个账户，选择正确的账户。
5. 这个操作将以完整画遇替换该账户中 `paintlight` 的 Hello World 初始页面。终端会输出真实网址；以该输出为准。
6. 如果提示覆盖网页编辑器的部署，确认目标确实是刚创建的 `paintlight` 后继续。

部署会公开馆藏画库。个人上传在登录和存储未配置时保持锁定；网页会提示尚未配置，不会开放任何人的私有画作。

如果脚本报错，保留错误内容。不要把密码、API 密钥或授权码粘贴到聊天中。

也可以在本文件所在目录手动执行：

```sh
npm ci
npm run login
npm run deploy
```

Mac/Linux 同样使用以上命令。更新网站时运行 `npm run deploy`；通常不必重新登录。

## 下一步：接通个人上传

以下配置在公开画库上线后进行，可一起逐项完成。这里不承诺当前账户中的资源已经创建。

1. 在同一 Cloudflare 账户创建 D1 数据库和 R2 私有存储桶。保留存储桶的私有状态。
2. 将 D1 绑定命名为 `DB`，R2 绑定命名为 `BUCKET`。把真实数据库 ID、数据库名、存储桶名加入 `wrangler.json` 的 `d1_databases` 和 `r2_buckets`。D1 的 `migrations_dir` 设为 `drizzle`。
3. 执行 `npx wrangler d1 migrations apply DB --remote`，建立 paintings 表。
4. 使用 Cloudflare Access 配置邮箱登录，保护网站的 `/api/private/*` 路径（包括 `/api/private/login` 和全部个人画库接口）。先只允许自己的邮箱，需要给朋友使用时再显式添加。
5. 将 Access 的 team domain（只填 `你的团队.cloudflareaccess.com`，不带 https://）和应用 Audience 配置为 Worker 变量 `ACCESS_TEAM_DOMAIN` 与 `ACCESS_AUD`。
6. 若当前 workers.dev 的 Access 界面只支持整个应用保护，先保持个人画库关闭；在支持按路径规则的域名配置后再开启。不要为了让上传能用而删掉 JWT 校验，也不要把整站的公开访问与私人图片访问混为一谈。
7. 重新部署。页面会出现登录画库入口。必须验证未登录无法读取私人图片、两个不同允许账户互不可见，再向更多人开放上传。

运行时会检查 JWT 签名、签发者、Audience 和过期时间，用已验证的 subject 作为画作所有者。原来的 ChatGPT 身份请求头完全不被信任。

## 原有资料

267 幅公共馆藏已经随包附带。收藏仍保存在每个浏览器、每个网址自己的存储中，换网址不会自动带过来。旧网站个人上传也不会自动进入新数据库；需要单独导出与迁移，并映射到新登录身份。旧站保持可用，迁移确认之前不要删除旧资料。

我们讨论的“留一幅在手边”和“关系检索”尚未包含在这个迁移包里，可以在独立站跑通后继续增加。

## 验证与范围

- `npm run check`：严格筛选、全部配色对比度、上传所有权隔离、搜索和 AI 请求处理、JWT 签名/受众/过期/伪造测试。
- `npm run preview-build`：只本地构建，不发布。
- `npm run dev`：本机运行。Cloudflare Access 的真实邮箱登录需要远端配置后验证。
- 本次 20 项自动检查和 Wrangler 本地打包通过。开发服务器受当前执行环境网络接口限制未能启动，因此没有完成浏览器预览和真实 Cloudflare 运行验证。
- 发布前没有在你的 Cloudflare 账户中执行操作；真实域名、登录、R2/D1 以及付费 API 均不能因为本地检查通过就宣称已验证。

## 结构和官方参考

`public/`：页面和图片；`server/worker.mjs`：独立入口；`server/core.mjs`：画库和搜索；`server/access.mjs`：JWT 验证；`drizzle/`：数据库迁移。

- 静态图片与后台一起部署：https://developers.cloudflare.com/workers/static-assets/
- 登录凭证验证：https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- workers.dev：https://developers.cloudflare.com/workers/configuration/routing/workers-dev/

使用量超过套餐额度时可能产生托管费用；域名购买、模型 API 和 R2 属于独立服务。先按小规模试用，不自动购买或升级任何套餐。

## GitHub 自动部署

具体连接步骤和构建设置见 `CLOUDFLARE-GITHUB.md`。此包已整理为可直接放在仓库根目录的结构。
