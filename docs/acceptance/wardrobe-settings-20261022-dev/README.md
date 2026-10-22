# 衣柜设置：开发与本地自验记录

日期：2026-10-22。实施依据：[已确认方案](../../plans/wardrobe-settings-20261021/README.md)。

**业务代码已实施，用户已确认功能验收完成，并授权提交及推送。** 下方保留 AI 本地自验的原始覆盖边界：[逐项矩阵](MATRIX.md)为 12 项通过、7 项部分通过，用户验收结论不改写这些工具执行记录。

2026-10-22 后续状态：用户自行执行生产 01、02、03，回传 SCHEMA、READY、25 项 failures=0 及 OVERALL=PASS / failures=0；AI 未连接或操作生产数据库。后端、Nginx 和客户端是否已发布需另行核实。小程序主包超限已通过排除 docs 修复，官方预览主包为 556.2KB，见 [包体积验证](PACKAGE-SIZE.md)。

提交前复验：core/external 聚合 Maven test 成功，50 项通过、9 项条件数据库测试跳过；小程序四套相关回归及 79 页路由检查通过；Web type-check、build 通过。没有启动隔离数据库或 Redis，也没有重新执行生产脚本。

## 本轮 UI 补充

用户选择方案 B 并扩展至记账设置，已完成独立底栏与列表滚动调整。9 页 / 17 个个人家庭视图原生检查通过，详见 [方案 B 自验补充](SETTINGS-FOOTER.md)。该结果不替代下方业务矩阵的其他未覆盖项。

## 交付范围

- 后端：五类个人/家庭字典专用管理、一次初始化、权限与版本校验、品类谱系和搭配归类；衣物/搭配/穿着记录的名称快照、可信复制、明细保留、快照筛选统计与实际所属人候选；旧入口及旧契约阻断。
- 小程序：菜单新增“衣柜设置”和五个设置页，个人/家庭切换；录入、批量、规则识别、搭配、记录和统计接新契约；账号/角色/所属人变化时清缓存并丢弃旧响应。
- Web：通用字典列表与新增表单移除五类，旧衣柜字典编辑链接提示从小程序衣柜设置进入；其余字典仍能正常编辑。
- SQL：[迁移说明](../../../../iw-mixes-server/iw-packaging-parent/iw-wardrobe/scripts/dictionary-snapshot-v2/README.md)提供严格生产路径、独立本地回填、核验及恢复边界。若只复制本仓库，该跨仓库链接需要联合工作区。

## 环境与授权

用户明确要求开发自验，并要求直接使用现有本地数据库和 Redis。此前创建的隔离 MySQL/Redis 已停止，本轮最终验证不使用隔离实例。应用连接本机 `iw_mixes`（MySQL 8.0.31）及现有本地 Redis；后端通过 `scripts/local-backend.sh` 启动，端口 18000；Web 5173；微信开发者工具执行原生编译与模拟器验证。

五类角色均由用户授权的账号通过正常密码登录获得真实会话；核对实际家庭角色后执行，不伪造角色、关系或成功响应。账号、密码、token、完整认证响应和数据库备份均不进入本验收包。

服务源码与打包构建使用本次工作树。最终 Java 包在 15:40 构建成功并由脚本重新启动；之后仅修正小程序批量所属人默认值并补回归。三个仓库原 HEAD/分支及设计基线保留，不将 Git HEAD 作为运行包证明。

## 实际执行结果

| 层次 | 结果与边界 | 证据 |
|---|---|---|
| Java 17 / Maven 3.8.6 | core/external 聚合 package 成功，50 项通过（auth 17 + wardrobe 33）；9 项显式夹具数据库测试 skipped，不能计为通过。固定 `/usr/local/maven/repository`、显式最小 settings | [构建日志](evidence/final-package.log) |
| 小程序自动回归 | 字典上下文、列表同步、衣物只读、记账设置四套脚本通过；29 个新增/修改 JS 语法通过；79 页面路由通过 | [最终检查](evidence/frontend-checks.log)、仓库 scripts |
| Web | type-check、build 通过；构建原有 pdfjs eval、NODE_ENV 和包体积警告仍存在 | [类型](evidence/web-typecheck.log)、[构建](evidence/web-build.log) |
| 本地迁移 | 备份后执行结构及已确认的本地回填，READY；26 项断言全为 0，OVERALL PASS；恢复业务写入前重跑仍 PASS | [首次核验](evidence/local-verify.tsv)、[幂等核验](evidence/local-verify-rerun.tsv) |
| 真实业务 API | 新增、五类改名保留旧名、显式清空、可信复制、计划转已穿幂等、历史筛选、同版本并发、批量失败回滚、明细保留、代录、同名合并及冲突复制通过 | [主链路](evidence/api-check.log)、[代录](evidence/proxy-check.log)、[名称合并](evidence/name-merge.log)、[复制分支](evidence/copy-cases.log)、[空候选](evidence/empty-context.log)、[补充原始日志](evidence/more-api.log) |
| 五角色真实权限 | 个人字典均可自管；群主/家长可管家庭，成员/儿童只读；五类型 × 六写路径 × 两只读角色共 60 次直接请求按权限拒绝；无家庭组不能访问家庭字典或跨家庭候选 | [五角色](evidence/five-roles-api.log)、[60 次拒绝](evidence/readonly-five-types.log) |
| 微信原生模拟器 | 五设置页个人/家庭、五角色登录后入口/操作权限、中文 emoji 输入与冲突保留草稿、排序、历史记录回显、无来源 ID 的历史名称、批量实际入库；记账四页及旧字典入口回归 | [五角色](evidence/native-roles.log)、[最终补验](evidence/native-final.log)、[既有页面](evidence/native-regression.log)、[截图目录](assets/) |
| Web 实际路由 | `/dict`、`/dict/add` 无五类；`/dict/edit/1579` 提示迁出且无保存；普通字典 `/dict/edit/1472` 正常回显和保存入口，未修改该行 | [类型筛选](assets/web-dict-filter.png)、[旧链接](assets/web-old-link.png) |

规则识别及搭配建议通过 `useAi=false` 验证实际候选和归类路径，未将规则结果当作外部 AI 视觉识别通过。数据库条件测试曾在用户更改环境要求前运行，但不计入此处最终 50 项，也不重启隔离依赖。

## 修复与复验说明

真实启动发现快照 Mapper 没被现有扫描范围识别，已移入 wardrobe.mapper；真实筛选发现权限 SQL 解析器不能解析 `BINARY field` 比较，已改为 `CAST(... AS BINARY)` 并补解析回归，真实筛选复验通过。清理了仍依赖旧字典/静态候选的识别分支，所有新选择保存真实来源。

五角色原生验证中发现批量默认所属人取家庭列表第一人；已修复为默认本人、成人刷新保留明确选择、无代录权限固定本人。新增 JS 回归和儿童原生页面验证通过。原生批量两件衣物均实际入库，在“个人优先品类 + 家庭独有款式”时保存真实家庭父子来源。

保留原始失败日志以便核对：`more-api.log` 末尾将状态 3 错当作不可用，测试修正为实际 ELIMINATED=5 后复制被拒绝；穿着记录复制保留旧名随后通过。`native-check.log` 末尾错用散件模式断言检查搭配模式；`native-final.log` 已按 selectedOutfitSnapshot 正确复验通过。`native-batch.log` 的批量入库已通过，后续立即跳转与页面自动返回计时器冲突，记录检查已独立补验通过。这些脚本断言错误不隐藏，也不计作最终功能失败。对应更正详见 [补充记录](evidence/corrections.md)。

## 数据保护与清理

迁移原始基线：23 衣物、7 搭配、28 搭配明细、7 穿着记录、18 穿着明细。原有行、所属人、删除状态和旧字典字段保留；本地唯一模板来源冻结名称但 source_id 留空，英文旧标签按原文保存并审计，不伪称创建时原名。

迁移前备份在本机 `/private/tmp/iw-wardrobe-local-before-20261022.sql`（0600），SHA-256 `ef232083bc40e2a11019d018553d460a2affa0a8509143140ca84200a6de9f48`；不进仓库。原衣物 22 的价格仅用于非字典编辑验证，已恢复原值。

本次通过正常接口新增的 6 件衣物、3 个搭配、2 条记录及当前有效测试字典已逻辑删除；五角色另建的 7 项字典已分别用本人会话清理。改名的旧版本、逻辑删除行、快照和审计按业务规则保留，数据库不恢复到“没有测试痕迹”的状态。迁移建立的结构、家庭默认树及初始化状态保留。

[测试 ID 清单](evidence/created-fixture-ids.json)、[清理输出](evidence/cleanup.log)、[只读核验](evidence/post-cleanup.tsv)、[其余业务核验](evidence/post-cleanup-more.tsv)确认无本次活动测试对象，原始五表行归属/删除状态及旧字段无差异。恢复写入后未重跑冻结迁移总量断言，以免把合法新增和改名误判为迁移失败。

## 尚未覆盖

真实手机中文输入法组合、虚拟键盘弹出/收起及 320px 小屏；原生断网后“写成功、刷新失败”的完整恢复；真实退组/改角色与写事务交错；家庭五类删空和并发首次初始化；外部 AI 视觉请求；生产严格迁移的异常/部分 DDL 恢复演练及线上 Nginx 实际运行配置。保留在矩阵，不能据此宣称全部验收或可直接执行生产切换。

上述未覆盖项保留为 AI 执行边界。用户已确认功能验收并授权本次提交、推送；发布状态不从代码推送结果推断。
