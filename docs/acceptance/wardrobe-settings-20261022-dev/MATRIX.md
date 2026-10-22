# 本轮验收矩阵

2026-10-22，现有本地 MySQL/Redis、core 18000、Web 5173、微信开发者工具原生模拟器。共 19 项：**12 通过，7 部分通过**。下表“通过”限于所述验证范围；并非生产或真实手机全覆盖。与设计阶段 [AC 清单](../../plans/wardrobe-settings-20261021/README.md)一一对应。

| 编号 | 状态 | 实际操作与观察 | 证据 / 未覆盖 |
|---|---|---|---|
| AC-01 | 通过 | 原生菜单/设置五入口齐全；小程序通用类型排除、旧链接阻断；Web 列表/新增排除，旧编辑页提示迁出 | native-check.log、native-regression.log；assets/native-settings-final.png、web-old-link.png |
| AC-02 | 通过 | 五账号正常登录，真实角色核对；个人可管理；家庭群主/家长可管理，成员/儿童只读；两只读角色五类 × 六写路径均拒绝；无家庭拒绝家庭接口 | five-roles-api.log、readonly-five-types.log、native-roles.log；未更改角色或家庭关系 |
| AC-03 | 通过 | 家长按孩子候选代录、拒绝家长私人来源；儿童获取他人/无家庭跨家庭候选拒绝；客户端跨所属人迟到响应丢弃；批量默认本人，儿童固定本人 | proxy-check.log、five-roles-api.log、native-final.log；scripts/test-wardrobe-dictionary-context.js |
| AC-04 | 通过 | 首尾 Unicode 空白规范化、重名拒绝、32 码点含 emoji 保存、33 码点拒绝；原生中文 emoji 输入完整，冲突保留输入 | name-merge.log、more-api.log；assets/native-chinese-emoji.png、native-conflict-preserved.png；真实手机 IME 归 AC-15 未覆盖 |
| AC-05 | 通过 | 五类改名建立新 ID，已保存名称/路径保持；只改价格不改快照，显式重选才更新 | api-check.log、name-merge.log、api-results.json |
| AC-06 | 通过 | 品类改名后款式当前 parent 更新；父停用不改子自身状态，恢复按原状态；带未删除子款式（含停用）不能删父 | more-api.log、api-check.log |
| AC-07 | 部分通过 | 实际无家庭账号空品类不回退；初始化不复活；伪造来源新增和规则识别阻断；本轮删空个人品类后初始化保持为空；原历史衣物可仅改价格并保留空来源旧名 | empty-context.log、assets/native-null-source.png；未对现有家庭及所有五类做删空/重登组合，以保留原始本地测试字典 |
| AC-08 | 通过 | 同名颜色个人优先，个人停用后家庭可选；同名不同归类品类分组；家庭独有款式真实父来源保留；旧来源不自动替换 | name-merge.log、native-batch.log；上下文 JS 及 WardrobeRecognitionServiceTest |
| AC-09 | 通过 | 个人款式复制独立家庭父子树；缺目标父项时新建；已有同名不覆盖；停用父及同名归类冲突跳过，无孤儿 | api-check.log、copy-cases.log |
| AC-10 | 部分通过 | 同作用域版本并发新增仅一方成功；过期 scopeVersion 拒绝；原生冲突保留草稿后重试；会话/角色/所属人变化迟到响应有 JS 回归；过期 expectedFamilyGroupId 拒绝 | api-check.log、empty-context.log、assets/native-conflict-preserved.png；未操作真实退组/角色变更与写入交错，未做两设备手势排序竞争 |
| AC-11 | 通过 | 价格/备注编辑保留快照；搭配与穿着记录复制保留旧名；计划转已穿保留明细且重复请求只计一次；明确移除重加读取当前衣物快照 | api-check.log、more-api.log、corrections.md、native-final.log |
| AC-12 | 部分通过 | 衣物新增/代录/批量、搭配、记录、复制真实写入通过；无效来源使整批回滚；原生批量两件真实落库并保存家庭真实父子来源；规则识别只选有效候选 | proxy-check.log、more-api.log、native-batch.log、corrections.md；外部 AI 视觉请求未执行，不用规则结果代替 |
| AC-13 | 部分通过 | 历史筛选键真实查询通过；相同名称不同归类统计分开，名称冲突标签可区分；五角色候选授权和上下文隔离通过 | api-check.log、name-merge.log、five-roles-api.log；未逐一完成五角色所有历史列表/统计/家庭偏好组合的原生操作 |
| AC-14 | 部分通过 | 用户后续要求取代隔离方案；现有本地备份/结构/专用回填/26 断言及停写期幂等通过；保留原始行和旧字段 | local-verify.tsv、local-verify-rerun.tsv；生产严格脚本的缺源、多候选、部分 DDL 失败恢复未演练；9 项夹具测试最终 skipped |
| AC-15 | 部分通过 | 原生输入中文/emoji、错误草稿、底部保存、列表与排序页面截图已检查；历史空来源正确显示原名 | assets/、native-roles.log、native-final.log；真实手机键盘/IME、320px 小屏、拖拽手势、写成功后断网刷新恢复未覆盖 |
| AC-16 | 通过 | auth 17 项既有记账回归、wx 记账设置脚本、原生四类记账设置打开；通用类型与普通字典 Web 编辑可用；Web 类型/构建通过 | final-package.log、frontend-checks.log、native-regression.log、web-typecheck.log、web-build.log；不对原有记账数据执行测试写入 |
| AC-17 | 通过 | 原生自定义默认其他（11），保存后保留；自定义上装/下装归类、复制保留、无效 99 拒绝；同名不同归类区分；自动搭配规则与排名回归通过 | assets/native-saved.png、name-merge.log、api-check.log、final-package.log；规则路径非外部 AI |
| AC-18 | 部分通过 | 迁移建立家庭独立模板树，个人字典不自动公开；已有家庭 initialize 幂等不覆盖；个人空状态不补回 | local-backfill.tsv、empty-context.log、copy-cases.log；家庭首次并发初始化、五类删空后重登和系统模板后续升级未实测 |
| AC-19 | 通过 | 同名个人优先与停用回退家庭通过；个人品类优先但家庭独有款式仍可见，原生批量保存实际家庭父子 ID；保留既有业务保存来源 | name-merge.log、native-batch.log、scripts/test-wardrobe-dictionary-context.js |

表内 `.log/.tsv/.json/.md` 证据均在 [evidence](evidence/)；截图在 [assets](assets/)。原始日志中的测试断言错误及补验结果见 [更正记录](evidence/corrections.md)，不得只摘第一段 PASS 称整份脚本通过。

生产核验和发布必须按后端迁移说明独立执行。此表不授权创建/修改家庭关系、生产写入、提交、推送或发布。
