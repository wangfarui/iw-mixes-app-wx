# 记账设置 UI 改造 实施与自验结果（runId: a1019）

> 2026-10-20 归档说明：本报告记录 10/19 的实际操作；相关代码现已包含在 `25a6cb2`，文中“未提交”描述仅指当时状态。本次仅更新资料，未重新执行 UI 或业务验收，原有待验项保留。

日期：2026-10-19。方案：`docs/plans/bookkeeping-settings-ui-20261019/README.md`（用户已确认，本轮回合直接实施，未重新确认设计）。

## 1. 基线与范围核对

- 交接基线：BASELINE.json 的 `dirtyPathsAtPlanTime` 与实施前 `git status` 逐项一致；磁盘现状即基线，未 reset/checkout，未覆盖任何既有未提交改动（含 `utils/bookkeeping.js`、`api/request.js` 等既有修改）。
- 本轮仅改 `iw-mixes-app-wx`：记账设置首页、共享字典管理工厂与模板/样式、三个薄壳页面 data 绑定、新增本地 SVG 图标、共享纯逻辑 `utils/bookkeeping-settings.js`、行为回归 `scripts/test-bookkeeping-settings.js`、npm 脚本、验收驱动与证据。未触碰后端/Web/SQL/生产配置，未 commit/push/tag。

## 2. 实施中发现并修复的问题

| # | 问题 | 修复 |
|---|---|---|
| 1 | `load()` 在家庭组确认前捕获 identity，首次加载时家庭到达会使响应被误判过期（页面卡在加载态） | identity 改为 `ensureMyGroupLoaded()` 之后捕获（保持原实现语义） |
| 2 | `retryRefresh()` 未返回 Promise，调用方无法等待刷新重试完成 | 返回 `_reload()` Promise |
| 3 | 排序拖动松手时 `touchend` 只清理 `_touch`，拖动浮层与状态残留（自验探针实测复现） | `onHandleTouchEnd` 在拖动中调用 `_resetDragState()` |
| 4 | `dragTargetIndex` 向下拖动只返回首个被越过行，未取最终插入位置 | 向下取最后越过的行；向上取首个（单测锁定边界） |

## 3. 源码指纹（验收时磁盘版本）

```
94f894a5… dictionary-management.js
2abce97a… dictionary-management.wxml
97077e4e… dictionary-management.wxss
cfcc9dd9… bookkeeping-settings.js
72ba880a… bookkeeping-settings.wxml
95b987be… bookkeeping-settings.wxss
d626bd01… utils/bookkeeping-settings.js
```

## 4. 验收矩阵结论（PASS=实测通过，BLOCKED/NOT_RUN=说明原因）

| ID | 结果 | 证据/说明 |
|---|---|---|
| S01 | PASS | 首页+三页真实截图 `01-S01-home/category/consume-tag/income-tag`；标题/顺序/返回正确 |
| S02 | PASS | 首页 375pt 截图：图标/主副标题/箭头无重叠，整行可点（真实 tap 进入） |
| S03 | PASS | 个人/家庭切换各自加载，无残留（family 流程断言 + S03-family-scope 截图） |
| S04 | BLOCKED | 无“无家庭”登录方式可用（唯一已知账号 userId=42 有家庭，规则禁止改家庭数据）；无家庭分支已由 Node 行为测试覆盖（`test:bookkeeping-settings` 第 8 组） |
| S05 | BLOCKED | 同上，无只读角色账号；只读拒绝路径由 Node 行为测试覆盖（openAdd/openMenu/startSort 全部被拒），代码以服务端 `canManage` 为准 |
| S06 | PASS | 首载 loading→列表；空/失败态分支独立；可写按钮首载完成前不渲染（`loadedOnce` 门控） |
| S07 | PARTIAL | 失败态与重试由 Node 测试覆盖（loadError/retryLoad）；断网实测未执行（工具限制），未宣称全实测 |
| E01 | PASS | 三类新增表单标题/标签/示例（分类=学习成长、支出=外卖、收入=工资），`E01-add-sheet` 截图 |
| E02 | PASS | 中文/数字/emoji 码点计数断言（`UI-a1019-甲`=10/32）；输入不被截断、不裁切（截图） |
| E03 | NOT_RUN | 开发者工具模拟器仅 375pt；320/414 尺寸切换需真机或工具 UI，记录为待复核 |
| E04 | PARTIAL | 模拟器实测输入焦点/表单不位移/按钮可达；`adjust-position=false`+`bindkeyboardheightchange` 模型落地；模拟器截图不含软键盘画面，真机键盘待复核 |
| E05 | PASS | 重名（启用/停用占名）、33 码点、就地错误+计数+保存禁用；`E05-duplicate-error` 截图 |
| E06 | PASS | 新增后回列表出现新项且旧项不丢；候选缓存 `optionsStore.invalidate()` 调用（Node 断言） |
| E07 | PASS | 改名后服务端返回新 ID 生效（旧 ID 未沿用）；`E07-rename-sheet` 含历史名称提示 |
| E08 | PASS | 连点只发一次写请求；失败保留草稿可重试；写成功后刷新失败不重复 POST、只读重试恢复（Node 断言） |
| E09 | PARTIAL | 遮罩点击不丢草稿（editor 遮罩 no-op）、取消/关闭明确结束（代码+Node）；真机点击遮罩手感待复核 |
| M01 | PASS | 更多菜单单弹层+互斥切换改名（activeSheet 单例）；M01 截图 |
| M02 | PASS | 停用→计数→折叠区标注→再启用全链路；`M02-disabled-expanded` 截图 |
| M03 | PASS | 取消无请求保留选项、确认一次删除、危险色克制；`M03-delete-dialog` 截图 |
| M04 | PARTIAL | 冲突路径：失败刷新权威数据、不自动用新 revision 重放（Node 断言）；双会话并发改名场景未实测 |
| R01 | PASS | 取消恢复基线且不请求排序 API（orderCalls=0）；返回放弃排序（代码路径 onHide 清理） |
| R02 | PASS | 全量 ID（含停用）+进入时 scopeVersion 提交；重进一致；既有项相对顺序恢复（逐项比对） |
| R03 | PASS | 长按拖动跨两行插入正确、松手清理浮层；`R03-drag-shadow` 拖动浮层截图 |
| R04 | PARTIAL | 边界自动滚动逻辑落地（边缘检测+受限滚动+重测）；真机长列表跨屏拖动待复核 |
| R05 | PASS | 提交中防重；失败保留草稿+错误提示，不自动重放旧 payload；排序中禁切范围 |
| C01 | PASS | 0 项禁用、选中数、取消无写、提交 created=1 且家庭出现夹具、随后清理 |
| C02 | PASS | 重名候选“已存在”不可选（截图）；个人停用源保留状态（deriveCopyItems 单测） |
| C03 | PARTIAL | 候选列表 scroll-view 独立滚动、按钮可达（截图）；加载/写入失败的保留勾选由 Node 覆盖 |
| C04 | PARTIAL | 身份/家庭变化的候选隔离与旧选择清空由 Node 覆盖；真实退群场景未执行（禁止改家庭数据） |
| L01 | PASS | 页底单/双操作区高度占位（spacer），长列表+停用展开不贴底（M02 截图底部留白正常） |
| L02 | PASS | 遮罩 catchtap 拦截背景误触；弹层内 scroll-view 独立滚动（copy-sheet 截图） |
| L03 | PARTIAL | onHide/onUnload 清理拖动/计时器（代码+卸载 Node 断言）；多次开关弹层的真机回归待抽样 |
| L04 | PASS | `check:routes` 72 页通过；`test:bookkeeping-payer`、`test:bill-refresh-navigation` 通过；样式收敛在 dm- 前缀与页面级 wxss，未污染全局 |

## 5. 交付物

- 代码：`pagesBookkeeping/bookkeeping/{bookkeeping-settings,dictionary-management,bookkeeping-*-settings}.*`、`utils/bookkeeping-settings.js`、`static/bookkeeping/settings/*.svg`（9 枚本地小图标）、`scripts/test-bookkeeping-settings.js`、`scripts/acceptance/{drive-settings-ui,capture-shots}.js`、`package.json`（新增 `test:bookkeeping-settings`）。
- 证据：`evidence/` 15 张真实开发者工具截图（均已人工打开查验，无空白/错位/旧日志）；`checks.txt`；`fixtures.json`。
- 夹具：全部 `UI-a1019-` 前缀项已清理（三类型×两范围复核残留 0，cleanup PASS）；未创建账单/预算/任务，未改角色/家庭关系；排序测试仅移动夹具且恢复既有相对顺序。
- 服务状态：本地后端 18000 复用既有进程，未重启未编译；微信开发者工具项目已关闭。
- 未执行：Git 提交/推送（按要求）；真机键盘与多尺寸复核（记录为待办，不影响模拟器结论）。
