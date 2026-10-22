# 整体方案复核记录

日期：2026-10-22。对象：[主方案](README.md)、[技术契约](investigation-20261022/TECHNICAL.md)、用户回传的[生产结果](production-readonly-20261022/RESULTS.md)及当前三端相关源码。模式：设计复核与实施准备；不是业务代码变更审查，也不是功能验收。

## 1. 结论

已确认的产品方向可以落到现有模块结构，无需增加新的产品选择题。采用衣柜专用字典能力、个人/家庭独立来源、业务名称快照和受控迁移；与记账字典复用思想及公共无状态能力，保持其现有约束不变。

本轮把原方案中尚不够具体的初始化、局部更新、明细保留、历史筛选、请求版本和迁移切换补成[实施清单](IMPLEMENTATION.md)。这些是技术方案补全，不标记为已经实现。整体方案是可供实施评审的工程基线，用户尚未确认整体稿或明确要求编码；本轮“下一步”按此前所述阶段落实为整体方案复核。

## 2. 复核发现与处理

| 编号 | 复核事实/缺口 | 已补到方案的处理 | 验证状态 |
|---|---|---|---|
| R-01 | 搭配与记录的update删除全部明细后重建，copy经add重新读取物品/搭配；会违背保留名称规则 | 明确缺省保留、detailId保留、itemId新加、明细集合版本；复制直接取可信原对象快照，换搭配须显式表达 | 源码事实已复核；新行为未实施 |
| R-02 | 当前DTO/Bean复制不能天然区分JSON缺省与null，旧表单整包回传编码 | 规定presence-aware patch；缺省保留、null/[]清空、品类必填；只刷新明确变化字段 | 请求语义已补齐；反序列化及数据库行为未验证 |
| R-03 | 生产那条不同所属人的明细，不一定是转交；当前搭配选择已支持家庭可见衣物 | 不推断转交历史；旧码按各行归属建立迁移解析基线，新增明细直接复制所选衣物真实快照；同名不合并数据库来源 | 候选唯一/同名由用户回传；原始来源仍不可证明 |
| R-04 | 技术契约有显式初始化方向，但缺少入口、生命周期和只读成员缺状态处理 | 补注册/家庭创建/已有数据迁移钩子、受鉴权幂等初始化POST；状态缺失与真正删空区分 | 接入位置已查；初始化/角色并发未实现 |
| R-05 | 专用请求头不在仓库Nginx允许头中；小程序get/post/put封装不透传options | 衣柜专用request包装传header，Nginx补白名单；统一/auth-service/wardrobe入口，分别验证本地与生产实际路由 | 仓库配置已查；实际生产入口/版本未核实 |
| R-06 | 旧列表/筛选/自动搭配仍消费编码/默认数组；只新增保存字段会留下错误旧视图 | 新增候选与历史筛选分离，统计按快照；规则读matchKind；AI输出来源并保存时重校验；整个消费链就绪才切换 | 影响面已定位；全部消费点仍待实施验证 |
| R-07 | 新增列“存在即跳过”、DDL失败后统一ROLLBACK、重新按当前字典覆盖已回填行均不可靠 | 比对结构定义、批次/原值摘要和解析审计；分阶段幂等；已回填结果只核验不刷新；分新写入前/后的恢复边界 | 执行设计已补齐；无迁移脚本/演练结果 |
| R-08 | 生产P30/P32同连接但只读值为0，不能证明一致性快照 | 保留未解释事实；正式执行前核实工具的事务行为或在可核验停写窗口采集；不为产品决策继续反复索要查询 | 原因未确定，不标通过 |

R-03的关键依据是WardrobeOutfitServiceImpl.querySelectedItems显式按resolveVisibleOwnerIds(false)选择衣物，而明细主记录所属人可以是操作用户。当前数据本身只能证明归属不同，不能证明发生过一次转交。此修正不改变用户已确认的名称迁移政策。

## 3. 源码与实施定位

| 源码入口 | 复核要点 |
|---|---|
| [WardrobeItemServiceImpl](../../../../iw-mixes-server/iw-packaging-parent/iw-wardrobe/src/main/java/com/itwray/iw/wardrobe/service/impl/WardrobeItemServiceImpl.java) | add/batchAdd/update接入来源与快照；保留updateByIdAndOwner并发所属人保护；列表/detail/tags不再用旧码解名 |
| [WardrobeOutfitServiceImpl](../../../../iw-mixes-server/iw-packaging-parent/iw-wardrobe/src/main/java/com/itwray/iw/wardrobe/service/impl/WardrobeOutfitServiceImpl.java) | add/update/copy/saveOutfitItems/querySelectedItems、fillOutfitDefaults、规则推荐按快照改造；编辑保留明细 |
| [WardrobeWearRecordServiceImpl](../../../../iw-mixes-server/iw-packaging-parent/iw-wardrobe/src/main/java/com/itwray/iw/wardrobe/service/impl/WardrobeWearRecordServiceImpl.java) | add/update/copy/resolveRecordItems/saveRecordItems/markWorn/markRecordWorn；复制不重读原搭配，状态流转不刷新名称 |
| [WardrobeAssistantServiceImpl](../../../../iw-mixes-server/iw-packaging-parent/iw-wardrobe/src/main/java/com/itwray/iw/wardrobe/service/impl/WardrobeAssistantServiceImpl.java) | 候选所属人、来源ID、过期/父子校验，图片任务不回写字典 |
| [AuthFamilyGroupServiceImpl](../../../../iw-mixes-server/iw-packaging-parent/iw-auth/src/main/java/com/itwray/iw/auth/service/impl/AuthFamilyGroupServiceImpl.java) | add在现有initializeFamily附近接衣柜初始化；与角色/退组写入锁顺序一致 |
| [BaseDictServiceImpl](../../../../iw-mixes-server/iw-packaging-parent/iw-auth/src/main/java/com/itwray/iw/auth/service/impl/BaseDictServiceImpl.java) | 通用CRUD与模板同步屏蔽五类；注册initDictData/copyMissingVisibleDictData排除旧复制方式，接衣柜专用初始化 |
| [BookkeepingDictionaryService](../../../../iw-mixes-server/iw-packaging-parent/iw-auth/src/main/java/com/itwray/iw/auth/service/impl/BookkeepingDictionaryService.java) | 参考锁、家庭初始化与版本；不扩充其Type或改变现有记账语义 |
| [UserDataPermissionHandler](../../../../iw-mixes-server/iw-web/src/main/java/com/itwray/iw/web/core/mybatis/UserDataPermissionHandler.java) | 来源/历史SQL显式授权owner与family范围，不能只依赖默认本人过滤完成家庭业务鉴权 |
| [现有衣柜表结构脚本](../../../../iw-mixes-server/iw-packaging-parent/iw-wardrobe/scripts/iw-wardrobe-init.sql) | category是TINYINT，item_style是SMALLINT UNSIGNED；业务新来源必须独立INT列 |
| [记账增量结构脚本](../../../../iw-mixes-server/iw-packaging-parent/iw-bookkeeping/scripts/dictionary-snapshot-v2/01-schema.sql) | 保持记账active_name_key及唯一键定义；只借鉴增量流程，不重放记账迁移 |
| [生产Nginx模板](../../../../iw-mixes-server/deploy/nginx/iw-mixes-server.conf)、[本地Nginx](../../../../iw-mixes-server/deploy/nginx/iw-mixes-server.local.conf) | 核验/auth-service入口，补新契约头白名单；模板不当作真实线上配置 |
| [小程序衣柜API](../../../api/wardrobe.js)、[request封装](../../../api/request.js) | 旧裸/wardrobe调用统一规范路径并带契约标识；get/post/put当前不透传options，专用包装需实际生效 |
| [衣柜helper](../../../pagesWardrobe/wardrobe/wardrobe-helper.js)、[衣物表单](../../../pagesWardrobe/wardrobe/item-form.js)、[搭配编辑](../../../pagesWardrobe/wardrobe/outfit-editor.js)、[记录表单](../../../pagesWardrobe/wardrobe/wear-record-form.js) | 当前默认选项/整包旧码/itemIds需切到候选、快照、patch及原明细保留；包含其批量/AI/筛选调用链 |
| [Web字典表格](../../../../iw-mixes-web-platform/src/views/dict/components/DictManagementTable.vue)、[Web字典表单](../../../../iw-mixes-web-platform/src/views/dict/components/DictForm.vue) | 仍有衣柜款式父品类逻辑；五类迁出后清理相应入口/旧链接，保留其他字典功能 |

旧衣柜Controller内部路径仍为`/wardrobe/...`，本轮没有改名；下表是其已存在业务方法，不把计划的新字典接口混在现有能力中。实施时保留方法后缀，前端统一加/auth-service入口前缀。

| 当前Controller | 现有后缀 |
|---|---|
| /wardrobe/item | POST add、batchAdd、page；PUT update；DELETE delete、optimized-image/delete；GET detail、tags |
| /wardrobe/outfit | POST add、copy、page、markWorn；PUT update；DELETE delete；GET detail |
| /wardrobe/wear-record | POST add、copy、month、markWorn；PUT update、markRecordWorn；DELETE delete；GET detail、today |
| /wardrobe/statistics | GET overview |
| /wardrobe/assistant | POST suggest、item-draft、item-image/optimize/start、item-image/optimize/retry；GET item-image/optimize/status、item-image/optimize/latest |

## 4. 当前证据与保留的执行检查

生产已回传的数据规模/唯一候选/同名边界可支撑已确认的迁移政策。未回传的完整字段/索引定义、家庭有效状态/角色并发、所有旧品类码的搭配归类断言、真实生产网关与运行版本，仍是正式预检/上线检查，不能写作已通过。

本轮三个仓库检查：后端main、Web dev无已跟踪/未跟踪改动；小程序main仅本需求docs/plans/wardrobe-settings-20261021目录未跟踪，内容为设计、原型、截图、调查与SQL结果。无暂存业务变更。原[BASELINE.json](BASELINE.json)保留；本轮新增复核依赖的补充指纹见[REVIEW-BASELINE.json](REVIEW-BASELINE.json)，不能用它覆盖原基线或解释为恢复授权。

本轮仅做源码/配置复核和资料校验；没有编译、数据库写入、接口/并发/原生UI验收、微信管理后台改动或生产发布。主方案AC-01至AC-19和实施清单补充场景继续保持未执行。

资料检查结果：本目录7份Markdown逐份validate通过，无issue或warning；实施清单4段JSON请求/响应示例通过JSON解析；原基线16个文件与补充基线12个文件的check均返回UNCHANGED。这些只证明资料链接/示例语法/所选源码与仓库元信息的状态，不证明完整设计、迁移或功能已通过验收。

## 5. 接续方式

主方案第11节保留继续设计的提示词；若用户随后明确要求实施，使用下面的提示词，不重复已确认规则，也不自动创建新会话：

> 读取本目录README.md、IMPLEMENTATION.md、REVIEW.md、investigation-20261022/TECHNICAL.md与production-readonly-20261022/RESULTS.md，按用户后续实际授权接续。先复核三端AGENTS.md、原BASELINE.json和补充REVIEW-BASELINE.json及当前工作状态，保护已有改动。已确认规则不重问；本地测试库异常不作为生产清洗政策，生产只读事务未验证，不能声称已还原创建时原名。若本消息明确授权实施，则按I-01至I-07完成后端/小程序/Web、迁移脚本及自主自验，保留快照、权限、幂等与切换边界；普通工程选择自行处理，新业务冲突才逐项询问。涉及本地应用库/测试身份/隔离库写入时先按本次实施授权明确范围，后端启停只用scripts/local-backend.sh，Maven遵循固定路径/仓库规则。提交、推送、生产写入、发布及新会话消息均按用户明确授权；本提示词本身不追加这些权限。
