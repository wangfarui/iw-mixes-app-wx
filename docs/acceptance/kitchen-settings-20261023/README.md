# 厨房设置验收记录（2026-10-23）

方案：`docs/plans/kitchen-settings-20261023/` v1.0。本轮未提交、未推送、未执行生产操作。

## 代码版本（实施结束时）

| 仓库 | 分支 | HEAD（基线） | 工作区 |
|---|---|---|---|
| iw-mixes-server | main | 342c207662fe5806645c749f1d5b3505596dd577 | 有未提交厨房改动 |
| iw-mixes-app-wx | main | d0b91d6e6a4c06bacd3279cdb6fb179cafdb87e3 | 有未提交厨房改动 + 交接包 |
| iw-mixes-web-platform | dev | 4eb3e992e7aea39e431c7b678524ad5b5a18be5d | 有未提交字典收口改动 |

## 已执行验证

| 编号 | 方式 | 结果 | 说明 |
|---|---|---|---|
| 编译 | Maven `-pl iw-core,iw-external -am -DskipTests compile` | 通过 | 规定 mvn/settings/repo |
| 单元 | `KitchenDictionaryServiceTest`（6） | 通过 | rename/copy/order/init/权限 |
| 小程序路由 | `npm run check:routes` | 通过 | 82 pages |
| 小程序语法 | `node --check` 关键 JS | 通过 | |
| Web | `npm run type-check` / `npm run build` | 通过 | |
| 微信开发者工具 | CLI open project | 受阻 | 见 `devtools-open.log`；需本机 IDE 权限 |
| AC-01～AC-10 原生/API/迁移 | — | 未执行/受阻 | 本地库 DDL 未获单独迁移授权；`iw-core` 未启动；契约头依赖 READY |

## 数据库与数据残留

- 已编写 `iw-eat/scripts/dictionary-snapshot-v1/{00,01,02,03,README}`，**未对任何库执行**。
- 未创建 `kitchen-settings-test` 夹具；无测试数据残留。
- 若后续授权本地迁移：先确认 loopback 目标 → 备份 → 00→01→02→03 → 再 `local-backend.sh` 启 core。

## 未覆盖项

1. 真实库 preflight/schema/backfill/verify（待明确 DDL 授权）
2. 后端启动后 API：权限五角色、快照三态、历史筛选、版本冲突
3. 微信开发者工具原生 UI：入口、键盘、安全区、拖动排序、只读
4. Web 浏览器旧字典入口人工点击（构建通过，页面操作未做）
