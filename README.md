# iw-mixes-app-wx

IW 原生微信小程序项目。该项目用于承接 `../iw-mixes-app` 的微信端迁移，目标是不保留 uni-app 语法、运行时或组件库。

## 第一阶段范围

- 原生微信小程序工程骨架。
- `app.json` 页面、分包、tabBar 配置从 `iw-mixes-app/pages.json` 迁移。
- WeUI 通过 npm 引入，当前锁定 `weui-miniprogram@1.5.6`。基础样式已同步到 `style/weui.wxss`，避免首次编译依赖 `miniprogram_npm`；业务页面优先使用 WeUI 样式与组件，无法覆盖的交互再自建小组件。
- `api/request.js`、登录 API、字典缓存、家庭组基础 API 已按 `wx.*` 原生能力重建。
- 登录页先迁为可联调页面，其余页面先生成原生占位，后续分阶段替换。

## 本地联调

1. 复制 `project.config.json.example` 为本地 `project.config.json`。
2. 复制 `project.private.config.json.example` 为本地 `project.private.config.json`，并填写真实 appid。
3. 在微信开发者工具中打开本目录。
4. 执行 `npm install`。
5. 在微信开发者工具中点击“工具 -> 构建 npm”。
6. 使用开发版或开发者工具运行时，接口默认走 `http://localhost:18000`。
7. 如果在开发者工具里请求 localhost，需要开启“不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”。

体验版和发布版会根据 `wx.getAccountInfoSync().miniProgram.envVersion` 为 `"trial"` 或 `"release"` 自动切换到生产域名 `https://api.itwray.com`。

## 迁移约束

- 新页面只使用 `.wxml`、`.js`、`.wxss`、`.json`。
- 不引入 Vue、Pinia、uni-app、`uni_modules` 或 `uni.*`。
- 接口路径继续通过后端网关前缀访问：`/auth-service`、`/bookkeeping-service`、`/eat-service`、`/points-service`、`/external-service`。
- `iw-mixes-app` 只作为迁移参照，迁移完成前不要删除或重置。

## 常用命令

```bash
npm run scaffold:pages
npm run check:routes
```
