# TODO

更新时间：2026-06-30（第29轮 — 项目级实际开始优先下单时间）

---

## 第29轮修复记录（2026-06-30）

- [x] 修正项目级“实际开始日期”默认值：部门管理员提交项目进度时，优先读取项目卡片上的 `adminOrderDate`（下单时间/进度管理员派单时间），再读取显式项目派单记录，最后才兜底工序 `actualStart`。
- [x] `C26-0422` 项目级电气设计默认日期从 `2026-06-21` 修正为项目下单时间 `2026-06-18`。
- [x] 普通员工设备级默认日期仍读取部门管理员派给员工的 `assignedAt`，秦朗电气设计样例仍为 `2026-06-21`。

### 第29轮验证结果

- [x] service 级断言：`getProjectDepartmentDispatchDate(C26-0422 / 电气设计部 / 电气设计)` 返回 `2026-06-18`；`getDeviceProcessAssignmentDate(dvc1 / 电气设计 / 秦朗)` 返回 `2026-06-21`。

---

## 第28轮修复记录（2026-06-30）

- [x] 修复 DevTools 当前运行态旧快照缺少 `dispatchedAt/assignedAt` 时，进度提交页“实际开始日期”仍显示“请选择”的问题。
- [x] `getProjectDepartmentDispatchDate()` 现在按当前派单记录、seed 派单记录、项目下对应工序 `actualStart` 依次兜底。
- [x] `getDeviceProcessAssignmentDate()` 现在按当前任务、seed 任务、对应设备工序 `actualStart` 依次兜底。

### 第28轮验证结果

- [x] 模拟删除 `dispatchedAt/assignedAt` 后，旧逻辑可从工序 `actualStart` 兜底；第29轮已进一步明确项目级优先使用项目下单时间 `adminOrderDate`。

---

## 第27轮修复记录（2026-06-30）

- [x] 明确 `C26-0501` 没有“提交项目进度”的原因：该项目当前只有项目记录，没有设备和本部门工序；部门管理员项目级提交入口按 `项目 + 当前部门工序` 生成，不按“项目存在”生成。
- [x] 新增项目派单日期字段口径：`dispatchedAt` 表示进度管理员派给部门的日期；后续第29轮已明确项目级提交默认优先读取项目 `adminOrderDate`。
- [x] 新增部门派单日期字段口径：`assignedAt` 表示部门管理员派给普通员工的日期；新设备派单会自动写入当天日期，旧秦朗电气设计任务补 `2026-06-21`。
- [x] 进度提交页默认实际开始日期改为读取派单日期：部门管理员项目级“提交项目进度”默认读 `dispatchedAt`；普通员工单台设备“提交进度”默认读 `assignedAt`，缺失时再回退已有工序 `actualStart`。
- [x] 新增 service 查询入口 `getProjectDepartmentDispatchDate()` / `getDeviceProcessAssignmentDate()`，页面不直接遍历 mock 派单数据。

### 第27轮验证结果

- [x] `services/data-service.js`、`pages/progress-submit/index.js`、`utils/mock-data.js` `node --check` 通过。
- [x] service 级断言：`C26-0501` 保留在项目列表但无提交入口；陈尚杰对 `C26-0422 / 电气设计部 / 电气设计` 有提交入口。
- [x] 本轮原断言曾按 seed 派单记录返回 `2026-06-21`；第29轮已修正项目级默认日期为 `2026-06-18`，设备级秦朗派单日期仍为 `2026-06-21`。
- [x] 联动断言：`C26-0422` 两台设备各 11 条工序；秦朗个人任务 3 条；参数库设备 2 台、`dvc1` 参数 48 条、按“风量”查 6 条。

---

## 第26轮修复记录（2026-06-30）

- [x] 纠正上一轮误解：恢复 `C26-0501 / 除湿机试点项目` mock 项目记录，移除 `listProjects()` 中针对 0501 的过滤；项目数据不应因为标题文案问题被删除。
- [x] 项目总列表顶部只保留主标题“项目总列表”，删除副标题小字，不再显示“除湿机项目试点”或其他静态说明。
- [x] 新增 `getDepartmentProjectSubmitOptions(projectNo, user)`：部门管理员只在项目存在本部门工序时获得项目级“提交项目进度”入口上下文。
- [x] 项目详情每台设备的工序行不再显示“提交项目进度”；部门管理员只使用项目级统一入口提交整个项目的本部门进度。
- [x] 项目总列表项目卡片和项目详情顶部保留部门管理员项目级“提交项目进度”入口；陈尚杰仅在 `C26-0422 / 电气设计部 / 电气设计` 这类真实存在本部门设备工序的项目上可见入口。
- [x] 保留项目级提交未完成阻断：若仍有设备的本部门工序未完成，提交继续失败并返回未完成设备、负责人、预计完成时间清单。
- [x] 加固参数库回退：`getDeviceParams()` 在当前快照参数为空数组时继续回退种子参数，避免本地模拟云空快照导致参数库空白。

### 第26轮验证结果

- [x] 全量 `pages/services/utils` JS `node --check` 通过；`app.json` JSON.parse 通过。
- [x] service 级断言：`listProjects()` 同时返回 `C26-0501` 和 `C26-0422`；陈尚杰对 `C26-0422` 返回 `电气设计部 / 电气设计` 提交入口，对无设备的 `C26-0501` 返回空。
- [x] service 级断言：陈尚杰提交 `C26-0422 / 电气设计` 时仍返回 `HAS_UNFINISHED_DEVICES`，未完成设备为两台，流程不写回。
- [x] 联动断言：`C26-0422` 两台设备工序可读；秦朗个人任务可读；参数库设备、参数详情和按参数查均可读。

---

## 第25轮修复记录（2026-06-30）

- [x] 本轮曾误删 `C26-0501 / 除湿机试点项目` 并过滤项目列表；该口径已在第26轮纠正，保留项目数据，只删除项目总列表标题下的静态副标题。
- [x] 本轮新增的 `getDepartmentProjectSubmitOptions(projectNo, user)` 保留，用作部门管理员项目级提交入口的 service 统一判断。

---

## 第24轮修复记录（2026-06-30）

- [x] 优化微信开发者工具中的云数据库空查询报警：`readDetailCollections()` 不再对 `processTasks / importLogs / operationLogs / permissions` 等细集合执行空条件 `collection.get()`，改为按写入时的 `_sourceKey` 做条件查询。
- [x] 保留主快照回退：如果细集合为空或没有匹配 `_sourceKey` 的旧数据，仍回退读取 `appStores/production-progress-store`，不影响本地 mock 和云快照主链路。
- [x] 明确截图中其余两类提示：SharedArrayBuffer 是 DevTools/浏览器隔离策略提示；`[worker] reportRealtimeAction:fail not support` 是基础库/worker 能力提示，当前未发现需要改业务代码。

### 第24轮验证结果

- [x] `services/cloud-data.js` `node --check` 通过；全量 `pages/services/utils` JS `node --check` 通过；`cloudfunctions/appStore/index.js` `node --check` 通过；`app.json` JSON.parse 通过。

---

## 第23轮修复记录（2026-06-30）

- [x] 按用户回传的 `人员角色部门工序核对表.xlsx` 更新测试用户：新增/更新郑雪莲、孙志勇、朱建闯、王国峰、陈尚杰、郭敬锋、苏高森、吴洁等；彭博改为普通员工，陈尚杰为电气设计部部门管理员。
- [x] 按表更新业务部门和工序：新增/启用 `ERP录入 / 物料采购`，旧 `采购物料` 兼容规范为 `物料采购`；`电工房` 兼容为 `电气电控车间`，`结构班组/电气班组` 兼容为 `生产装配`。
- [x] C26-0422 两台设备样例工序更新为 11 条，负责人严格按表：项目设计蒋相波、结构设计彭博、电气设计秦朗、ERP录入/发货刘爽、物料采购郑雪莲、电气盘安装卢建平、结构总装孙志勇、电气总装朱建闯、电箱组装王国峰、调试李洋。
- [x] `mock-user.js` 重建为正常中文测试用户清单，确保“我的”页角色预览能选择陈尚杰、吴洁等新用户。
- [x] `listParamDevices()` / `searchParams()` 支持显式 user 参数，便于 service 级联动回归，不改变页面默认按当前登录用户判断权限的行为。
- [x] 明确“写回”定义：把页面提交结果写入底层数据对象（如设备工序的 `status/actualFinish/remark`）。存在未完成设备时，部门管理员项目级提交必须失败，不允许写回任何工序。

### 第23轮验证结果

- [x] 全量 `pages/services/utils` JS `node --check` 通过；`cloudfunctions/appStore/index.js` `node --check` 通过；`app.json` JSON.parse 通过。
- [x] service 级断言：表格 17 名用户均存在且按表顺序输出；工序清单为 `项目设计/结构设计/电气设计/ERP录入/物料采购/电气盘安装/结构总装/电气总装/电箱组装/调试/发货`。
- [x] service 级断言：陈尚杰预览 `C26-0422 / 电气设计部 / 电气设计` 返回 2 台未完成设备；直接提交失败并返回 `HAS_UNFINISHED_DEVICES`，设备工序状态仍为“进行中”。
- [x] service 级断言：彭博已非部门管理员，不能走结构设计部项目级提交预览；秦朗个人任务 3 条；秦朗参数库设备 2 台、`dvc1` 参数 48 条、按参数查“风量” 6 条。

---

## 第22轮修复记录（2026-06-30）

- [x] 部门管理员按项目提交本部门工序进度前，新增 service 预览入口 `getProjectDepartmentProgressPreview()`，按 `projectNo + department + process` 汇总项目下对应设备工序。
- [x] 项目级提交时若存在未完成设备，进度提交页先弹出“未完成设备 / 负责人 / 预计完成时间”表格；下方仅显示“已知晓”，点击后返回前置界面，本次项目进度提交失败且不写任何工序。
- [x] 预览与提交均校验当前用户必须是本部门的部门管理员，非本部门工序、普通员工或其他角色不能调用该项目级路径。
- [x] 生成 `人员角色部门工序核对表.xlsx`，列为 `姓名 / 角色 / 部门 / 负责工序名`，来源为当前 service 用户、设备工序负责人和默认工序负责人映射，供人工核对后再回写后端/mock。
- [x] 底层约束继续明确：项目详情工序展开、任务页个人任务、参数库列表/详情/导出是同一组设备/工序/参数回退链路，修改相关功能时必须一起复测，避免同步空白。

### 第22轮验证结果

- [x] 全量 `pages/services/utils` JS `node --check` 通过；`cloudfunctions/appStore/index.js` `node --check` 通过；`app.json` JSON.parse 通过。
- [x] service 级断言：彭博预览 `C26-0422 / 结构设计部 / 结构设计` 可得到 2 台未完成设备及负责人/预计完成时间；直接提交会失败且返回未完成清单；普通员工与非本部门请求被拒绝。
- [x] service 级联动回归：`C26-0422` 两台设备各 8 条工序；秦朗个人任务 3 条；参数库设备 2 台、`dvc1` 参数 48 条、按参数查“风量” 6 条。
- [x] Excel 核对表已用 artifact-tool 生成、扫描关键区域、检查公式错误并渲染预览确认可读。

---

## 第21轮修复记录（2026-06-30）

- [x] 设备级进度提交收紧为普通员工路径：普通员工提交设备工序后，service 强制将该工序状态记为“已完成”，页面状态选择同步锁定为“提交后自动记为已完成”。
- [x] 部门管理员不再按单台设备提交进度：`submitProgress()` 会阻断部门管理员设备级提交，并提示到项目详情按项目提交本部门进度。
- [x] 新增项目级部门进度提交：`submitProjectDepartmentProgress()` 由部门管理员按 `projectNo + department + process` 一次写回项目下所有对应设备工序。
- [x] 项目详情展开工序时，只在当前部门管理员所属部门的工序上显示“提交项目进度”，且同一项目/同一工序只显示一次入口，避免每台设备重复提交。
- [x] 任务页部门管理员点击工序提交时跳转项目级提交；非本部门任务不显示提交按钮。普通员工仍走设备级提交。
- [x] 设备详情隐藏部门管理员的单台设备“提交进度”按钮，普通员工仍可提交设备工序。
- [x] 设备详情进一步收紧：普通员工只在自己负责的工序上看到单台设备“提交进度”，不能提交其他人的工序。
- [x] 明确“实际开始”来源：设备工序的 `actualStart` 来自 mock 初始数据、Excel 导入字段或进度提交页填写的实际开始日期；系统当前不自动推算实际开始。

### 第21轮验证结果

- [x] 全量 `pages/services/utils` JS `node --check` 通过；`cloudfunctions/appStore/index.js` `node --check` 通过；`app.json` JSON.parse 通过。
- [x] service 级断言：秦朗提交 `dvc1/电气设计` 即使传入“进行中”，结果也强制为“已完成”。
- [x] service 级断言：彭博不能单台提交 `dvc1/结构设计`；彭博可项目级提交 `C26-0422/结构设计/结构设计部`，并一次写回 2 台设备的结构设计工序。

---

## 第20轮修复记录（2026-06-30）

- [x] 修复项目详情工序展开空白：页面不再用 WXML 动态下标 `expandedDevices[item.id]` 控制展开，改为每个设备自身的 `expanded` 字段；设备工序同时兜底调用 `getProcessesByDevice()`，确保本地云快照缺 `processMap` 时仍读取种子工序。
- [x] 项目详情展开行恢复显示工序名、计划完成日期、负责人、状态和进度提交日期；无工序时显示明确空态。
- [x] 修复 service 写入口当前用户读取：`createProjectDispatch()` / `assignDepartmentTask()` 改为从 `auth-service.getCurrentUser()` 读取当前用户，不再调用不存在的 `permissionService.getCurrentUser`。
- [x] 修复参数库“按参数查”空白：不再遍历当前快照 `mockData.electricalParamValues`，改为遍历设备并统一通过 `getDeviceParams()`，复用本地种子参数回退路径。
- [x] 项目详情工序行新增“设备派单”入口：部门管理员在本部门待分配工序上可直接进入 `/pages/department-dispatch/index`，入口复用现有待分配任务 `rowKey`，不新增假数据。
- [x] 设备派单候选人收紧为同业务部门普通员工，不再把部门管理员本人列入候选。
- [x] “我的”页角色预览主标题改为员工姓名，副标题显示业务部门和权限角色；选择秦朗时能直接看到人物。

### 第20轮验证结果

- [x] 全量 `pages/services/utils` JS `node --check` 通过；`cloudfunctions/appStore/index.js` `node --check` 通过；`app.json` JSON.parse 通过。
- [x] service 级断言：`C26-0422` 有 2 台设备，每台展开 8 条工序；工序含计划完成日期和负责人；秦朗“我的任务”读取到 3 条 owner 为秦朗的现有任务/工序。
- [x] service 级断言：参数库设备列表非空；按参数查“风量”能读到现有参数；部门管理员彭博拥有设备派单权限，并能找到结构设计部待分配任务对应的 `rowKey`。
- [ ] 仍需人工在 WeChat DevTools 观察页面点击：项目详情展开工序、秦朗角色预览/任务页、参数库列表/按参数查/导出、部门管理员项目详情里的设备派单入口。

---

## 第19轮修复记录（2026-06-30）

- [x] 修复 `archiveProject()` 残留：`services/data-service.js` 已移除函数体和导出，代码层不再提供项目归档入口。
- [x] 审查并收紧 `permission-service.js`：后台权限角色匹配不再读取 `department`，部门能力匹配只看业务部门；`isManager` 不再泛化授予部门管理员权限。
- [x] 对齐 `app.json` 与文档页面清单：当前注册 30 页，包含 `pages/login/index`，不包含 `pages/qb-transfer/index`；`pages/qb-transfer` 文件夹仅为未注册残留。
- [x] 对齐 `cloudfunctions/appStore` 真实 action：`getStore / saveStore / health / login / downloadTemplateFile`；移除未路由的 `sendTemplateMsg` 死函数。
- [x] `notification-service.sendTemplateMessage()` 改为禁用态兼容返回，不再调用不存在的 `sendTemplateMsg` action。
- [x] Service 级复测通过：项目详情/设备工序展开、任务页个人任务、参数库列表/详情、参数对比导出、项目/设备派单权限、计划发货提前调整记录、数据看板统计来源。
- [x] 同步更新 `TODO.md`、`docs/PROJECT_SPEC.md`、`docs/HANDOFF_TO_NEXT_AGENT.md`、`services/README.md`。

### 第19轮验证结果

- [x] 全量 `pages/services/utils` JS `node --check` 通过；`cloudfunctions/appStore/index.js` `node --check` 通过；`app.json` JSON.parse 通过。
- [x] service 级断言：`app.json` 注册 30 页且有 login/无 qb-transfer；`archiveProject` 不再导出；`isManager` 单独不授予部门派单；秦朗不能项目派单，张绍方/IT 可项目派单；彭博按角色是部门管理员。
- [x] service 级断言：`dvc1` 展开 8 条工序；秦朗“我的”返回电气设计任务；参数库可见 2 台设备，`dvc1` 返回 48 条参数；参数导出按 `前表冷风量 == 53 m3/h` 可筛出 `C26-0422-01` 并生成 xlsx。
- [x] service 级断言：项目派单后设备派单预览只列同业务部门普通员工；计划发货改早会生成调整记录并标识 `ahead`；数据看板项目/设备/任务/QB 总数均来自对应 service 列表。
- [ ] 仍需人工在 WeChat DevTools 观察页面视觉和点击反馈：项目详情工序展开、任务页个人任务、参数库列表/详情、参数对比导出、项目/设备派单权限、计划发货延期/提前/调整记录、数据看板。

---

## 第18轮修复记录（2026-06-30）

- [x] 在计划发货调整中新增“提前”判定：本次计划发货日期早于调整前日期时标识为“提前”，标识使用红色。
- [x] 计划发货日期默认直接显示；只有发生调整时，日期后显示“延期”或“提前”标识，并显示“调整记录”入口。
- [x] 计划发货调整记录表已接入项目总列表和项目详情：点击“调整记录”弹出表格，表头为“序号 / 下单日期 / 计划发货日期”。
- [x] 调整记录按时间顺序自上而下显示，最新调整记录位于最下面；首次调整会自动补入原计划发货日期作为第 1 条。
- [x] 延期不再作为工序状态使用；mock 工序中的“已延期”改回“进行中”，工序逾期仍由计划完成日期和完成状态计算。

---

## 第17轮修复记录（2026-06-30）

- [x] 修复角色预览“当前”同时高亮多人：不再按 `roleLabel` 判断当前用户，改为按用户唯一标识 `id/phone/name` 生成 `active` 状态。
- [x] 明确权限角色和业务部门不是同一概念：`普通员工 / 进度管理员 / 综管部管理员 / 部门管理员 / 观察员 / 后台管理员` 是小程序后台权限角色。
- [x] `采购部 / 工艺部门 / 项目部 / 电工房 / 电气设计部 / 结构设计部` 等是公司业务流程部门，显示在员工姓名后的 `｜部门` 中。
- [x] `采购部员工 / 工艺部门员工 / 项目部员工 / 电工房员工` 不再作为权限角色写入测试用户，统一归为 `普通员工`。

---

## 第16轮修复记录（2026-06-30）

- [x] 项目总列表项目卡片新增“编辑项目”按钮，进度管理员/后台管理员可直接编辑项目主要信息并调整计划发货日期。
- [x] 项目详情项目级按钮收紧：普通员工不显示“项目派单 / 编辑项目 / 删除项目 / 新增设备”，事件入口也二次校验权限。
- [x] 项目派单权限改为严格角色判断：仅后台管理员、进度管理员/项目管理员可项目派单，秦朗等普通员工不能误显。
- [x] 派单概念 UI 统一：进度管理员为“项目派单”，部门管理员为“设备派单”；原部门派单页面和权限展示改名为设备派单。
- [x] 新增测试用户 `蒋相波｜项目部｜普通员工`、`卢建平｜电工房｜普通员工`；`陈七` 改为 `彭博｜结构设计部｜部门管理员`。
- [x] 测试工序负责人修正：项目设计归蒋相波，结构设计归彭博，电箱组装归卢建平；张绍方不再承担项目设计生产任务。
- [x] 新建设备默认工序负责人同步上述口径；旧本地模拟云快照展示时也会规范化旧负责人。
- [x] 任务页“我的”收紧为只显示 owner 等于当前用户的任务，张绍方不再看到项目设计等生产任务。
- [x] 清理项目列表 wxss 的裸 `button` 选择器，避免 DevTools 组件 wxss 警告。

---

## 第15轮修复记录（2026-06-30）

- [x] 拆分“逾期”和“延期”口径：项目列表/详情统计项恢复为“逾期”，不再显示“逾期/延期”。
- [x] 逾期统计改为工序级：当前日期达到或超过工序计划完成日期，且工序未完成；同一设备多个工序逾期时逐条计数。
- [x] 延期仅表示进度管理员人工后延项目计划发货日期；后延后计划发货日期变色，并在日期后标注“延期”。
- [x] 保存项目时记录 `originalShipDate/shipDateDelayed`，并同步项目下设备计划发货日期和“发货”工序计划完成日期。
- [x] 工序展示文案从“计划截止”改为“计划完成”；进度提交日期晚于计划完成日期时，在项目详情展开工序中标红。
- [x] 核实并收紧计划发货日期编辑权限：进度管理员/后台管理员可进入项目编辑并修改计划发货日期；普通角色不显示入口，直达页面也会阻断。
- [x] 修复 `saveProject()` 未保存 `adminOrderDate` 及年月归档字段的隐患，避免影响项目列表排序。
- [x] 本轮验证：相关 JS `node --check` 通过；service 级验证逾期计数、计划发货后延标记、设备与发货工序日期同步、项目排序通过。

---

## 第14轮修复记录（2026-06-29）

- [x] 修复项目总列表排序：`listProjects()` 恢复按进度管理员下单时间 `adminOrderDate` 倒序，后下单项目靠上。
- [x] 修复项目总列表年月筛选：`year/month` 会按 `adminOrderYear/adminOrderMonth` 或 `adminOrderDate` 派生值过滤。
- [x] 完成项目 QB 高亮规则落地：完成项目有未关闭 QB 时状态标签变黄色；QB 结案/关闭后恢复浅灰色。
- [x] 新增 `工艺部门` 和演示用户 `刘爽｜工艺部门｜普通员工`，并同步到角色预览和登录绑定数据源。
- [x] 登录绑定部门补齐 `制造部 / 总经办/销售/市场 / 信息化`，修复与角色预览不一致的问题。
- [x] 数据看板入口补齐：后台管理员在“我的”页后台管理入口可点击“数据看板”进入 `/pages/dashboard/index`。
- [x] 注意：本条旧口径已在第15轮修正，现已拆分“逾期”和“延期”。
- [x] 本轮验证：相关 JS `node --check` 通过，`app.json` JSON.parse 通过；service 级验证项目排序、组织清单、QB 高亮与关闭恢复通过。

---

## 第13轮修复记录（2026-06-29）

- [x] 参数对比新增真实 `.xlsx` 导出：支持按项目号、按项目下单时间区间筛选；项目-设备子菜单默认“全部设备”，勾选单台设备会自动取消“全部设备”；导出列为项目/设备基础信息 + 当前电气参数名，设备为行。
- [x] 参数值筛选已接入导出：可勾选参数名并输入设定值，按 `value + unit` 的展示文本精确匹配，例如 `53 m3/h`。
- [x] 新增 `services/xlsx-writer.js`，基于现有 `fflate` 生成标准 OpenXML xlsx；Node 解包验证已确认 workbook/sheet 结构完整。
- [x] 任务页看板拖拽改为 service 持久化写回：普通任务写回 `tasks`，由 `processMap` 生成的工序任务写回对应工序状态，不再只改页面克隆对象。
- [x] 秦朗｜电气设计部任务页复测：service 级验证“我的”返回 3 条任务，其中 2 条为电气设计工序任务。
- [x] 项目详情工序展开复测：service 级验证 `C26-0422` 两台设备均返回 8 条工序。
- [x] 参数库列表/详情复测：秦朗｜电气设计部可见 2 台参数设备，设备详情返回 48 条电气参数。
- [x] 参数库顶部 `模板 / 批量 / 对比` 按钮改为 flex 纯居中，移除依赖 `line-height` 的垂直对齐。
- [x] QB 模块进一步收敛为只读：移除 `app.json` 的 `pages/qb-transfer/index` 路由，`qb-detail` JS 删除转交/进展/关单方法；service 旧写函数保留函数名但只返回只读提示。
- [x] QB 钉钉同步预留接口：新增 `upsertQbFromDingTalk()` / `syncQbFromDingTalk()`，字段包含 instanceId/processCode/businessId/url/raw，方便后续云函数导入钉钉 OpenAPI 数据。
- [x] 权限管理完成可同步配置：新增 `mockData.permissions`，`cloud-data` 纳入 `permissions` 快照/细集合，`permission-manage` 页面可编辑并保存权限矩阵。
- [x] “我的权限”移除 QB 转交权限项，避免只读 QB 需求和权限展示不一致。
- [x] 数据看板 service 级验收：`getDashboardStats()` 可返回项目、设备、QB、任务、我的任务、工作量和最近操作统计；该页面入口在“我的”页后台管理菜单。
- [x] 本轮自动化验证：全量 `pages/services/utils` JS `node --check` 通过，`app.json` JSON.parse 通过；参数导出 xlsx 生成并解包验证通过。

### 本轮仍需人工在 DevTools 观察的事项

- [ ] 本轮工具环境未暴露可点击微信开发者工具的 computer-use 控件，因此 DevTools 视觉点击复测未能由 Codex 直接完成；已完成 service/构建级复测，建议人工再看页面视觉：项目详情工序展开、任务页个人任务、参数库列表/详情、参数模板/批量流程、参数对比导出、数据看板。

---

## 第10-12轮修复记录（2026-06-26 至 2026-06-28）

- [x] 项目总列表删除归档功能：移除“已归档”筛选项、项目详情“归档项目”按钮、`archiveProject()` 服务入口和导出。
- [x] 项目总列表增加年月筛选：`全部 / 进行中 / 延期 / QB` 共 4 项均按进度管理员下单时间筛选，默认当前年月，年份 2000-2099、月份 01-12，使用滚轮 picker。
- [x] 项目列表排序改为按进度管理员下单时间倒序展示，mock 项目和导入/新建项目均补 `adminOrderDate` 字段。
- [x] 项目保存和 Excel 导入均派生 `adminOrderYear` / `adminOrderMonth` / `archivePath`，归档路径形如 `projects/YYYY/MM`，后续云存储或导出可按该路径落文件。
- [x] 新建/编辑项目增加“进度管理员下单时间”日期选择，避免该筛选字段只能由系统默认生成。
- [x] Excel 导入确认前增加“项目下单时间”确认弹窗：按项目号分组，每个项目用日期 picker 选择 `adminOrderDate`，导入项目以该值为准。
- [x] Excel 导入页“复制模板路径”改为“下载模板”；正式链路支持云存储 `cloudFileID` 下载和 HTTPS 下载，未配置云端文件时才回退本机开发模板路径。
- [x] 完成 QB 对接钉钉开放接口可行性研究：详见 `docs/QB_DINGTALK_FEASIBILITY.md`。
- [x] 增加项目自动完成功能：项目内所有启用设备的“发货”工序均为“已完成”时，项目自动更新为“已完成”，完成项目总体进度显示为 100%。
- [x] QB 模块切换为只读：关闭小程序内建单、处理进展、转交、协作人维护和关单写操作，保留 service 函数名作为钉钉 OpenAPI 后续接入口。
- [x] QB 列表改为按项目下单时间梳理的时间轴；项目总列表筛选项“有 QB”改为“QB”。
- [x] 输出单台设备进度标准导入模板 v4：当前代码可识别表头，工序压缩为 10 个当前工序，导入预检 0 错误。
- [x] 修复 `xlsx-reader.js` 对带 XML 命名空间前缀 xlsx 的兼容，并修复自闭合空单元格导致列错位的问题。
- [x] 参数库增加标识符权限配置：默认 `electrical` 电气参数仅电气设计部可见，后台管理员可在字典管理中勾选多个可见部门。
- [x] 修复任务页首次进入空白：`pages/tasks/index.js` 初始化 `viewMode: "list"`，并在看板模式下加载任务后同步重建看板列。
- [x] 修复参数库顶部按钮排版：`模板 / 批量 / 对比` 统一为同一按钮样式和稳定尺寸。
- [x] 强化参数对比设备选中态：页面 JS 生成 `selected` 字段，WXML 不再直接调用 `indexOf()`，选中设备增加勾选和高亮。
- [x] 修复参数对比样例数据口径混乱：`C26-0422-02` 表冷风量统一为 `m3/h` 口径，并补齐中/后表冷字段。
- [x] 修复参数库列表风量单位硬编码：`listParamDevices()` 改为读取参数自身单位，不再固定拼 `CMH`。
- [x] 修复参数对比差异判断：差异比较同时包含 `value + unit`，并由 service 输出 `val.isDiff`，WXML 只读字段，降低模板编译风险。
- [x] 调整“我的”页云服务区域：正式用户界面改为简洁“数据同步”状态卡；运维诊断字段和重连/拉取/诊断/同步按钮仅管理员或开发预览可展开查看。
- [x] 统一角色命名：新增“部门管理员”角色预览和权限识别；“最高级管理员/超级管理员”用户可见名统一为“后台管理员”；后台管理员样例用户显示为 `IT｜信息化`。
- [x] 统一组织/负责部门：负责部门列表改为 `项目部 / 电气设计部 / 结构设计部 / 电工房 / 结构班组 / 电气班组 / 采购部 / 仓库部 / 品质部 / 生产部`；张绍方为 `进度管理员｜制造部`；观察员归属为“总经办/销售/市场”。
- [x] 统一项目派单工序：`机械采购/电气采购/采购部门` 合并为“采购物料”，`结构装配/电气装配` 改为“结构总装/电气总装”，去掉“品质跟进/工艺确认”；service 和 Excel 导入入口均加旧名规范化。
- [x] 按最新口径二次校正：张绍方改为 `进度管理员｜制造部`；电气负责部门改为“电气设计部”；工序“采购部门”改为“采购物料”；删除“工艺确认”；负责部门补充“品质部/生产部”；项目派单按工序自动带默认负责部门。
- [x] 修复参数库批量模式排版：批量操作按钮改专用样式，设备卡片增加批量态左侧避让，选择框固定在卡片内。
- [x] 修复项目详情工序行和 QB 创建页中的坏模板乱码：`{p.owner}}` / `{currentUser.department}}` 已恢复为正常数据绑定。

### 待真实数据确认

- [ ] `C26-0422-01 / C26-0422-02` 当前仍是 mock 样例设备，设备型号 `SJD125-38000Z-H1` 仍来自 `utils/mock-data.js`，未凭空改成其他型号；后续应以标准 Excel 或正式云数据为准导入。
- [ ] 参数样例数据只做内部一致性修正，不代表真实项目最终参数。

---

## 当前阶段：云存储可在本地验证

> **代码层全部就绪。** 新增本地模拟云存储层，完整模拟 persistStore → writeDetailCollections → loadStoreFromCloud → checkCloudHealth 全链路。
> 现在可以在**任何环境**（包括无微信云的开发者工具）验证云存储的持久化和恢复。

### 本地云存储验证（无需真实云环境）

1. 小程序中切到"我的"页面
2. 云服务卡片应显示"本地模拟云存储" + "本地模拟" + 绿色状态
3. 点击"诊断" → 确认通过（transport: local-mock）
4. 修改一些业务数据 → 点击"同步" → 数据写入本地模拟存储
5. 关闭工具重新打开 → 点击"拉取" → 数据应从本地模拟存储恢复
6. 验证数据一致性

> **真实云环境上线时**：只需在微信开发者工具开通云开发 → 填 envId → 创建集合 → 部署云函数，系统自动从 local-mock 切换到真实云存储。

### P0 云端试运行（待人工在微信开发者工具操作）

1. 开通云开发 → 获取环境 ID → 填入 `services/cloud-config.js`
2. 创建集合（10个）：`appStores`, `users`, `departments`, `projects`, `devices`, `processTasks`, `qbRecords`, `importLogs`, `operationLogs`, `permissions`
3. 部署 `cloudfunctions/appStore`
4. "我的"页 → 诊断 → 确认全绿（transport 应自动切换为 function 或 direct）
5. 上传 `outputs/templates/小程序标准导入模板_单台设备进度_v4.xlsx` 到云存储，复制返回的 fileID 到 `services/cloud-config.js` 的 `standardTemplates.progressImport.cloudFileID`
6. 同步 → 关闭重开 → 拉取
7. 配置安全规则

---

## 第8轮新增（2026-06-26 本地模拟云存储）

- [x] `cloud-data.js` 新增 `_initLocalMockCloud()`：当 wx.cloud 不可用时自动激活
- [x] 本地存储层：`localMockGet` / `localMockSet` / `localMockRemove`（基于 wx.storage）
- [x] `readStoreSnapshot` / `writeStoreSnapshot` 在 local mock 模式下走本地存储
- [x] `writeDetailCollections` / `readDetailCollections` 在 local mock 模式下走本地存储
- [x] `_localMockReadCollection`：遍历 storage keys 重组细集合数据
- [x] `checkCloudHealth` 在 local mock 模式下返回简化诊断结果
- [x] `cloud-config.js` 新增 `localMockEnabled` 开关（默认 true）
- [x] `pages/mine` UI 适配：识别"本地模拟云存储"状态
- [x] `isLocalMockMode()` 导出到 module.exports

---

## 已完成

### 全部功能模块
- [x] 项目/设备 CRUD + 派单 + 进度提交
- [x] QB 全流程 + 多人协同
- [x] 参数库 + 对比 + CSV导出 + 模板 + 批量操作
- [x] 附件（本地上传 + 云上传代码就位）
- [x] 用户/部门/权限/字典管理
- [x] Excel 标准模板导入 + 操作日志
- [x] P2 权限细化（dataScope 四级）
- [x] P2 消息通知（5 种类型 + 消息中心）
- [x] P2 数据看板（QB 时效 + 工作量 + 任务分布）
- [x] P3 看板拖拽（列表/看板双模式 + touch 拖拽）
- [x] P3 参数模板 + 批量操作

### 云服务（代码层全部就绪 + 本地可验证）
- [x] cloud-config + cloud-data（细集合 + 乐观锁 + **本地模拟存储**）
- [x] cloudfunctions/appStore（4 action）
- [x] auth-service（performCloudLogin + autoLink）
- [x] attachment-service（upload 重试3次 + 进度回调）
- [x] notification-service（5 种通知）

### 技术验证
- [x] 45 JS 文件全量 node --check 零错误
- [x] 30 页 × app.json 精确匹配
- [x] 页面不直读 mock，getProject/getDevice 等值校验全覆盖

---

## 后续推进

### P0 通过后
- [x] ~~云存储接入启用~~ 已确认三页面均已接入 uploadToCloud/getCloudFileTempUrl
- [x] ~~云存储接入验证~~ attachment-service 三种模式（mock/cloud/cloud-error）均已覆盖
- [x] permissions 集合导入/本地模拟同步配置：`mockData.permissions` + `cloud-data` 细集合键已补，权限管理页可保存当前权限矩阵。
- [ ] 在 WeChat 后台申请订阅消息模板 ID → 填入 `notification-service.js` 的 `WX_TEMPLATE_IDS`

### 未来增强
- [ ] QB 钉钉只读同步 POC：创建企业内部应用，云函数获取 accessToken，读取测试 QB 实例并写入 `qbRecords`。
- [x] ~~QB 小程序写操作收敛~~ 已切换为只读占位，后续只接钉钉同步数据。
- [x] 云数据库正式结构的年月归档字段已预留到项目记录：`adminOrderYear` / `adminOrderMonth` / `archivePath`。真实云端仍建议对 `adminOrderDate/adminOrderYear/adminOrderMonth` 建查询索引。
- [ ] 参数库云化时新增 `paramLibraries`/参数库权限集合，正式保存每个参数库标识符的可见部门。
- [x] ~~微信服务通知基础设施~~ 前端 subscribe 按钮和本地通知基础设施已完成；`appStore` 当前真实 action 不包含 `sendTemplateMsg`。
- [x] ~~createQb / createProjectDispatch 通知触发~~ 已补充
- [x] 参数对比导出真实 Excel 文件：按项目/时间/参数值筛选并生成 `.xlsx`。
- [x] 看板拖拽写回可用：拖拽移动任务状态会写回 service；动画优化和桌面端横屏适配仍是未来增强。
### 未来增强
- [ ] 微信服务通知/订阅消息
- [x] 参数对比导出真实 Excel

