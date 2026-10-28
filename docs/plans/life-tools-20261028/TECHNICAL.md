# 生活工具：接口、数据与日期计算建议

本文件记录 2026-10-28 v0.1 方案的技术设计。后端与小程序已实施，实际落地及验证边界以[实施验收记录](../../acceptance/life-tools-20261028-r1/README.md)为准。

## 1. 模块与数据边界

已新建业务库 `iw-packaging-parent/iw-life`，由 `iw-core` 聚合，不增加进程。包含 wish、important-date、bookmark 三个领域内的小服务；公共能力只在模块内部复用，不扩建跨业务「通用工具平台」。应用账号仍由 `iw-auth` 现有实现负责。

core 当前组件扫描覆盖 `com.itwray.iw`；Mapper 扫描、XML 资源加载和模块依赖要用实际启动验证，不能只凭包名推断成功。现有 `/auth-service/**` 入口去前缀后进入 core，新 API 走 `/life/**` 即可，不扩展 Nginx 或本地兼容入口前缀。

三张新表：`life_wish`、`life_important_date`、`life_bookmark`。不复用 `base_website_navigation`，不复制 `base_application_account`，不迁移历史网站导航。数据字段沿用既有用户和基础实体约定：自增整型 ID、user_id、deleted、create_time、update_time；实际使用参数化 JdbcTemplate，而非继承实体或新增 Mapper。

所有新表不含 group_id、shared，不接入家庭共享查询。每条查询和写操作均显式附加当前认证 user_id 条件；更新／删除／详情／状态操作使用同一所有权校验。不接受客户端指定 owner/userId；即便管理员、家庭组角色或查询偏好发生变化，也不提供其他用户的私人记录。返回统一的「记录不存在或无权访问」，不透露是否真实存在。

创建表脚本需与最终 Entity／Mapper 一致；新增表在本地测试、生产执行是独立动作。本地 `iw_mixes` 已创建新表；生产 SQL 未执行。

## 2. 字段与约束

### 2.1 公共字段

- `title`：去首尾空白后 1～80 字符；`remark`：0～1000 字符，空值可清除。
- `revision`：整型，新增为 1，更新／状态／置顶均需携带并原子递增。
- `client_request_id`：新增幂等标识，1～64 字符，由客户端为一次创建生成，失败重试复用。每表 `UNIQUE(user_id, client_request_id)`，软删除后也不允许旧请求重新创建。
- 创建请求相同标识、相同业务载荷重试返回同一 ID；不同载荷拒绝，提示重新生成请求；若已删除则提示记录已删除。采用创建载荷摘要保证后续编辑不会影响原请求幂等判定，摘要不返回前端。
- 更新的可空字段显式 null 表示清除；布尔、日期、金额不能因为通用 Bean 拷贝或 MyBatis 忽略 null 而无法清空。更新 DTO 必须包含编辑表单的完整可编辑字段。
- 分页 `currentPage >= 1`、`pageSize = 1..50`，默认 20。新 DTO 显式添加上限，不改变全局 PageDto。
- 核心索引建议 `(user_id,deleted,...)` 分别覆盖状态、置顶排序；最终依据查询 SQL 和预期数据量确定，不盲目为每个筛选项建索引。

### 2.2 心愿 `life_wish`

| 字段 | 含义／约束 |
| --- | --- |
| estimated_amount | DECIMAL(10,2)，可空，0～99999999.99；0 与未填不同；超出两位小数拒绝而非截断 |
| target_date | 可空，公历目标日；过去日期允许，显示已超目标，不自动改状态 |
| priority | NORMAL／HIGH，默认 NORMAL |
| status | PENDING／FULFILLED／ARCHIVED，默认 PENDING |
| reference_url | 可空，最长 2048，HTTP/HTTPS URL |
| fulfilled_at | 仅当前 FULFILLED 非空，由服务端记录；恢复为 PENDING 清空 |

状态操作携带 `id, revision, action`；action 为 FULFILL／ARCHIVE／RESTORE。PENDING 可 FULFILL／ARCHIVE；FULFILLED、ARCHIVED 可 RESTORE；其他组合拒绝。独立状态接口防止普通更新混入状态字段；更新内容不隐式复活已删除或已搁置的记录。

### 2.3 日期 `life_important_date`

| 字段 | 含义／约束 |
| --- | --- |
| date_type | BIRTHDAY／ANNIVERSARY／EXPIRY／OTHER |
| calendar_type | SOLAR／LUNAR |
| event_year/month/day | 原始历法中的有效年月日，年份必填，产品支持范围建议 1901～2099 |
| leap_month | 布尔，默认 false；公历必须 false；农历按所选年验证该闰月是否存在 |
| repeat_type | NONE／YEARLY |
| remind_days | null 表示不提示；允许 0／1／3／7／30 |

下一次公历发生日、剩余天数、是否已过期、是否进入提示期由服务端动态计算，不以 cron 更新持久化倒计时，不根据客户端时钟改变业务日期。保存原始农历年月日和闰月标志，不能只存换算后的公历日期。日期计算服务可替换时钟，并封装历法依赖；前端只有格式化逻辑。

产品支持区间是本方案的目标，不能据此声称某第三方库已经支持。实施时验证仓库已有 Hutool 的历法能力；如果双向转换、闰月和范围测试不足，则选择成熟历法库，固定依赖版本并确认许可证。不要手写不完整的年份对照表。日期算法依赖选型属于实施技术选择，不需重新询问已确认的公历农历业务范围。

### 2.4 收藏 `life_bookmark`

| 字段 | 含义／约束 |
| --- | --- |
| url | 选填，未填写或清空保存为 NULL；填写时最长2048且为绝对HTTP/HTTPS URL，有合法host，无内嵌用户名密码；保留路径、查询和fragment |
| category | WEBSITE／ARTICLE／VIDEO／OTHER，默认 OTHER |
| pinned | 布尔，默认 false；置顶优先，同组创建时间和 ID 倒序 |

不持久化从远端抓取的标题、图标或摘要，不发起任意链接的服务器请求。域名展示从保存的 URL 解析。允许重复链接，因为不同收藏可能有不同备注。输入验证与创建请求幂等分别处理，不把 URL 当作幂等键。

## 3. 日期计算的精确定义

- 业务时区固定 `Asia/Shanghai`，基准为服务端当天 LocalDate；API 返回 serverToday，前端 onShow、主动刷新与跨日恢复时重新取数据。
- 公历一次性：发生日就是原始日期；农历一次性：转换原始农历年、月、日与闰月，得到一次公历发生日。已过期不自动删除。
- 每年重复：寻找不早于原始发生日、且不早于今天的下一次发生日；当天仍是本次发生日。未来起始年的事项不能错误地出现在更早年份。
- 公历 2 月 29 日：非闰年在 2 月 28 日发生，闰年仍按 2 月 29 日。原始日永远保留 2 月 29 日。
- 农历每年重复：以农历年份递进再转换为公历，不能简单给换算后的公历日期加一年。
- 原始闰月生日／纪念日：目标年存在相同闰月时使用该闰月；不存在则回退同名普通月。表单对闰月事项显示此规则，避免误认为只在有闰月的年份出现。
- 农历三十：目标年该月只有二十九时回退当月最后一天；有三十的年份恢复三十。回退结果不写回原始日。
- 若产品区间内找不到下一次发生日，返回 `OUT_OF_RANGE`、nextOccurrenceDate=null；列表明确提示「超出支持日期范围，请调整日期」，排在正常未来事项之后，不产生虚假日期或 500。
- 原始日期的合法性校验与重复时的月底回退不同：新增「实际不存在的某年某月三十」应拒绝，不能保存时偷偷改成二十九。
- `daysUntil = nextOccurrenceDate - serverToday`，按日历日期差计算，不把小时差除以24。
- 应用内提示：`remindDays != null && daysUntil >= 0 && daysUntil <= remindDays`；已过期的一次性事项不持续占用入口提示数量。
- 列表排序、30天筛选、提示总数必须在发生日计算后执行，不能先对原始年月日分页再换算。个人数据量小时可先取当前用户必要日期字段计算候选，排序筛选后分页；备注等详情字段按页批量加载。所有范围均限定当前用户，禁止全库扫描。
- 农历验证用与所选转换实现独立的可信基准样本；不能只做同一库的往返转换就判定准确。至少覆盖春节前后、闰月有无、大小月、范围两端和目标年跨公历年。样本来源、依赖版本和预期在实施测试记录中写清。

## 4. 计划新增接口

以下完整调用路径已由本地真实 HTTP 接口验证。Controller 实际路径不含 `/auth-service`。

| 方法 | 小程序完整路径 | 请求与响应 |
| --- | --- | --- |
| POST | `/auth-service/life/wish/page` | 分页、keyword、status；返回 PageVo |
| POST | `/auth-service/life/important-date/page` | 分页、keyword、view=UPCOMING/ALL；返回日期计算后的 PageVo |
| POST | `/auth-service/life/bookmark/page` | 分页、keyword、category；返回 PageVo |
| GET | `/auth-service/life/{wish,important-date,bookmark}/detail?id=...` | 仅本人；返回完整详情和 revision |
| POST | `/auth-service/life/{wish,important-date,bookmark}/add` | 各自新增 DTO、clientRequestId；返回 id、revision |
| PUT | `/auth-service/life/{wish,important-date,bookmark}/update` | id、revision、完整可编辑字段；返回新 revision |
| DELETE | `/auth-service/life/{wish,important-date,bookmark}/delete?id=...&revision=...` | 所有权及版本检查后软删除 |
| PUT | `/auth-service/life/wish/change-status` | id、revision、action；返回状态、fulfilledAt、新 revision |
| PUT | `/auth-service/life/bookmark/set-pinned` | id、revision、pinned；返回新 revision |
| GET | `/auth-service/life/important-date/reminder-summary` | 返回 serverToday、activeReminderCount；仅本人 |

`{wish,important-date,bookmark}` 表示三套明确路由的缩写，不能实现为允许任意表名的动态通用 Controller。

响应沿用项目统一 `code/message/data` 包装，小程序从 `res.data` 使用业务对象。PageVo 保持 `current,size,total,records`；日期列表额外带 serverToday 或通过模块内分页 VO 扩展。日期记录 VO 包含 `originalDateText,nextOccurrenceDate,daysUntil,reminderActive,occurrenceStatus,revision`。新建的有状态操作不强行继承无法表达 revision 的通用 CRUD Controller。

示例为计划的日期新增请求（示例不代表本次写入）：

```json
{
  "title": "纪念日",
  "dateType": "ANNIVERSARY",
  "calendarType": "LUNAR",
  "eventYear": 2026,
  "eventMonth": 10,
  "eventDay": 5,
  "leapMonth": false,
  "repeatType": "YEARLY",
  "remindDays": 7,
  "remark": "",
  "clientRequestId": "example-create-001"
}
```

更新同时按 `id,user_id,revision,deleted=false` 匹配；零行更新区分本人记录的版本冲突与不可访问，不能把别人记录的当前 revision 暴露出来。冲突提示「记录已更新，请重新加载」，保留未提交输入供用户比对，不能自动覆盖。

## 5. 异步和一致性

- 新增只有一次有效提交：防连点，同时使用幂等标识处理超时重试。超时不是确定失败，继续使用原标识查明或重试；不要马上生成新标识。
- 修改采用 revision；网络结果不明时拉取详情确认版本和字段，不盲目用新 revision 再提交一次状态操作。
- 保存成功、列表刷新失败：显示「已保存，列表刷新失败」，保留成功结果，只重试读取，不引导重复新增。
- 删除／状态／置顶成功后刷新相关列表；日期修改同时使菜单提示数量失效。返回列表不依赖持久化全量缓存。
- 每个页面记录请求序号与会话标识；搜索／筛选切换后丢弃旧响应，登录切换或页面销毁后不回填。状态变化导致列表总数变化时重置分页，避免重复或漏页。
- 非未提交草稿不写入全局长期缓存；本次不做离线编辑、自动合并、后台同步或与家庭相关的 cache key。
- 生产数据库执行前检查新表不存在或与预期结构完全匹配；有冲突、owner 空值、重复请求键等情况停止。建表、发布后验证、回退步骤分别记录；回退应用不删除已有新工具数据。不要将破坏性 DROP 当作常规回滚。
