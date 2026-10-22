# 小程序主包超限排查与修复

日期：2026-10-22。本次只调整打包范围，不修改业务逻辑。

## 结论

本次衣柜设置新增的设计、验收截图位于 `docs/`，而本地 `project.config.json` 的 `packOptions.ignore` 原为空。官方开发者工具将这些资源打入主包，触发用户报告的 3543KB > 2048KB 错误。

新增六个衣柜设置页面均在 `pagesWardrobe` 分包；无需为此次超限迁移业务页面或删除运行时资源。

## 控制变量验证

使用 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli preview` 对当前工程执行真实预览。第一次保持原有配置，复现完全相同的 `main package source size 3543KB exceed max limit 2048KB` 错误。

第二次只向本地 `packOptions.ignore` 添加 `{ "type": "folder", "value": "docs" }`。命令退出码为 0，显示 `✔ preview`，输出如下：

| 包 | 字节数 | 开发者工具显示 |
| --- | ---: | ---: |
| main | 569559 | 556.2 KB |
| pagesAuth | 18747 | 18.3 KB |
| pagesBase | 144987 | 141.6 KB |
| pagesBookkeeping | 289073 | 282.3 KB |
| pagesEat | 73199 | 71.5 KB |
| pagesPoints | 53403 | 52.2 KB |
| pagesWardrobe | 208957 | 204.1 KB |
| TOTAL | 1357925 | 1.3 MB |

运行时资源、业务代码和编译设置在两次验证间未调整。未开启提高预览体积限制的配置。

源码磁盘统计仅用于解释增量：本次新增设计与验收截图共 1642560 字节，约 1.57MiB；该值不代表历史版本的实际编译包大小。未重新构建改造前的历史版本，因此不对其主包大小作精确结论。

## 持久化与发布边界

- 本地实际 `project.config.json` 已添加 docs 排除规则；保留其原有 appid 等配置。
- 跟踪的 `project.config.json.example` 同步排除规则，README 说明已有配置的合并方法。
- 文档和截图保留在仓库；以后新增 docs 下的验收材料不会再进入上传包。
- 本次验证为开发者工具预览成功，不代表已执行上传、审核或发布。
