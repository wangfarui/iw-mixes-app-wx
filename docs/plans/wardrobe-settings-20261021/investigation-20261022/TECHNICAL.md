# 根据本地实查收敛的数据/API 契约

日期：2026-10-22。状态：经本轮整体复核补齐的技术设计；局部更新、明细、初始化、历史筛选、错误及发布迁移流程的补充以[实施清单](../IMPLEMENTATION.md)为准。没有创建表、修改业务源码或运行迁移。产品确认以主 README 为准，旧数据名称基线已确认，客户端切换按微信自动更新收敛，短暂旧请求由契约校验兜底；并非用户确认此前统一阻断全部旧版衣柜读写的提案。生产回传补充见[生产结果分析](../production-readonly-20261022/RESULTS.md)，以下本地缺源/英文示例只作异常预检用例，不作为生产清洗依据。

## 1. 选择与模块边界

采用 **扩展 base_dict 的衣柜专用列 + 业务标量快照列 + 多选标签快照表**。不采用另一个重复保存 scope/name/status 的字典元数据表，以免制造两份主数据及同步约束；不修改记账已有 active_name_key/索引/Type 枚举。

iw-auth 实现 WardrobeDictionaryService/Mapper/Controller，负责五类字典与个人/家庭初始化、版本、权限。iw-web 增加窄接口 WardrobeDictionaryAccess 及无状态来源/名称模型；iw-wardrobe 在同一 JVM 事务内调用它，负责真实衣物所属人授权、快照、统计与规则。不能增加 auth→wardrobe 依赖或通过没有所属人上下文的 BaseDictClient 做代录授权。

读取候选和历史展示用批量无锁查询。写入校验用统一事务和必要的来源/范围锁，避免读取时每件衣物重复加锁。

## 2. base_dict 增量列与名称约束

以下为计划列；执行前重查实际结构和重复数据，保留现有全部 ID 与旧 dict_code。

| 字段 | 计划类型/含义 |
|---|---|
| wardrobe_category_lineage_id | INT UNSIGNED NULL；5002 的稳定首版品类 ID，5006 的所属品类稳定首版 ID，其余为空 |
| wardrobe_match_kind | TINYINT UNSIGNED NULL；只用于5002，1–11 对应既有系统品类含义；新增默认11“其他” |
| wardrobe_parent_key | 生成列 INT UNSIGNED；5006 取 category_lineage_id，其余为0，仅用于稳定父范围唯一性 |
| wardrobe_name_key | 生成列 VARBINARY(128)；仅五类且 deleted=0 时取名称二进制字节，其余NULL |

新增唯一键 `(scope_type,family_group_id,user_id,dict_type,wardrobe_parent_key,wardrobe_name_key)`，使款式可在不同品类下同名；同一作用域的品类名称自身仍唯一。停用项占用名称，旧删除版本不占用。新增查询索引 `(scope_type,family_group_id,user_id,dict_type,wardrobe_category_lineage_id,deleted,dict_status,sort,id)`；最终索引取舍以具体 SQL 的 EXPLAIN 为准。

类别首版插入后，在同事务将 lineage_id 设为其 ID；子款式 parent_id 指当前品类版本 ID，lineage_id 指稳定首版 ID。品类改名创建新 ID、继承 lineage 与搭配归类；在持有范围锁的事务中将当前子款式 parent_id 改至新版本并增加子项 revision。款式无需因父项改名而换名称 ID；历史业务自己的品类名称不改。

同名跨个人/家庭品类只有名称和 match_kind 均相同时才合并候选；父谱系 ID 不同仍保持数据库独立。子款式候选按父名称路径与搭配归类聚合，并保留真实父来源 ID。选择家庭独有款式时返回其真实家庭父子来源，不能提交个人父 ID+家庭子 ID 的虚构组合。

名称规范化复用当前 Unicode 去首尾空白与1–32码点逻辑；先归一再校验与建键，数据库二进制唯一键兜底。新五类不再执行旧的通用 code 自增、code唯一、全用户同步或最后启用项保护。遗留 code 仅用于旧数据追溯，来源 ID 永不写入旧码列。

## 3. 作用域状态与并发

计划新增 wardrobe_dictionary_scope_state：

- 主键 `(scope_type, owner_id)`：个人 owner_id 为 user_id；家庭 owner_id 为 group_id。
- initialized_at DATETIME；scope_revision BIGINT UNSIGNED NOT NULL，完成初始化才写状态。
- 个人/家庭作用域无论后来是否删空，都不再次初始化；新家庭从模板生成，父子来源映射独立。

注册、家庭创建、迁移中完成初始化；已有管理上下文缺状态时使用显式的受鉴权初始化POST，列表GET不承担隐式业务写入；注册、家庭创建、既有数据迁移的正常链路应预先建立状态，不依赖普通成员/儿童触发家庭管理写入。接口与异常路径见实施清单第3节。所有初始化都需锁作用域身份与唯一状态，同事务插入品类、款式等及状态；失败整体回滚。

写入顺序固定：有效用户/家庭与成员身份 → 作用域状态（按稳定键排序）→ 字典来源行（按ID排序）→ 业务行/快照。新增、复制、改名、启停、删除和排序均增加 scope_revision。品类删除与子项创建必须争用同一作用域锁，禁止先检查无子项后被并发插入孤儿。

单行操作校验 revision；排序校验完整当前排序集合和 scopeVersion。scopeVersion 建议是包含 scope/实际 owner_id/revision 的不透明字符串，不能只用可能在不同家庭重复的一个数字。家庭请求携带预期家庭身份，事务内核实当前有效成员及角色；过期请求不能被自动写到新加入的家庭。

父品类停用不修改子项本身 dict_status；新选择同时要求父子均有效。恢复父品类只恢复原本启用子项的可选性。品类删除在事务内检查所有未删除子款式，包含停用款式，任何一行存在均拒绝。款式不提供直接换父操作。

## 4. 业务快照与迁移来源未知

标量增量列：

| 表 | 新增内容 |
|---|---|
| wardrobe_item | category_source_id INT UNSIGNED NULL、category_name_snapshot VARCHAR(32) NULL、category_match_kind_snapshot TINYINT UNSIGNED NULL、item_style_source_id INT UNSIGNED NULL、item_style_name_snapshot VARCHAR(32) NULL、color_source_id INT UNSIGNED NULL；color_name 作为既有名称快照继续保留 |
| wardrobe_outfit_item / wardrobe_wear_record_item | category_source_id、category_name_snapshot、category_match_kind_snapshot、item_style_source_id、item_style_name_snapshot，同上类型 |

计划新增 wardrobe_dictionary_tag_snapshot：id BIGINT UNSIGNED主键；business_type、business_id、dict_type、source_id INT UNSIGNED NULL、name_snapshot VARCHAR(32)、ordinal INT UNSIGNED。适用组合 ITEM:5004/5005、OUTFIT:5004/5005、WEAR_RECORD:5004。唯一 `(business_type,business_id,dict_type,ordinal)` 保留快照顺序；索引 `(business_type,business_id,dict_type)`、`source_id` 和精确名称统计所需索引。

新选择必须有真实 source_id，服务端按字典读取名称，不信任客户端传来的 name。历史基线行允许 source_id=NULL，但不能因此成为可新选候选。建议另外保存 wardrobe_dictionary_migration_resolution 审计表，至少包含 batch、业务类型/ID、字典类型、序号、raw_value、显示基线、解析来源（PERSONAL_CURRENT/BUILTIN_BASELINE/LEGACY_LITERAL）、resolved_source_id、异常原因；不通过 null source 伪造历史选择。

用户已确认生产存量采用迁移时可确定的现有名称：按各记录自身所属人+保存码唯一解析，颜色保留已存文字，迁移解析留痕；不追溯无法证实的创建时原名。生产不需要套用本地缺源/混合标签的兜底建议。以下仅是本地异常夹具场景，非已授权的生产自动清洗规则；正式预检遇到未知来源/多候选时仍须停止：

1. 品类/款式没有个人行：冻结内置名称与搭配语义，旧 source_id 保留空，记录旧编码；未来个人初始化的 ID 仅用于新选择。
2. 数字场景/风格能唯一解析：冻结该所属人的当前名称和来源，标为迁移时解析，不声称恢复创建时名称。
3. 英文旧 token：建议保留当前显示原文，source_id为空且记录raw token；不自动翻译、合并或公开到家庭。
4. 颜色已有文本：保留原文本；能唯一精确匹配来源才补来源，其他允许仅保留历史文本并输出来源标记。

旧 category/item_style/CSV 列暂留且禁止存新ID。新业务的权威为来源+快照；新增对象的旧列只保留可明确表达的标准码/空值，无法表达的新自定义项不伪造旧码。用户以微信自动更新为主，不做长期旧版适配和独立强制升级页。短暂旧请求不能借双写伪造旧视图或猜测来源；通过衣柜契约校验返回重新进入提示，具体不兼容端点在实施时逐项验证，其他业务模块不受影响。

品类与款式历史筛选、统计用快照名称路径和搭配归类区分；同名但搭配归类不同的品类不得被统计层重新合并。多选统计先对同一业务记录同类型同快照名称去重，再计记录数；不能按标签行数放大件数。

## 5. API 契约

统一前端路径 `/auth-service/wardrobe/**`，控制器内部 `/wardrobe/**`。衣柜域请求统一携带计划的新契约header `X-IW-Wardrobe-Contract: 2`；不修改其他业务的请求语义。现有api/request.js的get/post/put不透传options且Nginx白名单未包含该头，必须按实施清单第8节一起处理。

### 5.1 字典管理

| 方法/完整路径 | 请求要点 | 响应要点 |
|---|---|---|
| GET /auth-service/wardrobe/dictionaries/items | type=CATEGORY/ITEM_STYLE/COLOR/SCENE/STYLE；scope=PERSONAL/FAMILY；款式可带categoryLineageId | items(id,name,enabled,revision,sort,parentId,categoryLineageId,matchKind)、canManage、familyGroupId、scopeVersion |
| POST /auth-service/wardrobe/dictionaries/items | type、scope、name、scopeVersion；款式带真实parentId+parentRevision；品类带matchKind默认11 | 当前item及新scopeVersion |
| PUT .../items/{id}/name | name、revision、scopeVersion | oldId、新item、scopeVersion；保持其他状态 |
| PUT .../items/{id}/status | enabled、revision、scopeVersion | item及scopeVersion |
| DELETE .../items/{id} | revision、scopeVersion | 新scopeVersion；父项有未删除子项则业务拒绝 |
| PUT /auth-service/wardrobe/dictionaries/order | type、scope、categoryLineageId（款式）、完整集合ids、scopeVersion | 新scopeVersion |
| POST /auth-service/wardrobe/dictionaries/copy-personal | 本人的sourceIds、目标家庭scopeVersion | created、skipped及原因、父子映射、新scopeVersion |

父项改名、跨范围复制、初始化与整组排序必须原子完成，失败不产生部分树。API不提供type/owner直接改写、款式换父或管理员全用户同步。

### 5.2 实际业务候选

GET /auth-service/wardrobe/options：带 businessType、ownerUserId，编辑时带业务ID；服务端先确认是否有权为该所属人创建或编辑这条业务，再调用窄接口读取允许的个人/家庭项。返回分组候选、真实来源及父来源、matchKind、上下文标识和scope版本。查询另一个人的候选不等于可以管理其完整私人字典。

新的衣物录入使用 `dictionarySelection={categoryId,itemStyleId,colorId,sceneIds,styleIds}`。categoryId按必填校验，其他清空明确传null/[]；如果选了款式，其真实categoryId必须匹配。家庭子款式对应的家庭父来源由候选明确返回，不让前端猜配对。

更新使用显式 `dictionaryChanges`：缺省表示所有字典字段保持原快照；只提交实际改变字段，null/[]表示清空，不能将“未传”视为清空。category变更时旧款式不匹配，必须明确给出新款式或清空；不能静默保留跨品类款式。原值已删除/退出家庭时，仅修改价格/图片等非字典字段仍可保存。移交所属人保留未改动快照；新选项按新所属人校验。

对应搭配/穿着记录的自身场景风格同样使用来源ID和显式变更。服务器用显式detailId/itemId和明细集合版本区分保留原明细、移除明细、新加衣物；旧明细保留原快照，不能删除全部再根据itemIds重建。客户端提交的是原明细ID/新衣物ID，服务器不能接受客户端伪造的历史名称。

复制接口直接从有权复制的原对象快照构造目标保留部分，仍沿用现有衣物删除/转交可用性检查；不能因为保留快照就扩大物品操作权限。计划转已穿只改状态，沿用原有计数、幂等与权限逻辑，不重新解析名称。

旧表单若只提交category/itemStyle/sceneTags等旧编码字段，不进入新来源校验的猜测适配；新契约不接受同时提交互相矛盾的新旧字典字段。

## 6. 缓存、初始化和迁移次序

候选缓存键至少包含会话、业务所属人、当前有效家庭、个人/家庭scopeVersion；列表和历史快照不共用缓存。业务写入重新校验来源及权限，不信任缓存。字典写入失效本范围候选；家庭变动失效相关上下文；过期异步响应丢弃。

现有个人5003/5004/5005保留，包括逻辑删除历史；缺某个模板项不等于允许修复复活。5002/5006本地均零个人历史，但生产回传已有6个用户的品类/款式，不能照搬本地补齐方案；生产保留既有个人ID与父子关系，建立作用域状态。仅对确实从未初始化的新用户使用一次性个人初始化，来源须在迁移审计中与旧记录来源分开。家庭五类初始化同理，复制模板父子结构但不复制用户私人自定义项。

迁移严格按 preflight → 结构 → 来源初始化/基线回填 → 断言 → 切换门槛执行。每个批次记录来源解析与原值；任何未授权的清洗、未知编码、多候选或归属歧义都停止，不用 MIN(id) 随意选来源。保留每个旧业务主键和原行数，逻辑删除历史也纳入回填与断言。

本次没有生成可执行DDL/回填脚本或运行上述写入。实现时在独立本地夹具库验证脚本，实际应用库迁移和生产操作需按对应授权执行。

## 7. 小程序更新核实（2026-10-22）

当前app.js未使用wx.getUpdateManager、onUpdateReady或applyUpdate；api/login.js的startVersionPolling轮询/auth-service/dict/version，是字典缓存版本，不是小程序代码更新。微信官方[更新机制](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/update-mechanism.html)已于本轮读取：支持同步/异步更新，异步更新时当次启动仍可能使用旧包，新版本发布不能即时覆盖所有运行用户；最低可用版本设置也不能改变同步/异步更新的选择。

按用户自动更新预期收敛为普通发布/更新处理，不增加长期旧版双轨或衣柜专属强制升级页面。工程需覆盖已打开旧表单、更新下载失败、新端上线先后顺序；新端若接UpdateManager，应在新版本就绪后适时提示重启，不自动丢弃未保存草稿。旧包不能被本次新增监听追溯修改；不兼容请求仍以服务端契约校验防止错误展示/写入，不能假定重进必然已拿到新包或用同名来源猜测兼容。实际微信管理后台设置未查询、未修改，发布动作另按用户授权。

## 8. 家庭字典维护角色确认（2026-10-22）

用户已回复“采用”：家庭共用五类字典由群主/家长维护，普通成员/儿童只读。该约束覆盖新增、改名、启停、删除、排序、个人项复制到家庭及其隐式父项创建；前端隐藏写操作不能替代服务端校验。所有写事务重新核验有效家庭关系与维护角色，角色/退组变更与写入的竞态纳入自验。业务代录只授权所需候选读取，不授权管理孩子的完整个人字典；个人字典仍由本人管理。未授权在本轮创建角色、测试家庭或执行业务写入。
