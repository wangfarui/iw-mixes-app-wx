# 厨房设置：开发契约、步骤与自验

设计定稿日期：2026-10-23。与[主方案](README.md)共同使用。产品行为已获整体确认；以下文件名、表名、字段和JSON形状为实施基准，可在不改变已确认语义的前提下按源码细化，无需重新询问常规工程选择。所有标注“新增”的文件和接口当前尚不存在。

## 1. 先复核，后实施

1. 阅读联合工作区及三仓库AGENTS.md，以及本包README、本文、PROMPT。
2. 依次核对BASELINE.json与BASELINE-HANDOFF.json，前者是调研基线，后者包含交接资料；差异先判断影响，不覆盖旧基线，不reset或清理已有工作。
3. 三仓库分别记录branch、HEAD、status。业务入口只有server、app-wx、web-platform。实现修改分仓库维护，本包未获提交或推送授权。
4. 先从源码确认所有3010/3011读写、模板复制、修复、缓存、家庭生命周期及业务表引用。数据库连接、DDL、回填和测试数据范围按实施会话真实授权执行；库名不能证明环境，先核对host。
5. 任何用户已确认的规则不再重问。只有真实数据无法唯一解析、发现未覆盖的业务消费者、改变产品语义、已有工作重叠无法隔离等实质问题才提出。

## 2. 模块与复用边界

- iw-auth：厨房字典管理、成员权限、模板与一次初始化、名称版本、集合版本；新增KitchenDictionaryService、KitchenDictionaryMapper、KitchenDictionaryController。
- iw-web：新增kitchen/KitchenDictionaryAccess窄接口，为iw-eat提供候选上下文和事务内可信来源锁定。可复用bookkeeping/DictionaryNames.normalize这一无状态名称函数，不扩大其业务类型判断。
- iw-eat：食材业务授权、来源验证与名称快照、历史筛选、切换契约；新增dictionary/KitchenSnapshotService、KitchenOptionsController、KitchenContractConfiguration等最小能力，或按现有风格合并。
- 不让iw-auth依赖iw-eat，不让厨房服务依赖衣柜服务，不复制衣柜父子树、搭配归类或多选标签快照。
- 管理前端参考衣柜最终布局与状态处理。优先在pagesEat内维护业务适配，不跨分包引用衣柜页面。若提取公共无状态能力，限定范围并回归原衣柜、记账设置。

## 3. 数据模型与不变量

### 3.1 字典

类型：CATEGORY=3010、SECTION=3011；范围：PERSONAL/FAMILY。复用base_dict的id、dict_type、dict_name、dict_status、sort、scope_type、user_id、family_group_id、previous_id、revision、deleted。

个人归属实际用户，家庭归属实际家庭，系统模板与家庭行不得混淆。以当前衣柜/记账已部署模型及真实DDL为准，先核对user_id=0、family_group_id=0的实际约定。不更改原类型编码，不将来源ID塞入dict_code。

名称规范：去首尾Unicode空白，1–32个码点；不修改内部空格、大小写、重音。未删除的同类型、同范围、同归属名称唯一，停用项也占用名称。数据库应按规范化名称的二进制值约束，避免默认collation与Java比较不一致。

推荐新增厨房专用生成列和唯一键：厨房类型且未删除时生成scope owner与名称二进制键；其他业务类型为NULL。唯一范围为dict_type + scope_type + 厨房scope owner + 厨房名称键。模板为独立owner=0，不与任何实际个人混用。生成列表达式和长度在MySQL结构预检后确定，不扩大记账或衣柜现有键。

新增kitchen_dictionary_scope_state，主键(scope_type, owner_id)，保存一次初始化标记及scope_revision。集合版本对厨房两类统一递增；版本对客户端是不透明字符串，不允许前端自行拼算。每行revision用于单项并发控制。

新增kitchen_dictionary_migration_state及baseline/resolution审计结构，记录阶段、批次、原码、原归属、解析来源、迁移时名称与异常。SCHEMA/READY为建议状态名；READY后不再重新解析覆盖已经保存的快照。

改名：旧项逻辑删除，新行新ID、previous_id=旧ID，保留归属、顺序和启停状态；同名无变化不换版本。启停/排序不换ID，删除仅逻辑删除；已删除或已替换来源不可重新启用。事务中锁定scope、复核权限、校验版本，成功后递增集合版本。

初始化：新注册个人、创建家庭与既有家庭迁移均接入厨房初始化；已有个人项保留，不能按“当前列表为空”判断应重新填默认。首次初始化、复制模板、状态写入在同一事务；家庭只填默认模板，不合并成员个人项。家庭删除/退出后的数据保留沿用现有生命周期，不让失效家庭来源再被新选。

### 3.2 食材快照

eat_fridge_food新增下列可空标量列，并同步Entity、DetailVo、PageVo、Mapper读写：

| DB列 / JSON返回 | 类型建议 | 语义 |
|---|---|---|
| category_source_id / categorySourceId | 与base_dict.id相同 | 分类真实来源；新选择必须可信且启用 |
| category_name_snapshot / categoryNameSnapshot | utf8mb4 VARCHAR(32) | 保存时分类名称，由服务端解析 |
| section_source_id / sectionSourceId | 与base_dict.id相同 | 分区真实来源 |
| section_name_snapshot / sectionNameSnapshot | utf8mb4 VARCHAR(32) | 保存时分区名称 |

分类、分区可空；清空字段应同时清空该字段来源和名称。存量未设置维持NULL，不生成“未分类”字典行。“未分类/未分区”仅是空值展示文案。旧category/section保留追溯，不再作为新写入或新筛选的权威来源。

任何source/name组合均由服务端生成或从已授权食材的原值保留；不接受客户端自报快照名。普通编辑先按现有数据权限查到真实记录并锁定，未修改的快照从数据库保留，不从过期客户端payload覆盖。改数量、日期、图标、名称及标记用完不刷新快照。

## 4. 管理API契约（计划新增）

入口统一为/auth-service/kitchen/dictionaries；Controller内部为/kitchen/dictionaries，沿用现有前缀转发，不新增裸路由。

| 方法/后缀 | 请求关键字段 | 响应data |
|---|---|---|
| GET /items | type、scope | items、canManage、scopeVersion、familyGroupId |
| POST /items | type、scope、name、scopeVersion、expectedFamilyGroupId | item、scopeVersion |
| PUT /items/{id}/name | name、revision、scopeVersion、expectedFamilyGroupId | oldId、item、scopeVersion |
| PUT /items/{id}/status | enabled、revision、scopeVersion、expectedFamilyGroupId | item、scopeVersion |
| DELETE /items/{id} | query: revision、scopeVersion、expectedFamilyGroupId | scopeVersion |
| PUT /order | type、scope、ids、scopeVersion、expectedFamilyGroupId | scopeVersion |
| POST /copy-personal | sourceIds、personalScopeVersion、familyScopeVersion、expectedFamilyGroupId | created、skipped、scopeVersion |
| POST /initialize | scope、expectedFamilyGroupId | scopeVersion |

item至少包含id、type、name、enabled、sort、revision、scope，不携带衣柜parent/matchKind。无家庭时管理页只显示个人；家庭接口明确返回无有效家庭，不把查询失败伪装为无家庭。所有请求以登录用户为actor，不接受任意userId管理私人项。

家庭写入逐次校验有效成员身份及群主/家长资格；expectedFamilyGroupId必须与实际当前家庭一致。排序提交本类型当前所有未删除项的完整唯一ID集合，包含停用项；缺项、重复、跨类型/跨scope/过期版本整单失败。复制只接受本人当前启用来源，家庭同类型同名含停用项跳过，返回逐项原因；创建新家庭项，不共享ID或后续同步。并发复制与改名由scope锁和唯一键共同保证。

错误沿用项目统一响应及BusinessException；用户可理解地提示无权限、家庭已变化、选项已更新请刷新、同名、名称非法、升级未就绪。不能吞异常报成功或把写成功后的读取失败当作写失败重试。

## 5. 食材API与前端状态契约

当前前端实际使用/eat-service/fridge/food/add、update、detail、page、delete、markAsUsed；保留方法与业务后缀，扩展字典字段。新增GET /eat-service/fridge/food/options和GET /eat-service/fridge/food/filters。

### 5.1 候选及新写入

options查询允许可选foodId；无ID为本人新增上下文，有ID先按现有权限校验食材再从真实userId建立上下文。本次不新增任意ownerUserId或代录权限。

返回建议：ownerUserId、familyGroupId、personalScopeVersion、familyScopeVersion、contextToken、categories、sections。每个候选返回真实sourceId、name、scope；只合并当前启用同名项，个人优先，不能以数值code去重。已保存来源单独保存在详情中，不因候选合并偷偷换成个人同名项。

创建使用dictionarySelection={categorySourceId: ID或null, sectionSourceId: ID或null}；需要验证新选择时携带dictionaryContext（上下文token及版本，以实现的窄接口为准）。两个字段不选均允许，名称在服务端生成。

更新使用dictionaryChanges对象，以JSON键是否存在表达局部修改：

| 字段表达 | 行为 |
|---|---|
| categorySourceId键缺省 | 保留服务端原分类来源及名称 |
| categorySourceId: null | 明确清空分类来源及名称 |
| categorySourceId: 整数ID | 主动重选，校验当前可用来源、上下文，再取当前名称 |

sectionSourceId完全相同。可以沿用衣柜JsonNode区分absence/null的方式；明确拒绝整对象null和错误类型，避免悄悄当作清空。重选同一个来源ID也必须由用户操作产生变更键。新来源不得自动沿previous_id追到后继项；过期上下文报错刷新。

dictionarySelection只在创建接受，dictionaryChanges只在更新接受；旧category/section不能与新选择混写。移除旧表单把完整detail展开后整体提交的习惯，显式组装业务字段和发生变化的字典字段。更新无字典变更时无需人为刷新当前选项去覆盖历史。

### 5.2 展示、筛选与缓存

- 列表和详情使用服务端快照；历史来源停用/删除仍显示保存值，picker找不到时保留历史提示且不默认第0项。
- filters仅从有权查看、符合现有逻辑删除策略的业务记录聚合，返回categories/sections历史名称。page新增categoryNameSnapshot、sectionNameSnapshot精确筛选；空字符串与未筛选的含义明确，不能退回旧code过滤。
- “全部”由前端表达，不作为普通名称提交。空值单独展示未分类/未分区；如提供空值筛选，使用显式布尔字段，避免与用户自建同名项冲突。
- 历史同名按规范化名称聚合，改名前后不同名分开；其他名称、日期、过期、分页、排序、用完/删除行为不变。不新增统计产品。
- 缓存按登录会话、实际所属人、当前家庭、scope版本隔离；更名、启停、删除、排序及复制后失效相关缓存。退出/换账号/换家庭清理；异步完成前比对请求序号与身份，拒收迟到数据。
- 表单区分加载、提交中、失败保草稿、成功刷新失败；成功后不重复写。退出未保存表单/排序提示放弃；个人/家庭切换清草稿与选中状态。

### 5.3 新旧客户端切换

新增厨房专用契约版本，建议X-IW-Kitchen-Contract: 1；只对厨房字典管理和/fridge/food/**生效，OPTIONS放行。旧衣柜头不能代用，其他厨房业务食谱/点餐/用餐不加门槛。

以READY状态及契约版本保证旧包不能用code向新模型写入，也不能读到需快照但自身按旧缓存错误解码的数据。没有新契约的冰箱请求提示重新进入小程序；不新建独立强制升级页面，不做长期双轨。为两类管理、食材业务、允许header的Nginx/CORS配置及所有客户端消费方同步实现。准备脚本不等于执行线上配置或发布。

## 6. 文件级实施清单

下表根路径按“后端/小程序/Web”解析到对应业务仓库；新增命名可微调，但责任和验收不缺项。

| 步骤 | 仓库/现有或新增文件 | 工作 | 完成证据 |
|---|---|---|---|
| K-01 | 后端iw-packaging-parent/iw-eat/scripts/dictionary-snapshot-v1/（新增） | preflight/schema/backfill/verify、恢复README和脱敏审计，先核对所有旧引用 | 缺源、歧义可阻断，DDL幂等、约束匹配，不输出隐私 |
| K-02 | 后端iw-web/src/main/java/com/itwray/iw/web/kitchen/（新增）；iw-auth的mapper/KitchenDictionaryMapper、service/impl/KitchenDictionaryService、controller/KitchenDictionaryController（新增） | 专用服务、锁、初始化状态和字典版本；只复用无状态名称函数 | 权限、同名、改名版本、并发初始化、排序、复制测试 |
| K-03 | 后端iw-auth的service/impl/BaseDictServiceImpl、AuthFamilyGroupServiceImpl；iw-web的BaseDictMapper/Entity及DictTypeEnum相关调用 | 旧管理全链拦截；注册、修复、管理员同步不复活；新建家庭初始化 | 两类不能旧写，其他类型不受影响；新老用户家庭初始化正确 |
| K-04 | 后端iw-eat的EatFridgeFoodEntity、AddDto/UpdateDto/PageDto、DetailVo/PageVo、EatFridgeFoodServiceImpl、EatFridgeFoodMapper.java/xml；dictionary专用能力（新增） | 快照、局部修改、来源锁、options/filters、业务级契约门槛 | 原名稳定；清空/重选准确；跨用户/家庭或过期来源失败 |
| K-05 | 小程序pagesEat/eat/kitchen-settings四件套、fridge-category-settings四件套、fridge-section-settings四件套、dictionary-management.js/wxml/wxss（均新增）；pages/menu.js、app.json、static/menus/kitchen-settings.svg（新增） | 两类设置、个人/家庭、底部布局、排序、弹层；图标使用既有SVG体系 | 原生入口、长列表、输入法、键盘、安全区及只读状态 |
| K-06 | 小程序api/kitchen-dictionaries.js、stores/kitchen-options.js（新增）；api/eat.js、pagesEat/eat/fridge/detail.js和index.js、eat-helper.js及相关wxml；stores/dict.js、app.js有关迁出缓存 | 新候选/快照/历史筛选，移除旧解码、清理缓存，局部改动payload | 改名后展示及筛选一致，无自动第0项、静态回填或串账号 |
| K-07 | 小程序pagesBase/base/dict-manage.js、dict-detail.js；Web src/views/dict/components/DictManagementTable.vue、DictForm.vue及必要dict store | 类型和旧链接收口、提示厨房设置；Web不另建设置页 | 3010/3011不可旧维护；其他餐饮字典正常 |
| K-08 | 后端deploy/nginx实际使用配置、API文档及新增测试；小程序scripts相应用例；本包验收记录 | header白名单、部署顺序、迁移/权限回归及本地UI | 见第8节，逐项记录当前实际结果 |

先完成可离线的源码与测试，实际库条件不明时不猜SQL。新代码就绪与真实库迁移分别记录，未READY时不开放新业务。先后端契约，再前端切换，旧入口与模板收口同批交付。

## 7. 迁移实施规格

计划新增00-preflight.sql、01-schema.sql、02-backfill.sql、03-verify.sql；不要直接复制执行衣柜脚本。

00应核查：MySQL版本/引擎/完整列和索引定义；3010/3011所有scope、模板、当前/停用/删除及历史版本；重复码名、Unicode规范；食材实际userId、空码/非空码、有效/逻辑删除记录的唯一解析覆盖；其他真实消费者。总行数及所有非空引用都要有可追溯结果。

存量按原食材userId + 类型 + 原code唯一解析迁移时来源和名称；不按操作人、当前家庭或模板猜测。已删除候选或多版本须证明唯一有效解析链，不能简单LIMIT 1；不能唯一确认即停止自动迁移并输出脱敏异常。分类分区空字段保留空。保留现有个人字典ID、旧码和全部业务行；现有家庭按已确认模板独立初始化。

写入前冻结食材、两类字典、注册默认复制、家庭初始化及相关管理员同步，备份受影响结构/数据/阶段。01 DDL可能隐式提交，出错不能承诺ROLLBACK全撤销；禁止--force。02在事务内回填快照、审计和一次初始化状态，异常回滚。03全部断言通过才设置/接受READY；重复运行不覆盖READY后的真实修改。

核验至少包括：业务总行数/逻辑删除总数不变；原字典ID和旧字段未被替换；非空原引用的快照与审计覆盖；来源类型与所有权；家庭模板数量与一次初始化；名称唯一键对其他域无影响；幂等；原空值为空；无新业务快照空洞。生产预检须重新获取，不复用本地数量。备份及原始逐行数据不得入仓库。

恢复：保持停写，根据批次审计与备份恢复成匹配的代码/数据版本；已经产生新ID/新写入时先制定增量恢复，不能仅回滚旧JAR、删除状态或重跑模板修复。生产执行、发布和环境改动单独授权。

## 8. 自验、运行与证据

本次真实业务用例均未执行。沿用主方案AC-01至AC-10，并额外确保以下断言：1/32码点及Unicode首尾空白可处理、33码点被拒；大小写/重音比较一致；改名返回新ID但旧快照不变；缺省/NULL/ID三态；停用同名复制跳过；完整排序集合校验；真实SQL权限不会因子查询/Join绕过；旧契约与跨域预检；家庭变动/无家庭/权限查询失败；READY后不再回填。

有意义的后端单元测试覆盖规则与事务分支；MySQL测试覆盖真实唯一键、并发初始化/改名和迁移幂等，条件不满足跳过必须单列。小程序可用VM脚本模拟迟到响应、保存成功读失败、未修改字段保留；真实工具覆盖输入法/键盘/拖动/长列表。不要用仅检查字符串存在的测试代替业务断言。

### 8.1 构建与服务

执行前检查JAVA_HOME/JDK17、MAVEN_OPTS、MAVEN_ARGS、JAVA_TOOL_OPTIONS及项目.mvn配置，不回显敏感值；冲突maven.repo.local时停止报告来源。使用显式非用户级settings，现有最小文件位于后端docs/acceptance/bookkeeping-dictionary-v2/evidence/maven-settings.xml，可读验证后复用，不修改其历史内容。

在后端仓库执行，以下为待执行命令：

```bash
JAVA_HOME="$(/usr/libexec/java_home -v 17)" \
PATH="$(/usr/libexec/java_home -v 17)/bin:$PATH" \
/usr/local/maven/apache-maven-3.8.6/bin/mvn \
  -s docs/acceptance/bookkeeping-dictionary-v2/evidence/maven-settings.xml \
  -Dmaven.repo.local=/usr/local/maven/repository \
  -pl iw-packaging-parent/iw-core,iw-packaging-parent/iw-external -am -DskipTests compile
```

运行直接相关新测试与既有回归，确认无失败；未匹配测试、跳过、条件测试不得算功能通过。需要启动时，用同一固定Maven/settings/仓库先对core执行package；已打包且确认JAR与本次源码一致后使用：

```bash
IW_LOCAL_SKIP_BUILD=1 scripts/local-backend.sh restart core
```

该脚本内部默认裸mvn不符合当前统一规则，因此避免让它执行构建；只使用其进程管理。external有现成服务且未改业务不重启。验证当前服务实际PID/启动日志/JAR更新时间和目标API，不能仅凭端口/旧健康结果。编译不足以证明API正常。

小程序运行npm run check:routes、目标JS的node --check、相关已有回归（bookkeeping-settings、wardrobe-dictionary-context）及厨房新增测试；使用微信开发者工具编译并操作目标UI，记录截图和工具版本。检查pagesEat分包资源归属及主包体积，避免再次将原型/截图等文档打入主包；文档不属于运行资产。

Web运行npm run type-check和npm run build；复用或启动本地dev服务，用真实浏览器检查字典列表、两类旧编辑链接及其他类型可用。测试账户与登录方式由实施会话当时可用授权决定，本包不保存账号密码，不继承旧衣柜测试账户授权。

### 8.2 测试数据与验收记录

当前只获交接授权，尚未创建、修改或清理任何业务测试数据。新会话收到用户发送的PROMPT后，可按其中明确指定的本地夹具范围执行；若未采用该范围，则从离线测试推进，不猜测既有数据可修改。

建议本地夹具范围：仅在已核实loopback测试实例中，以kitchen-settings-test标识新建的专用用户/家庭/字典/食材验证五类角色；只修改或清理本轮登记ID，不修改现有用户家庭或清空库/Redis。DDL和存量迁移须先备份，实际连接或存量条件未经授权不得执行；原型的内存模拟不需要此授权。不得未经许可创建新数据库或Redis实例。

新建docs/acceptance/kitchen-settings-实际日期/，记录代码版本、运行环境、case、预期/实际、脱敏输出、截图及残留ID；原生UI、真实API、SQL、静态构建分栏记录。没有执行的用例标记未执行/受阻及原因。不将本包HTML操作、衣柜历史记录或DOCUMENT_CHECK_PASS当作本次业务通过。

## 9. 完成条件

三端责任完成；迁移脚本具备停止/幂等/恢复；相关静态和构建检查无失败；授权环境下完成关键真实API、原生UI与Web入口验收，其他未覆盖项明确记录；数据残留可追溯。若数据库权限或环境使后续验收受阻，先完成不依赖它的实现与离线检查，准确交接剩余工作，不虚报完成。
