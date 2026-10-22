# 本地数据库与代码只读调查

调查日期：2026-10-22。本地调查完成时对应主方案 v0.13；本报告区分实测事实、技术设计判断及待确认迁移政策。

后续上下文：用户说明本地库均为测试数据并要求优先核实生产。本报告保留本地事实，不作为生产脏数据或清洗政策依据；基线问题暂缓，先使用[生产只读查询包](../production-readonly-20261022/README.md)取得实际结果。

## 1. 调查边界与结论

用户授权原文：“在本地环境数据库和代码进行调查判断”。

本次连接的是 iw-core 本地 dev 配置指向的 loopback:3306/iw_mixes，实际 MySQL 8.0.31。凭据仅在执行进程内读取，不写入查询、参数、报告或证据。所有 SQL 都运行在 `SET SESSION TRANSACTION READ ONLY` 与只读一致性事务内，结束 ROLLBACK。每个 SQL 文件是独立快照，不锁定业务表；本报告是本地时间点结果，不是生产数据或运行版本证明。

本次没有执行业务写入、DDL、迁移、模板修复、登录、接口验收、Maven、服务启停或发布。仅新增/更新本需求的调查资料。临时只读连接器放在 /private/tmp，交接不依赖该文件。

判断：**新模型可以按本地实际结构实施，但存量迁移必须引入“可证明的当前显示基线”，不能承诺重建不存在的历史来源 ID 和旧名称。** 已找出具体异常，没有理由直接执行旧模板脚本或把模板 ID 冒充个人历史来源。

U-05 的数据/API 技术选择已在 [技术契约](TECHNICAL.md)收敛为推荐实现。U-04 已完成本地数据实查，迁移政策待用户确认。U-06 已核实本地旧请求结构与仓库入口，推荐采用新契约标识与旧写阻断，正式发布前仍须核实线上版本与入口。

## 2. 真实数据库事实

证据：[结构查询](01-schema.sql)、[结构结果](01-schema.tsv)、[数据检查](02-data.sql)、[数据结果](02-data.tsv)、[边界查询](03-edge-cases.sql)、[边界结果](03-edge-cases.tsv)、[完整标签查询](05-token-resolution.sql)、[完整标签结果](05-token-resolution.tsv)。结果只保留结构、聚合、必要的记录主键及字典/标签值，不含账号、密码、衣物名称、图片或备注。

### 2.1 规模与结构

| 表 | 总行数 | 未删除行数 |
|---|---:|---:|
| wardrobe_item | 23 | 17 |
| wardrobe_outfit | 7 | 3 |
| wardrobe_outfit_item | 28 | 9 |
| wardrobe_wear_record | 7 | 5 |
| wardrobe_wear_record_item | 18 | 10 |

五类衣柜字典共 799 行，其中 1 行逻辑删除。全部是 scope_type=0，没有家庭衣柜字典行。衣物涉及 5 个所属人，用户记录均存在，其中 4 人当前在有效家庭。家庭表 6 行，当前有效家庭 1 个。

base_dict 已有 scope_type、family_group_id、previous_id、revision，具备复用基础；衣柜字典没有名称版本链，799 行 previous_id 全为空、revision 全为 0。当前没有衣柜名称快照字段或快照表。

实际列宽：base_dict.id 是 INT UNSIGNED，衣物及两类明细的 category 是 TINYINT，item_style 是 SMALLINT UNSIGNED，标签是 VARCHAR(128) CSV。**绝不能把新字典 ID 写回 category/item_style 或把 ID CSV 当旧编码 CSV。**

base_dict.active_name_key 的生成表达式只覆盖 4001/4002/4011；uk_bookkeeping_dict_name 由它约束记账。衣柜应有独立生成列和索引，不能修改其含义。业务表均为 InnoDB、utf8mb4_0900_ai_ci；名称比较需显式使用规范化后的二进制键，以免大小写、重音被默认排序规则合并。

### 2.2 品类与款式只有模板，没有个人来源

| 类型 | 系统模板行 | 个人行（含已删除） |
|---|---:|---:|
| 5002 品类 | 11 | 0 |
| 5006 款式 | 121 | 0 |
| 5003 颜色 | 15 | 255 |
| 5004 场景 | 9 | 153 |
| 5005 风格 | 13 | 222 |

5002/5006 模板的父子关联全部有效，无缺父、错误类型、跨归属或停用父项。五类字典按本方案范围检查的当前重复编码、去首尾普通空格后的同名组均为 0；此检查不等于完整 Unicode 规范化预检已经完成。

23 件衣物以及 46 条搭配/穿着明细的非零品类编码都能唯一找到当前系统模板，但不能找到所属人的个人品类来源。只有 5 件未删除衣物设置了非零款式，也全部是模板编码，其余款式为 0。未发现未知非零品类/款式码或款式与品类编码不匹配。

将当前小程序 helper 的五组内置选项与数据库模板逐项比较，名称、编码、款式父品类全部一致，差异数均为 0。详见 [比较结果](04-builtin-template-comparison.json)。这是“当前显示基线”可验证的依据，不证明所有历史版本从未更名。

**迁移修正：**历史记录不能直接回填“原个人品类来源 ID”，因为这些行从未存在。建议对符合“该类型零历史行”的个人作用域首次初始化品类/款式，供未来录入使用；历史快照保存当前可证实名称、旧编码及 BUILTIN_BASELINE 来源标记，source_id 可为空。不要把新初始化的个人 ID 或模板 ID 伪装成当时真实选择的个人 ID。具体基线政策需要用户确认后才能写库。

### 2.3 实际存在英文与数字混合的旧标签

发现的旧英文 token 为 work、daily、travel、home、simple、smart、casual、street。当前部分值如 `daily,travel,home,1`、`simple,casual,smart,1,2`，同时包含英文旧值与数字编码。

| 对象 | 未删除的受影响记录 | 已删除的受影响记录 |
|---|---:|---:|
| 衣物 | 3 件，场景/风格合计 6 个字段 | 6 件，合计 9 个字段 |
| 搭配 | 0 | 3 条，合计 6 个字段 |
| 穿着记录 | 0 | 2 条，2 个场景字段 |

完整拆分后，数字 token 共 80 个（包括混合字段中的数字部分），都能唯一匹配对应记录所有者当前的个人来源，没有缺失或多候选。英文 token 共 37 个，其中未删除衣物有 14 个。各字段的计数见完整标签结果。

当前 helper.splitTags 仅按逗号拆分，tagNames 对未知选项回退为 token 原文。因此 `daily` 目前显示为 daily，数字 `1` 显示为字典名称“日常”。当前和历史提交 a3a608e 中的 AI 归一化代码能证明 daily→1、work→2、smart→3 等语义映射，但**不能证明历史保存时的 UI 显示名称**。

建议基线保留当前可证明显示：数字按所属人字典解析、英文按原文保留，保留顺序，不自动把 daily 与 1 合并，不自动把私人旧标签公开为家庭字典。英文快照 source_id 为空、origin=LEGACY_LITERAL，记录 raw_token。用户主动替换后才使用当前可信来源。若希望把英文统一成中文、合并语义重复项，应作为单独的数据整理决定，不能从“同名候选合并”推导授权。

### 2.4 历史明细与当前衣物归属已经分离

全部搭配明细中 5 行与衣物当前所属人不同，穿着明细中 1 行不同；未删除明细中分别为 2 行、1 行。未删除穿着明细另有 3 行对应的衣物已逻辑删除。

原衣物仍有物理行，不存在 item_id 完全缺行，但这并不恢复当时归属。已有 ADR 0003 也明确：所属人转移不修改历史搭配/记录快照。因此，不能通过 JOIN wardrobe_item 的当前 user_id 给所有旧明细确定私人字典来源。品类/款式在本地没有任何个人行，可以冻结标准内置名称而不猜用户来源；将来若其他环境存在私人自定义项且缺历史归属，必须单列异常。

### 2.5 不能承诺重建历史改名

未发现衣柜字典名称审计表；有 1 行已删除风格“利落”，但没有 previous_id 版本链。旧 BaseDictServiceImpl.update 原地更新名称，且旧模板脚本按编码更新所有用户的四类名称。即便此库大部分 update_time 未变化，也不能据此证明名称从未被覆盖。

本轮没有读取备份或 binlog，也没有尝试恢复历史。可以证明当前模板与当前客户端一致，以及当前个人数字引用唯一；无法证明每条旧记录首次保存时的历史原名。

## 3. 代码调查：必须纳入实施的差距

| 位置 | 事实 | 设计处理 |
|---|---|---|
| 小程序 wardrobe-helper.js | 当前按查看人缓存解码，空列表回退默认，未知 token 原文显示 | 历史用 VO 快照，新选择用所属人上下文；初始化后空列表不回退 |
| WardrobeItemServiceImpl.add/batchAdd/update | 收 category/itemStyle、colorName 和原始标签串，直接复制保存，没有字典来源授权与快照校验 | 新契约携带来源 ID，业务层统一解析并写快照；非字典更新保留原快照 |
| WardrobeOutfitServiceImpl.update（107–114） | 每次更新都删除并重建明细，重新读取衣物 | 按保留的明细身份保留原快照，只对新增/替换部分读取当前衣物；不能只把旧 itemIds 传回 add |
| WardrobeOutfitServiceImpl.copy（127–138） | 将旧明细 itemIds 传回 add，重新取当前衣物数据 | 复制可信原明细快照；保留既有衣物可用性/归属检查 |
| WardrobeWearRecordServiceImpl.copy（140–151） | 同样回到 add；含 outfitId 时会重读对应搭配 | 从原记录复制保留部分，不能用后来改过的搭配或衣物覆盖旧快照 |
| WardrobeWearRecordServiceImpl.markRecordWorn（227–234） | 当前只改状态并使用已存明细计算穿着次数 | 保留这条路径，不重新解析字典；同时回归幂等与原权限 |
| WardrobeOutfitServiceImpl 固定 CATEGORY_* | 规则使用 1/2/3/6/7/8/9/10 等标准码 | 使用独立搭配语义键，不能直接用 source_id 代替 |
| WardrobeAssistantServiceImpl.getDictList（720） | 字典为空或异常会回退硬编码；BaseDictClient 只带 dictType | 改为有实际业务授权上下文的批量候选，不将失败或空集当默认项 |
| BaseDictServiceImpl 注册/修复 | 衣柜仍按通用模板补齐，可能重新插入用户删掉的项 | 衣柜专用初始化状态与五类管理入口，阻断旧修复路径复活 |
| base_dict 通用更新/同步 | 能原地改名、管理员同步 | 五类迁出后统一阻断旧管理写入，不能只隐藏页面 |

读取这些服务即能确认差距，但本轮没有执行它们，没有将静态分析标为 API 或 UI 验收通过。

源码入口：[小程序 helper](../../../../pagesWardrobe/wardrobe/wardrobe-helper.js)、[衣物表单](../../../../pagesWardrobe/wardrobe/item-form.js)、[衣物服务](../../../../../iw-mixes-server/iw-packaging-parent/iw-wardrobe/src/main/java/com/itwray/iw/wardrobe/service/impl/WardrobeItemServiceImpl.java)、[搭配服务](../../../../../iw-mixes-server/iw-packaging-parent/iw-wardrobe/src/main/java/com/itwray/iw/wardrobe/service/impl/WardrobeOutfitServiceImpl.java)、[穿着服务](../../../../../iw-mixes-server/iw-packaging-parent/iw-wardrobe/src/main/java/com/itwray/iw/wardrobe/service/impl/WardrobeWearRecordServiceImpl.java)、[AI服务](../../../../../iw-mixes-server/iw-packaging-parent/iw-wardrobe/src/main/java/com/itwray/iw/wardrobe/service/impl/WardrobeAssistantServiceImpl.java)、[通用字典服务](../../../../../iw-mixes-server/iw-packaging-parent/iw-auth/src/main/java/com/itwray/iw/auth/service/impl/BaseDictServiceImpl.java)、[旧模板脚本](../../../../../iw-mixes-server/iw-packaging-parent/iw-wardrobe/scripts/iw-wardrobe-dict.sql)。

## 4. 旧请求与入口调查

当前小程序 api/wardrobe.js 全部调用裸 `/wardrobe/**`；api/request.js 只添加会话 header，没有衣柜业务契约版本。item-form 和 item-batch 发送编码/原始 CSV，编辑器发送 itemIds；控制器无衣柜契约版本校验。代码因此能说明“旧请求不能表达来源与快照”，不能说明当前线上具体有多少旧用户。

仓库 Nginx 仅定义 auth/bookkeeping/eat/points/external 等前缀，没有裸 /wardrobe 规则。iw-core 本地直接映射裸 Controller，使本地直连可用，但不能据此证明线上入口可用。新衣柜 API 推荐统一 `/auth-service/wardrobe/**`，经过已有去前缀规则后仍命中 `/wardrobe/**` Controller，不额外发明裸路由。真正上线前需核对实际生产 Nginx/外部入口；本轮未访问生产。

入口证据：[衣柜 API 封装](../../../../api/wardrobe.js)、[请求封装](../../../../api/request.js)、[仓库生产 Nginx](../../../../../iw-mixes-server/deploy/nginx/iw-mixes-server.conf)、[本地兼容入口](../../../../../iw-mixes-server/iw-packaging-parent/iw-core/src/main/java/com/itwray/iw/core/localgateway/LocalGatewayCompatibilityFilter.java)。

技术推荐：衣柜请求携带 `X-IW-Wardrobe-Contract: 2`，来源 ID/显式字段变更使用 v2 请求。新后端在迁移切换后明确拒绝缺少新契约的衣柜业务写入，返回“请更新客户端后重试”；旧 API 不能根据同名项或码猜家庭来源。对旧读若保留兼容，也不能声称它能正确显示快照——旧 helper 仍会解码当前字典。推荐新功能切换后对旧衣柜业务入口整体提示升级，其他业务不受该业务级门槛影响。该兼容政策是推荐，尚未从本地代码推导为用户已批准的发布决定。

发布顺序：预检与冻结写入 → 备份 → 增量结构与基线回填 → 服务端新契约与业务门槛 → 新小程序与 Web 兼容 → 验证后开放新契约写入。保留旧列用于追溯，不能新 ID/旧码混写。数据迁移后不能直接回滚到只懂编码的应用；恢复必须使用原批次备份和写入切换方案。

## 5. 当前需要用户决定的第一件事

**是否以迁移时可证明的当前显示作为旧数据的名称快照基线？**

推荐：品类/款式按已核对一致的内置名称冻结；数字标签按该记录所属人当前唯一字典来源冻结；旧英文 token 原文保留，来源未知处允许空 source_id 并写清来源标记，保留旧值用于追溯。从切换后开始严格保证快照不受字典变动影响。

这保持当前可见内容，既不把新建来源伪装成历史选择，也不未经确认翻译/去重旧标签。若要求还原最初保存时名称或统一英文中文，需要历史证据或单独的清洗规则。本轮没有执行任何基线回填。

用户确认这一项后，再依次确认新旧客户端的切换政策；不把两个业务取舍合成一个审批问题。技术表结构和锁顺序由实施方按技术契约处理，无需用户选择 SQL 细节。
