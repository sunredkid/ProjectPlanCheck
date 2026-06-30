# HANDOFF_TO_NEXT_AGENT

更新时间：2026-06-30（第29轮 项目级实际开始优先下单时间）
项目路径：`D:\WeChatProjects\miniprogram-1`

> 接班先读 PROJECT_SPEC.md 再读本文件。

## 当前状态
**代码层全部完成。云服务全链路可在本地验证。**

30 页面 + 11 services + 云函数 appStore（5 action：getStore/saveStore/health/login/downloadTemplateFile）+ 细集合 + 乐观锁 + 本地模拟云存储。
45 JS 文件全量 node --check 零错误。30 页 × app.json 精确匹配。

## 2026-06-30 追加修复（项目级实际开始优先下单时间）

- 项目级“提交项目进度”的实际开始日期默认值，按用户最新口径优先读取项目卡片上的 `adminOrderDate`（下单时间/进度管理员派单时间）。
- `getProjectDepartmentDispatchDate()` 现在先返回项目 `adminOrderDate`，再查显式派单记录 `dispatchedAt`，最后兜底对应工序 `actualStart`。
- C26-0422 项目级电气设计默认日期应为 `2026-06-18`；普通员工设备级仍按部门管理员派给员工的 `assignedAt`，秦朗电气设计样例为 `2026-06-21`。
- 验证：service 探针确认 `getProjectDepartmentDispatchDate(C26-0422 / 电气设计)` 返回 `2026-06-18`，`getDeviceProcessAssignmentDate(dvc1 / 电气设计 / 秦朗)` 返回 `2026-06-21`。

## 2026-06-30 追加修复（派单日期旧快照兜底）

- DevTools 可能仍运行本地模拟云旧快照，里面没有新加的 `dispatchedAt/assignedAt` 字段；这会导致进度提交页“实际开始日期”显示“请选择”。
- `getProjectDepartmentDispatchDate()` 已改为依次从当前派单记录、seed 派单记录、项目下对应工序 `actualStart` 兜底。
- `getDeviceProcessAssignmentDate()` 已改为依次从当前任务、seed 任务、对应设备工序 `actualStart` 兜底。
- 验证：模拟删除 `dispatchedAt/assignedAt` 字段后，旧逻辑可从工序 `actualStart` 兜底；第29轮已进一步明确项目级优先使用项目 `adminOrderDate`。

## 2026-06-30 追加修复（实际开始默认读取派单日期）

- `C26-0501` 当前没有“提交项目进度”按钮不是权限问题，而是该项目只有项目记录，没有设备和当前部门工序；部门管理员项目级提交入口由 `getDepartmentProjectSubmitOptions()` 按项目下本部门设备工序生成。
- 新增派单日期口径：`dispatchedAt` 表示进度管理员派给部门的日期；`assignedAt` 表示部门管理员派给普通员工的日期。
- `createProjectDispatch()` 新建项目派单时会写入 `dispatchedAt`；`assignDepartmentTask()` 新建设备派单时会写入 `assignedAt`。第29轮之后，项目级默认实际开始优先取项目 `adminOrderDate`，设备级默认实际开始取 `assignedAt`。
- `pages/progress-submit` 的实际开始日期默认值：项目级提交读 `data-service.getProjectDepartmentDispatchDate()`；普通员工设备级提交读 `data-service.getDeviceProcessAssignmentDate()`，缺失时再回退已有工序 `actualStart`。
- 验证：`data-service.js`、`progress-submit/index.js`、`mock-data.js` `node --check` 通过；第29轮已修正 C26-0422 项目级默认日期为 `2026-06-18`，秦朗设备级派单日期仍为 `2026-06-21`；工序展开、秦朗任务、参数库列表/详情/按参数查仍有数据。

## 2026-06-30 追加修复（恢复 0501 与收紧项目级提交入口）

- 纠正上一轮误解：`C26-0501 / 除湿机试点项目` 是项目记录，可以存在于项目总列表；不能因为标题区域的小字问题删除或过滤该项目。`utils/mock-data.js` 已恢复 0501，`data-service.listProjects()` 已移除 0501 过滤。
- 项目总列表标题下方的小字已删除；页面顶部只保留主标题“项目总列表”，不显示“除湿机项目试点”或其他静态副标题。
- 新增 `data-service.getDepartmentProjectSubmitOptions(projectNo, user)`，页面只通过该 service 判断部门管理员是否有项目级提交入口。页面不得自行遍历 mock 或用 `isManager` 推断入口。
- 项目总列表项目卡片和项目详情顶部均可显示部门管理员项目级“提交项目进度”入口；前提是当前项目确实包含当前部门管理员所属业务部门的工序。陈尚杰登录时，`C26-0422` 会给出 `电气设计部 / 电气设计` 入口；无设备的 0501 不会给入口。
- 项目详情展开每台设备的工序行不再显示“提交项目进度”。设备工序进度由普通员工按单台设备提交；部门管理员只通过项目级统一入口提交整个项目的本部门进度。
- `getDeviceParams()` 已加固参数回退：当前快照参数为空数组时继续回退种子参数，避免本地模拟云空快照导致参数库空白。
- 项目级提交未完成阻断保持不变：`submitProjectDepartmentProgress()` 遇到未完成设备返回 `HAS_UNFINISHED_DEVICES`，页面弹出未完成设备表，用户点“已知晓”后返回前置界面，不写回任何工序。
- 验证：全量 `pages/services/utils` JS `node --check` 通过，`app.json` 通过；service 探针确认 `listProjects()` 返回 `C26-0501` 和 `C26-0422`，陈尚杰对 `C26-0422` 有提交入口，对无设备的 `C26-0501` 无入口，提交 `C26-0422 / 电气设计` 仍被 2 台未完成设备阻断；工序展开、秦朗个人任务、参数库列表/详情/按参数查均有数据。

## 2026-06-30 追加修复（DevTools 云查询报警优化）

- 针对开发者工具里 `processTasks/importLogs/operationLogs/permissions` 的“空查询可能扫描全表”报警，`services/cloud-data.js` 的 `readDetailCollections()` 已从空条件 `collection.get()` 改为 `where({ _sourceKey: key }).get()`。
- 细集合写入本来就会带 `_sourceKey`，因此该查询仍能读取当前写入的数据；如果旧细集合没有 `_sourceKey` 或细集合为空，会按原设计回退读取主快照 `appStores/production-progress-store`。
- SharedArrayBuffer 的 cross-origin isolation 提示和 `[worker] reportRealtimeAction:fail not support` 属于 DevTools/基础库环境提示，目前不需要改业务代码。
- 验证：`services/cloud-data.js` 和全量 `pages/services/utils` JS `node --check` 通过，`cloudfunctions/appStore/index.js` 与 `app.json` 通过。

## 2026-06-30 追加修复（人员角色部门工序核对表落地）

- 已按用户回传的 `outputs/relationship-review-20260630/人员角色部门工序核对表.xlsx` 更新测试用户、部门和工序负责人。新增/更新用户包括郑雪莲、孙志勇、朱建闯、王国峰、陈尚杰、郭敬锋、苏高森、吴洁等。
- 彭博已改为 `结构设计部｜普通员工`；陈尚杰为 `电气设计部｜部门管理员`。用户接下来会用陈尚杰账号测试 C26-0422 的电气设计项目级提交阻断。
- 当前工序清单为 `项目设计 / 结构设计 / 电气设计 / ERP录入 / 物料采购 / 电气盘安装 / 结构总装 / 电气总装 / 电箱组装 / 调试 / 发货`。C26-0422 两台设备样例工序均为 11 条。
- 默认负责人按表：项目设计蒋相波、结构设计彭博、电气设计秦朗、ERP录入/发货刘爽、物料采购郑雪莲、电气盘安装卢建平、结构总装孙志勇、电气总装朱建闯、电箱组装王国峰、调试李洋。
- 旧名兼容仍保留：`采购物料` 规范为 `物料采购`；`电工房` 规范为 `电气电控车间`；`结构班组/电气班组` 规范为 `生产装配`；`生产部` 规范为 `工艺部门`。
- `mock-user.js` 已重建为正常中文测试用户清单，便于“我的”页角色预览选择陈尚杰、吴洁等。
- “写回”定义：把提交结果写入底层数据对象，如工序 `status/actualStart/actualFinish/remark`。项目级提交遇到未完成设备时必须失败，不能写回任何工序。
- 本轮验证：全量 JS、cloud function、app.json 通过；17 名用户均存在且按表顺序输出；陈尚杰预览 C26-0422 电气设计返回 2 台未完成，直接提交返回 `HAS_UNFINISHED_DEVICES` 且状态不变；彭博不再具备部门管理员项目级预览；秦朗任务与参数库联动回归通过。

## 2026-06-30 追加修复（项目级进度未完成确认 + 关系核对表）

- 新增 `data-service.getProjectDepartmentProgressPreview()`：部门管理员按 `projectNo + department + process` 预览本部门项目工序涉及的设备，返回全部行和未完成行。
- `pages/progress-submit` 在项目级提交前先调用预览；若存在未完成设备，会弹出“未完成设备 / 负责人 / 预计完成时间”表格，下方只有“已知晓”，点击后返回前置界面，本次提交失败且不写任何工序。
- `submitProjectDepartmentProgress()` 也会在 service 层二次拦截未完成设备；只有每台设备的本部门工序均已完成后，部门管理员才可提交项目进度。
- 预览与提交都校验当前用户必须为部门管理员，且只能处理当前用户所属业务部门的工序；非本部门或普通员工请求会被 service 拒绝。
- 已输出 `outputs/relationship-review-20260630/人员角色部门工序核对表.xlsx`，用于人工核对当前 `姓名 / 角色 / 部门 / 负责工序名`。后续收到用户改回的 Excel 后，再按表修改 service/mock 数据。
- 继续把项目详情工序展开、任务页个人任务、参数库列表/详情/导出视为同一回归组：这三处共享设备、工序、参数和 cloud 快照回退链路，改任一相关底层功能都必须一起复测。
- 本轮验证：全量 `pages/services/utils` JS `node --check` 通过，`cloudfunctions/appStore/index.js` 与 `app.json` 通过；彭博可预览 `C26-0422 / 结构设计部 / 结构设计` 的 2 台未完成设备，直接提交会失败并返回未完成清单，普通员工和非本部门预览被拒；联动回归覆盖 `C26-0422` 两台设备各 8 条工序、秦朗个人任务 3 条、参数库 2 台设备/48 条参数/按参数查“风量” 6 条。Excel 已用 artifact-tool 扫描、渲染并导出。

## 2026-06-30 追加修复（进度提交权限分流与实际开始口径）

- 普通员工设备级提交进度后自动记为“已完成”：`submitProgress()` 对非部门管理员、非项目/后台管理员强制 `status = "已完成"`；进度提交页状态选择同步锁定。
- 部门管理员不再提交单台设备进度：`submitProgress()` 会阻断部门管理员设备级提交；设备详情隐藏部门管理员的单台“提交进度”按钮。
- 新增 `submitProjectDepartmentProgress()`：部门管理员按 `projectNo + department + process` 项目级提交本部门进度，一次写回项目下所有对应设备工序。
- 项目详情只在当前部门管理员所属部门的工序上显示“提交项目进度”，同一项目/同一工序只显示一次；任务页部门管理员点击工序提交也跳项目级提交。
- 部门管理员只能看到/操作本部门工序的提交入口；非本部门工序不显示提交按钮。项目派单仍归进度管理员/后台管理员。
- `actualStart` 实际开始字段最终写入来源为 mock 初始数据、Excel 导入字段、或进度提交页提交值；当前没有自动推算实际开始的逻辑。进度提交页默认值按最新口径从派单日期带出，用户仍可调整。
- 本轮验证：全量 `pages/services/utils` JS `node --check` 通过；`cloudfunctions/appStore/index.js` `node --check` 通过；`app.json` JSON.parse 通过。service 级断言覆盖秦朗设备提交自动完成、彭博单台设备提交被拒、彭博项目级提交结构设计一次写回 2 台设备。

## 2026-06-30 追加修复（工序展开、个人任务、参数库与设备派单入口）

- 修复项目详情工序展开空白：`pages/project-detail` 改为给每个设备写入 `expanded` 字段，WXML 不再用 `expandedDevices[item.id]` 动态下标；设备工序同时兜底调用 `getProcessesByDevice()`。
- 项目详情展开行恢复显示工序名、计划完成日期、负责人、状态和进度提交日期；待分配工序上为部门管理员显示“设备派单”入口，入口使用现有待分配任务 `rowKey`。
- `createProjectDispatch()` / `assignDepartmentTask()` 改为从 `auth-service.getCurrentUser()` 读取当前用户；`department-dispatch` 提交时也显式传当前用户。
- 参数库“按参数查”改为遍历设备并通过 `getDeviceParams()` 读取参数，不再直接遍历当前快照 `mockData.electricalParamValues`，从而保留种子参数回退。
- 设备派单候选人收紧为同业务部门普通员工，不再包含部门管理员本人、进度管理员或后台管理员。
- “我的”页角色预览主标题改为员工姓名，副标题显示业务部门和权限角色；选择秦朗时能直接看到人物。
- 本轮验证：全量 `pages/services/utils` JS `node --check` 通过；`cloudfunctions/appStore/index.js` `node --check` 通过；`app.json` JSON.parse 通过。service 级断言覆盖 `C26-0422` 两台设备各 8 条工序、工序计划时间/负责人、秦朗 3 条个人任务、参数库设备列表、按参数查“风量”、彭博设备派单权限和结构设计待分配任务 rowKey。
- 仍需人工在 WeChat DevTools 观察：项目详情展开、秦朗角色预览/任务页、参数库列表/按参数查/导出、部门管理员项目详情设备派单入口。

## 2026-06-30 追加修复（归档残留、权限角色与页面/action 清单）

- `services/data-service.js` 已移除 `archiveProject()` 函数体和导出；项目归档不再是当前业务功能。
- `permission-service.js` 已拆分后台权限角色和业务部门匹配：角色判断只看 `role/roleLabel`，部门判断只看 `department`；`isManager` 不再泛化授予部门管理员权限。
- `app.json` 当前注册 30 页，包含 `pages/login/index`，不包含 `pages/qb-transfer/index`；`pages/qb-transfer` 文件夹仍残留但未注册。
- `cloudfunctions/appStore` 当前真实 action 为 `getStore / saveStore / health / login / downloadTemplateFile`；已移除未路由的 `sendTemplateMsg` 死函数。
- `notification-service.sendTemplateMessage()` 已改为禁用态兼容返回，不再调用不存在的 `sendTemplateMsg` action；当前只保留前端订阅授权和本地站内通知。
- 文档已同步更新 `TODO.md`、`docs/PROJECT_SPEC.md`、`docs/HANDOFF_TO_NEXT_AGENT.md`、`services/README.md`、`cloudfunctions/README.md`。
- 本轮验证：全量 `pages/services/utils` JS `node --check` 通过；`cloudfunctions/appStore/index.js` `node --check` 通过；`app.json` JSON.parse 通过。service 级断言覆盖页面清单、归档入口、权限角色/业务部门拆分、工序展开、任务页个人任务、参数库列表/详情、参数对比导出、项目/设备派单权限、计划发货提前调整记录，以及数据看板统计来源。
- 仍需人工在 WeChat DevTools 观察页面视觉和点击反馈：项目详情工序展开、任务页个人任务、参数库列表/详情、参数对比导出、项目/设备派单权限、计划发货延期/提前/调整记录、数据看板。

## 2026-06-30 追加修复（计划发货提前 + 调整记录）

- `saveProject()` 新增 `shipDateHistory/shipDateAdjustType/shipDateAdjusted` 维护逻辑：首次调整自动补原计划发货日期，之后每次变更追加记录。
- 调整方向按最新一次变更判断：晚于调整前日期为 `delayed`，早于调整前日期为 `ahead`；项目列表和项目详情分别显示“延期”或红色“提前”。
- 项目总列表和项目详情的计划发货日期默认直接显示；只有发生调整时才显示“延期/提前”和“调整记录”。
- “调整记录”使用页面内自定义弹窗表格，字段为序号、下单日期、计划发货日期；记录顺序为旧到新，最新记录在最下面。
- 旧数据兼容：只有 `originalShipDate/shipDateDelayed` 且没有 `shipDateHistory` 时，`decorateProjectSummary()` 会合成两条调整记录。
- 延期不再作为工序状态：mock 数据中原 `已延期` 工序状态改为 `进行中`，逾期计算继续由计划完成日期和完成状态决定。

## 2026-06-30 追加修复（权限角色与业务部门拆分）

- 修复“我的”页开发角色预览同时高亮多个“当前”：`pages/mine` 不再用 `roleLabel` 判断当前态，改为 JS 按用户唯一标识生成 `active`。
- 权限角色和业务部门已明确拆分：`普通员工 / 进度管理员 / 综管部管理员 / 部门管理员 / 观察员 / 后台管理员` 是小程序后台权限角色；员工姓名后 `｜` 后面的内容是业务部门。
- 测试用户中 `采购部员工 / 工艺部门员工 / 项目部员工 / 电工房员工` 已统一改为 `roleLabel: "普通员工"`，部门仍保存在 `department`。

## 2026-06-30 追加修复（派单权限 + 测试负责人）

- 项目总列表项目卡片新增“编辑项目”按钮，仅进度管理员/后台管理员可见；张绍方可直接从总列表进入项目主要信息编辑页调整计划发货日期等字段。
- 项目详情项目级入口收紧：普通员工不显示“项目派单”，也不显示“编辑项目 / 删除项目 / 新增设备”。页面事件入口也二次校验 `canEditProject/canDispatchProject`。
- `permission-service.canDispatchProject()` 改为严格角色文本判断，仅后台管理员、进度管理员/项目管理员通过；避免旧缓存用户字段导致秦朗误显项目派单。
- UI 口径把“部门派单”改为“设备派单”：`department-dispatch` 页面标题、加载态、权限展示和权限管理标签均更新；内部 service 函数名暂保留兼容。
- 测试数据负责人调整：新增 `蒋相波｜项目部｜普通员工`、`卢建平｜电工房｜普通员工`；`陈七` 改为 `彭博｜结构设计部｜部门管理员`。
- 工序负责人调整：项目设计归蒋相波，结构设计归彭博，电箱组装归卢建平；`createDefaultProcesses()` 和任务生成/展示都会按默认负责人规范化旧快照。
- `filterTasksByView("mine")` 收紧为只按 `owner === 当前用户` 匹配，张绍方不再因为无部门/QB/旧工序混入个人任务。

## 2026-06-30 追加修复（逾期/延期口径拆分）

- 修正上一轮错误口径：项目列表/详情不再显示“逾期/延期”，统一显示“逾期”。逾期统计为工序级：当前日期达到或超过工序计划完成日期，且该工序未完成；同一设备多个工序逾期时逐条计数。
- “延期”仅表示进度管理员人工后延项目计划发货日期。`saveProject()` 在计划发货日期向后调整时记录 `originalShipDate/shipDateDelayed`，并输出 `shipDateTone/shipDateSuffix` 供列表和详情标色展示。
- 项目计划发货日期变更会同步到项目下设备的 `shipDate` 和对应“发货”工序的计划完成日期，避免项目/设备/发货工序日期不一致。
- 工序展示文案从“计划截止”改为“计划完成”；工序实际完成/进度提交日期晚于计划完成日期时，`decorateDeviceSummary()` 输出 `actualFinishTone: late-finish`，项目详情展开工序行标红该日期。
- 项目编辑入口收紧：项目详情“编辑项目/删除项目”和项目列表“新建”只对进度管理员/后台管理员显示；`project-edit` 页面直达时也会校验该权限。进度管理员仍可手动修改计划发货日期。
- 顺手修复 `saveProject()` 未持久化 `adminOrderDate/adminOrderYear/adminOrderMonth/archivePath` 的隐患，确保项目列表按进度管理员下单时间排序长期稳定。

## 2026-06-29 追加修复（项目排序 + QB 高亮 + 组织清单）

- 修复项目总列表排序回退：`data-service.listProjects()` 现在按进度管理员下单时间 `adminOrderDate` 倒序，且恢复 `year/month` 筛选；同日再按项目号倒序。
- 完成项目 QB 视觉规则已落地：完成项目如果存在未关闭 QB，项目列表状态标签输出 `warning-status` 显示黄色；QB 关闭后恢复 `done-status` 浅灰。
- 注意：本节原先把“延期”和“逾期”合并展示的口径已在 2026-06-30 修正，不再使用“逾期/延期”标签。
- 新增组织样例：`工艺部门`、员工 `刘爽｜工艺部门｜普通员工`；同时让 `utils/mock-data.js` 和 `utils/mock-user.js` 保持一致。
- 登录绑定部门清单补齐 `制造部 / 总经办/销售/市场 / 信息化`，解决角色预览能看到但登录绑定不能选的问题。
- “我的”页后台管理入口已新增“数据看板”菜单，路径 `/pages/dashboard/index`。注意任务页“看板视图”是任务拖拽看板，两者不是同一个页面。
- 本轮验证：`node --check` 覆盖 `data-service.js/mock-data.js/mock-user.js/pages/mine/index.js` 通过；`app.json` JSON.parse 通过；service 级验证项目排序、部门清单、角色预览、完成项目未关闭 QB 高亮和关闭后恢复均通过。

## 2026-06-29 接手修复（参数导出 + QB只读 + 权限/看板）

- 参数对比页已实现真实 `.xlsx` 导出：`pages/param-compare/*` 新增按项目号、按下单时间区间、按参数名 + 设定值筛选；项目-设备子菜单支持“全部设备”和单台设备互斥。
- 新增 `services/xlsx-writer.js`，使用 `services/vendor/fflate.js` 生成 OpenXML xlsx；已通过 Node 解包验证存在 `xl/workbook.xml` 和 `xl/worksheets/sheet1.xml`。
- `data-service.js` 新增 `getParamExportOptions()` / `buildParamExportData()` / `exportParamWorkbook()`；参数文本按 `value + unit` 输出，和页面展示一致。
- 任务页看板拖拽已改为持久化写回：`pages/tasks/index.js` 调用 `dataService.updateTaskStatusByRowKey()`；service 对普通 `tasks` 和 `processMap` 工序任务分别写回。
- 秦朗｜电气设计部 service 级复测通过：`filterTasksByView("mine")` 返回 3 条任务，其中 2 条为电气设计工序；`C26-0422` 两台设备各 8 条工序；参数详情 48 条。
- QB 模块进一步只读收敛：`app.json` 移除 `pages/qb-transfer/index`；`pages/qb-detail/index.js` 改为只读加载；`pages/my-permissions/index.js` 移除 QB 转交权限展示；service 旧写函数保留函数名但只返回只读提示。
- QB 钉钉同步接口已预留：`upsertQbFromDingTalk()` / `syncQbFromDingTalk()`，保存 `dingTalk.instanceId/processCode/businessId/url/raw`，供后续云函数导入。
- 权限管理从静态矩阵改为可保存配置：`utils/mock-data.js` 新增 `permissions`；`services/cloud-data.js` 纳入 `permissions` 快照/细集合；`pages/permission-manage/*` 可编辑保存权限矩阵。
- 参数库顶部 `模板 / 批量 / 对比` 按钮移除 `line-height` 居中依赖，改为 flex 纯居中。
- 数据看板页为 `pages/dashboard/index`，入口在“我的”页后台管理菜单，统计来自 `getDashboardStats()`；service 级验收可返回项目、设备、QB、任务、我的任务、工作量、最近操作。
- 本轮自动化验证：全量 `pages/services/utils` JS `node --check` 通过；`app.json` JSON.parse 通过；参数导出按项目生成 2 行 xlsx，按 `前表冷风量 == 53 m3/h` 可筛出 `C26-0422-01`。
- 注意：本轮工具环境没有暴露可点击微信开发者工具窗口的 computer-use 控件，所以未能直接执行 DevTools 视觉点击复测。已完成 service/构建级复测，建议人工再观察项目详情工序展开、任务页个人任务、参数库列表/详情、参数模板/批量、参数对比导出、数据看板。

## 2026-06-28 接手修复（参数库 + 任务页）

- 已按当前代码第三轮复查：页面层保持 `pages -> services/*`，`pages` 目录未再直读 `utils/mock-data.js` / `utils/mock-user.js`。
- 修复 `getRawProject()` / `getRawDevice()` 宽松兜底：缺少或不匹配的项目号/设备 id 不再回退第一条记录；`getDevice()` 无匹配时返回 `null`。
- 修复参数库样例参数丢失：`getDeviceParams()` 在当前 store 缺少 `electricalParamValues` 时，按设备 id 或设备号回退到本地 mock 样例参数，但仍保留参数库权限校验，非可见部门不能查看。
- 二次修正真实原因：`cloud-data.js` 会原地覆盖 `require("../utils/mock-data")` 的共享对象，原先 `localMockData = mockData` 也会被旧本地模拟云快照污染；现已在 `data-service.js` 启动时深拷贝干净种子数据作为回退源。
- 修复参数库“模板 / 批量 / 对比”顶部按钮文字偏下：`pages/params/index.wxss` 明确使用 flex、固定高度和 line-height 居中。
- 修复参数模板保存/删除页面直读 mock 的问题：新增 `saveParamTemplate()` / `deleteParamTemplate()` service 入口，并记录 audit。
- 修复任务页秦朗不显示个人任务：`decorateTask()` 会按任务设备 + 工序从 `processMap` 回填工序负责人，`filterTasksByView("mine")` 可匹配秦朗的电气设计任务。
- 二次增强任务来源：`listTasks()` 会把当前设备 `processMap` 生成的工序任务与旧 `tasks` 快照按项目号 + 设备号 + 工序去重合并，旧快照为空或缺 owner 时仍能显示个人任务。
- 三次修正运行态空态：`buildTasksFromProcessMap()` 在当前本地模拟云快照缺少 `processMap` 时，会按设备号回退干净种子数据中的工序；秦朗“我的 + 仅看临期/逾期”应显示 2 条电气设计今日到期任务。
- 修复项目详情展开工序空白：新增统一 `getProcessesForDevice()` / `normalizeDisplayProcesses()`，`decorateDeviceSummary()`、`getProcessesByDevice()`、任务生成和进度统计共用同一条工序读取路径；当前快照缺少 `processMap` 时按设备号回退干净种子工序。
- 修复参数详情页空态：`getDictionary()` 在当前快照缺少 `paramCategories` 时回退干净种子字典；`param-detail` 每次 `onShow()` 重新读取参数和分类，并把参数自身存在但字典缺失的分类追加到分组顺序。
- 修复顶部参数库操作按钮：`模板 / 批量 / 对比` 不再使用微信原生 `button size="mini"`，改为同样外观的 `view.top-action-btn`，避免原生按钮内部行高导致文字偏下。
- 修复部门管理员派单权限：项目详情页仅进度管理员/后台管理员显示“项目派单”；`project-dispatch` 页面和 `createProjectDispatch()` service 入口均阻断部门管理员。部门管理员只能通过任务页待分配任务进入部门派单。
- 部门派单收紧：`getDepartmentDispatchPreview()` 仅列出同部门普通员工；`assignDepartmentTask()` service 入口校验当前用户具备部门派单权限，且非后台管理员只能派给同部门普通员工。
- 修复批量停用参数调用形态：`disableParam()` 同时支持 `(deviceId, paramId)` 和 `{ deviceId, paramId }`。

验证结果：
- `node --check` 覆盖本次相关 JS 文件通过，`app.json` JSON.parse 通过。
- Node service 验证：秦朗｜电气设计部可见 2 台参数设备；`dvc1` 返回 48 条参数并形成 15 个参数分组；“我的”在“仅看临期/逾期”开启时返回 2 条电气设计今日到期任务。

## 第11轮新增（2026-06-27 项目列表与 QB 钉钉研究）

- 项目总列表删除“已归档”筛选，项目详情删除“归档项目”按钮，`data-service.js` 删除 `archiveProject()` 服务入口和导出；代码范围内已无归档可调用入口。
- 项目总列表保留 `全部 / 进行中 / 延期 / QB` 4 个筛选项；新增年月滚轮筛选，默认当前年月，年份范围 2000-2099，月份 01-12。
- 项目列表按 `adminOrderDate`（进度管理员下单时间）过滤和倒序展示；mock 项目补 `adminOrderDate`，新建/编辑项目支持日期 picker，导入新增项目缺省使用当天。
- 项目自动完成规则已加入 service 层：所有启用设备均存在“发货”工序，且每台设备“发货”均为“已完成”时，项目 `status` 自动更新为“已完成”；完成项目总体进度显示 100%。
- QB 已切换为只读模块：`createQb/transferQb/appendQbProgress/addQbAssignee/updateQbAssigneeStatus/removeQbAssignee/closeQb` 均保留函数名但返回只读提示，不再改本地数据；后续接钉钉 OpenAPI 时从这些接口或新增同步函数接入。
- QB 列表页改为“QB 时间轴”，按项目 `adminOrderDate` 月份分组，组内按 `occurredAt` 倒序；项目总列表筛选名从“有 QB”改为“QB”。
- 项目记录已用 `adminOrderDate` 派生 `adminOrderYear` / `adminOrderMonth` / `archivePath`。`archivePath` 形如 `projects/YYYY/MM`，后续云存储或导出归档可直接按该路径组织；数据库仍以集合字段查询为主。
- QB 钉钉开放接口可行性研究已记录在 `docs/QB_DINGTALK_FEASIBILITY.md`：推荐钉钉作为 QB 建单/关单源头，小程序只读；通过云函数中转 OpenAPI/事件订阅，禁止小程序前端持有钉钉密钥。

## 第12轮新增（2026-06-28 Excel 标准模板 + 参数库权限）

- 标准导入模板已输出 v4：`outputs/templates/小程序标准导入模板_单台设备进度_v4.xlsx`，`import-service.js` 的模板路径和下载文件名已同步到 v4。
- Excel 导入页原“复制模板路径”已改为“下载模板”。正式下载链路为 `cloudFileID` → `wx.cloud.downloadFile` → `wx.openDocument(showMenu: true)`；备选链路为 `httpsUrl` → `wx.downloadFile` → `wx.openDocument`；未配置云端文件时才回退本机开发模板路径。
- `services/cloud-config.js` 已新增 `standardTemplates.progressImport` 配置：上线时把 v4 模板上传到微信云开发云存储，推荐云路径 `templates/小程序标准导入模板_单台设备进度_v4.xlsx`，复制返回的 `fileID` 到 `cloudFileID`。
- Excel 导入确认前新增“项目下单时间”弹窗：按项目号分组，用日期 picker 为每个项目确认 `adminOrderDate`；`confirmImport(rows, { projectOrderDates })` 以该值为准，并写入 `adminOrderYear` / `adminOrderMonth` / `archivePath`。
- v4 模板通过当前 `import-service.parseExcelPreview()` 验证：表头缺失 0、未知表头 0、错误 0；示例行生成 1 台设备和 10 条当前工序任务。唯一 warning 是示例行提醒，真实导入前替换/删除即可。
- `xlsx-reader.js` 已增强：兼容带命名空间前缀的 workbook/sheet/row/cell/sharedString/styles 标签，并修复自闭合空单元格被误吞导致列错位的问题。
- 参数库权限已加入 service 层：`paramLibraries` 配置数组支持 `key/name/sourceKey/visibleDepartments`。默认 `electrical` 映射 `electricalParamValues`，仅 `电气设计部` 可见，后台管理员默认可见。
- 字典管理新增“参数库权限”页签，可按参数库标识符勾选多个可见部门并保存到 mock 字典；后续云化时迁移到字典/权限集合。
- `getDeviceParams/listParamDevices/searchParams/getParamCompareData` 通过 service 层权限过滤；无权限部门拿不到电气参数库数据。

## 第10轮修复（2026-06-26 界面与参数对比修复）

- 任务页首次进入空白已修复：`pages/tasks/index.js` 初始化 `viewMode: "list"`，看板模式下重新加载任务会同步重建 `kanbanColumns`。
- 参数库顶部按钮排版已修复：`pages/params/index.wxml/.wxss` 将 `模板 / 批量 / 对比` 统一为 `top-action-btn`。
- 参数对比设备选中态已增强：`pages/param-compare/index.js` 生成 `selected` 字段，WXML 用 `item.selected`，选中后有高亮和勾选。
- 参数对比模板表达式已简化：差异单元格由 `services/data-service.js` 输出 `val.isDiff`，WXML 不再写复杂 value/unit 比较表达式。
- 参数单位口径修复：`listParamDevices()` 不再硬编码 `CMH`，读取参数自身 `unit`；`getParamCompareData()` 差异判断同时比较 `value + unit`。
- mock 样例数据修正：`C26-0422-02` 表冷风量从 `38000 CMH` 改为与 `C26-0422-01` 一致的 `m3/h` 口径，并补齐中/后表冷参数。
- “我的”页云服务区域已改为最终版友好展示：普通用户只看到“数据同步”简洁状态；技术诊断、集合/文档/health 细节和重连/拉取/诊断/同步按钮仅 `mockPreviewEnabled` 或后台管理员可展开查看。
- 角色/部门/工序命名已统一：新增“部门管理员”角色；负责部门列表为 `项目部 / 电气设计部 / 结构设计部 / 电工房 / 结构班组 / 电气班组 / 采购部 / 仓库部 / 品质部 / 生产部`；张绍方为 `进度管理员｜制造部`；观察员归属为“总经办/销售/市场”；后台管理员样例用户显示为 `IT｜信息化`。
- 项目派单工序已统一：`机械采购/电气采购/采购部门` 规范为“采购物料”，`结构装配/电气装配` 规范为“结构总装/电气总装”，`品质跟进/工艺确认` 停用过滤。`data-service.js` 和 `import-service.js` 均保留旧名兼容映射。
- 已修复 `project-detail/index.wxml` 工序负责人坏模板，以及 `qb-create/index.wxml` 当前登录部门坏模板。
- 最新口径补充：张绍方显示为 `进度管理员｜制造部`；电气负责部门为“电气设计部”；工序“采购部门”已改为“采购物料”；“工艺确认”停用过滤；负责部门列表加入“品质部/生产部”。项目派单页面选择工序会自动带出默认负责部门，用户仍可手动修改。
- 参数库批量模式已修复按钮排版和设备选择框定位：批量按钮使用 `batch-action-btn`，设备卡片使用 `param-card/batch-card` 定位和左侧留白。

注意：`C26-0422-01 / C26-0422-02` 的 `SJD125-38000Z-H1` 仍是 mock 样例设备型号，未凭空修改。真实型号和真实参数后续必须从标准 Excel 或正式云数据导入确认。

## 第9轮新增（2026-06-26 云服务补全）

### 1. 消息通知全覆盖
之前只在 `assignDepartmentTask` / `transferQb` / `appendQbProgress` / `closeQb` 触发了通知。本轮新增：
- `createQb` → 通知 QB 负责人
- `createProjectDispatch` → 通知派单目标部门（每个工序一条通知）

现在 6 个写操作全部接入通知触发，覆盖了所有会产生"需要告知他人"的业务场景。

### 2. 微信订阅消息基础设施
- `notification-service.js`：新增 `requestSubscribeMessage()` / `sendTemplateMessage()` / `sendTaskAssignTemplate()`
- 旧口径提醒：`cloudfunctions/appStore/index.js` 当前不包含 `sendTemplateMsg` action；真实第 5 个 action 是 `downloadTemplateFile`。
- `pages/notifications`：新增"通知授权"按钮（调用 `wx.requestSubscribeMessage`）
- 模板 ID 配置位 `WX_TEMPLATE_IDS` 已预留，等 WeChat 后台申请后填入即可

### 3. 云存储接入验证
- 确认三页面（project-detail / progress-submit / qb-create）均已接入 `uploadFilesToCloud` + `getCloudFileTempUrl`
- attachment-service 三种模式（mock / cloud / cloud-error）均已覆盖
- 无需额外代码修改，TODO 中此项误标为未完成

## 三种运行模式

| 模式 | 条件 | transport | 说明 |
|------|------|-----------|------|
| local-mock | wx.cloud 不可用 | local-mock | wx.storage 模拟全链路 |
| function | 云函数已部署 | function | wx.cloud.callFunction |
| direct | fallback / transport="direct" | direct | 直接 wx.cloud.database |

## P0 操作清单（真实云上线）
1. 开通云开发 → envId → cloud-config.js
2. 创建 10 个集合
3. 部署云函数 appStore
4. 诊断 → 全绿
5. 上传 v4 Excel 标准模板到云存储 → 填入 `standardTemplates.progressImport.cloudFileID`
6. 在 WeChat 后台申请订阅消息模板 → 填入 WX_TEMPLATE_IDS
7. 同步 → 关闭重开 → 拉取 → 验证
8. 安全规则

## 不可破坏的约定
- 不重设计架构、不恢复原生 tabBar、页面不直读 mock
- Excel 不走机器猜表头
- getProject/getDevice 等值校验全覆盖
