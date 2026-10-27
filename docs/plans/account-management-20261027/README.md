# 账号管理与应用分类：设计草案

日期：2026-10-27。主仓库：iw-mixes-app-wx。

设计状态：用户于2026-10-27回复“按照此方案开始实施”，据此确认本方案及图标修订并授权实施。实施状态：后端、小程序、Web已完成实施，用户已追加授权按仓库本地提交；验证结果与限制见[实施自验记录](../../acceptance/account-management-20261027/README.md)。原型与真实验收证据分开保存。

## 1. 目标与范围

用户已提出：把最后一个用户字典“应用账号-应用分类”迁到账号管理页面下维护，不再单列设置菜单；账号管理页面需要更符合现代微信小程序的样式。未来废弃字典管理菜单，把管理员字典也移到对应业务设置并区分角色。

前期已交付设计、示例图和交互原型；用户确认后，本轮已实施对应代码。未来管理员字典迁移是方向，不纳入本次页面重构。菜单整体废弃要等管理员各项都有维护入口后再处理。

影响端：

| 项目 | 推荐后续实施范围 |
| --- | --- |
| 小程序 | 账号列表、账号新增/编辑、应用分类维护；从通用字典移除2010入口、拦截旧编辑链接 |
| 后端 | 支持合并搜索、分类引用数量、停用名称解析、受引用删除限制和个人归属校验；分类写入收口到业务接口 |
| Web | 若实施完整迁出，通用字典页同步移除2010并引导新入口；账号消费点与名称规则保持一致。Web页面尚未专门调研，不承诺只改一处即可完成 |

## 2. 设计资料

- [三屏风格示例图](assets/concept.png)：内置 imagegen 生成，用于评审视觉方向，示例数据虚构。
- [账号列表图标修订版](assets/concept-icons-v2.png)：2026-10-27按用户反馈重新设计复制/查看密码入口，作为这两处操作的最新视觉建议；复制用16px双页轮廓，查看密码用18px眼睛轮廓配“密码”文字，移除紧邻的箭头。HTML原型同步改为本地SVG，不使用Unicode占位符。点击区域分别为32px、44px高。原图留作历史参考。[图像编辑提示词](ICONS-V2-IMAGE-PROMPT.txt)。尚未修改业务小程序。
- [新增账号与分类选择示例图](assets/add-account-concept.png)：2026-10-27按用户追加请求补充，左侧为独立新增页，右侧为分类选择弹层；以原三屏图为风格参考，使用内置imagegen生成。[生成提示词](ADD-ACCOUNT-IMAGE-PROMPT.txt)。这是设计示例，尚未作为独立账号页接入HTML原型或小程序；不构成设计确认。
- [可点击原型](prototype.html)：本地HTML；内存模拟，不连接接口；刷新重置。
- 原型实际截图：[账号列表](assets/prototype-home.png)、[应用分类](assets/prototype-categories.png)、[改名弹层](assets/prototype-editor.png)。截图为浏览器渲染，不是微信小程序实机截图。
- [最新账号列表原型截图](assets/prototype-home-icons-v2.png)：已刷新浏览器检查SVG显示、文字与间距，点击复制后只出现模拟提示，点击密码打开对应账号面板；未触发账号编辑，未读取真实密码。
- [图片生成提示词](IMAGE-PROMPT.txt)。概念图里的分类图标仅作装饰，不新增用户图标选择字段；实现可使用统一的本地图标或保持原型的纯文字列表。

入口：菜单 → 账号管理 → 筛选区右侧“管理分类” → 应用分类。

不增加只有一项的“账号设置”中间页；现阶段直接进入应用分类更短。未来账号模块确实有多项设置时再评估统一设置入口。

## 3. 页面与操作

### 账号列表

顶部合并为一个“搜索应用名称或地址”的搜索框，按名称或地址匹配；不能把同一个关键词同时填到旧接口的name和address中，因为旧查询会按AND组合。右侧“筛选”保留精确地址等组合查询需求，弹层内有应用/重置。

第二行是可横向滚动的分类标签，“全部”固定第一项，“管理分类”固定右侧，不随标签滚出屏幕。切换分类保留关键词；返回列表保留分类与关键词。已停用但仍有账号引用的分类仍可用于查找，标注“已停用”；“未分类”按实际数据出现。分类只影响筛选，不改变账号归属。

列表采用单个白色圆角分组与细分隔线。每行：应用首字或本地标识、名称、轻量分类标签、账号与复制按钮、地址副文本、独立查看密码图标。去掉重复的“应用地址：”“账号：”“分类：”前缀。长名称/账号可换行，右侧动作不被挤走；复制、查看密码均阻止冒泡到编辑页。首字图标不自动请求网站favicon。

底部固定“＋ 新增账号”，与滚动区分开并适配安全区。数量取服务端全量total，不用当前页条数冒充总数；加载更多沿用分页。

密码默认不在列表展示；点眼睛沿用独立读取路径，显示底部查看面板，提供复制/关闭。返回、关闭、离开页面及切后台清理面板明文；失败不能伪装成空密码。原型只演示遮蔽文本，复制只提示，不访问系统剪贴板。

### 应用分类

只展示个人范围说明“仅自己管理，用于我的应用账号”，没有家庭切换。分类与账号继续按本人归属，不因管理员身份变成所有用户数据。未来若增加系统默认模板，另设管理员专属区域并在服务端鉴权。

启用区右侧“排序”，行内只有名称、引用账号数量和更多按钮；点名称改名。更多中提供修改名称、停用/启用、删除。停用分类折叠，与最近三个设置页一致。底部固定“＋ 新增分类”。

新增/改名沿用底部表单，字段为分类名称，不让用户填写字典类型、编码、父级、同步全员等技术字段。推荐1–32字符、首尾去空白、同一用户重名校验包含停用项；这些校验需在业务接口明确，不能声称旧字典接口已经具有全部规则。

排序进入独立草稿模式，取消不提交、完成提交一次；提供手柄与上移/下移，原型仅演示按钮排序，正式拖动沿用现有设置页能力。

### 新增与编辑账号

推荐重构现有独立编辑页，用“应用信息 / 登录信息 / 备注”的清晰分组，固定底部保存；字段仍为名称、地址、账号、分类、密码、备注。密码修改继续遵守“留空不修改”，删除放到编辑页底部次级危险操作，不挤占列表。

分类选择用底部列表，可快速新增并选用；关闭选择器、分类新增失败、返回编辑都保留账号草稿和密码输入，不自动保存账号。新增分类成功不等于账号已保存；之后取消账号编辑，新分类仍存在。复杂账号表单保留独立页，原型为了演示入口使用可滚动弹层，不能直接当作正式页面层级。

分类允许不选择，展示为“未分类”；“未分类”是兜底状态，不是可维护字典项。真实库验证确认账号type非空且历史使用0表示未分类，因此服务端把未选择归一为0；查询兼容历史NULL和0，已有0号字典项不再列为可维护分类，不改写存量账号。编辑已有账号时展示其原分类，即使停用；不主动切换分类时可以保存其他字段。

## 4. 已采用的分类规则

| 操作 | 推荐行为 | 理由 |
| --- | --- | --- |
| 改名 | 关联账号同步展示新名称 | 账号是持续维护的当前资料；现有数据按type解析名称，保留这一心智 |
| 停用 | 原账号保留名称；新账号不可选，编辑原账号允许保留 | 避免整理分类时破坏已有记录 |
| 删除 | 引用数量大于0时拒绝，提供“查看相关账号”；无引用时二次确认后删除 | 防止账号分类丢失；不静默批量改归属 |
| 排序 | 影响分类管理、选择器、筛选标签顺序；不改变账号排序 | 各处次序统一 |
| 权限 | 本人维护本人分类，管理员无权借此修改他人账号/分类 | 延续个人资料边界 |

本方案不默认引入家庭共用分类，也不照搬账单/衣柜的历史名称快照。若用户希望改名后旧账号仍保留旧名，就需要另行设计快照与迁移，不能只改UI。

## 5. 实施前源码核查事实（历史基线）

核查基于2026-10-27磁盘现状，无数据库查询、无服务启停。

| 文件 | 当前事实 |
| --- | --- |
| [账号列表](../../../pagesBase/base/account-manage.js)、[布局](../../../pagesBase/base/account-manage.wxml) | 两个搜索输入name/address，分页size=10；列表没有分类筛选；名称通过通用dictStore按2010解析；已有查看密码/复制 |
| [账号编辑](../../../pagesBase/base/account-detail.js)、[布局](../../../pagesBase/base/account-detail.wxml) | 分类使用缓存picker；字段包含备注；编辑密码留空，updatePassword按输入判断 |
| [API](../../../api/base.js) | 完整入口为/auth-service/application/account/page、detail、add、update、delete、viewPassword；通用字典CRUD仍由/auth-service/dict承接 |
| [字典缓存](../../../stores/dict.js) | AUTH_APPLICATION_ACCOUNT_TYPE=2010 |
| [菜单](../../../pages/menu.js)、[通用管理](../../../pagesBase/base/dict-manage.js)、[通用编辑](../../../pagesBase/base/dict-detail.js) | 2010仍在通用字典维护范围；记账/衣柜/厨房类型已排除 |
| [衣柜管理模板](../../../pagesWardrobe/wardrobe/dictionary-management.wxml) | 已有启用/停用折叠、独立排序、底部新增和弹层，可复用交互设计；不能直接复制家庭权限语义 |
| [后端分页DTO](../../../../iw-mixes-server/iw-packaging-parent/iw-auth/src/main/java/com/itwray/iw/auth/model/dto/ApplicationAccountPageDto.java) | 已支持type、name、address，没有keyword参数 |
| [后端服务](../../../../iw-mixes-server/iw-packaging-parent/iw-auth/src/main/java/com/itwray/iw/auth/service/impl/BaseApplicationAccountServiceImpl.java) | type等值，name/address模糊匹配，条件按AND组合，默认id倒序 |
| [账号实体](../../../../iw-mixes-server/iw-packaging-parent/iw-auth/src/main/java/com/itwray/iw/auth/model/entity/BaseApplicationAccountEntity.java) | 分类只有type编码，没有分类名称快照字段 |
| [通用字典服务](../../../../iw-mixes-server/iw-packaging-parent/iw-auth/src/main/java/com/itwray/iw/auth/service/impl/BaseDictServiceImpl.java) | 通用全量字典缓存查询仅返回启用项；需要补充停用分类名称展示能力，不能沿用缓存后让原分类变成裸数字 |

工作区已有厨房设置相关未提交/未跟踪改动，本轮未覆盖。后端git status --short为空。未调查线上运行版本；本方案不把旧会话验收结果作为当前功能证明。

## 6. 已实施契约与文件

完整HTTP前缀均为 `/auth-service/application/account`。保留账号原有CRUD和密码读取路径，分页增加keyword（名称OR地址）、unclassified；type和address与keyword按AND组合。列表/详情增加typeName，涵盖停用项。账号所有查询和修改显式限定当前用户。

| 路径 | 方法 | 入参/行为 |
| --- | --- | --- |
| /categories | GET | items（id、code、name、enabled、revision、accountCount）、scopeVersion、unclassifiedCount |
| /categories | POST | name、scopeVersion；返回item，保留既有2010类型，新编码从包含已删除历史的最大编码递增 |
| /categories/{id}/name | PUT | name、revision、scopeVersion；原ID/编码改名 |
| /categories/{id}/status | PUT | enabled、revision、scopeVersion |
| /categories/{id} | DELETE | query revision、scopeVersion；有引用拒绝，无引用逻辑删除 |
| /categories/order | PUT | 完整ids、scopeVersion；含停用项，集合必须一致 |

分类写入与账号新增/修改/删除在事务内锁定同一个auth_user行，串行化引用校验；角色不绕过个人归属。无需DDL或快照迁移。previous_id使用NULL以符合现有唯一约束。通用字典2010的列表/类型/旧CRUD已收口；修复字典流程不补回已删除的个人分类。账号路径跳过HTTP请求/响应正文日志，防止记录密码。

小程序修改account-manage、account-detail，新增account-category-settings、account-common.wxss、api/account-categories.js和static/account/copy.svg、eye.svg；app.json注册新页，旧字典两页排除2010。账号编辑是独立页，分类编辑是底部弹层；新增成功但刷新失败的重试只读，不重复新增。列表按请求序号和会话隔离，密码面板关闭/隐藏清理且忽略迟到响应。

Web账号页改用专用分类接口和typeName，保留停用类别及当前选择；旧字典列表/表单排除2010并提示小程序入口。保留其它管理员字典菜单。本轮未增加Web分类维护页。

## 7. 验证结果

[完整实施自验记录与证据](../../acceptance/account-management-20261027/README.md)。已完成真实MySQL接口验证、微信开发者工具原生操作、后端编译/打包与单元测试、小程序路由/语法及行为回归、Web类型与构建。原型不作为业务验收证据。

真机键盘/中文输入法、多用户真实越权、长列表拖动和Web登录后交互仍未完整覆盖。默认18000旧实例尚未重启加载本次构建；隔离18003的接口验证与原生联调已完成，临时测试数据已通过正常接口清理，临时端口实例已结束。

## 8. 授权与接续

已授权本地实施、可执行验证及本轮按仓库本地提交；未授权推送、生产写库或发布。既有厨房设置改动均保留。详见[实施自验记录](../../acceptance/account-management-20261027/README.md)。

> 使用 iw-feature-handoff，读取 /Users/wangfarui/workspaces/wfr/iw-mixes_ai/iw-mixes-app-wx/docs/plans/account-management-20261027/README.md 和 docs/acceptance/account-management-20261027/README.md。用户已确认并授权实施，当前代码已完成，不重做设计。先复核AGENTS.md、三个仓库已有改动和当前运行版本，保护厨房设置等原有修改；沿已有契约补验真机键盘/输入法、拖动排序与多用户隔离、Web登录后交互。默认18000旧实例未在本轮成功重启；此前18003为隔离验证且临时实例已结束，不继承其服务状态。基线是实施前历史指纹，不用于回滚。未经授权不提交、推送、生产操作或发布。
