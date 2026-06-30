# Agent Handoff Rules

本文件给后续 Codex/agent 新对话快速接手用。更完整的项目入口见根目录 `README.md`、`TODO.md`、`docs/HANDOFF_TO_NEXT_AGENT.md` 和 `services/README.md`。

## 工作方式

- 不重构架构，不恢复原生 `tabBar`，不恢复旧首页按钮。
- 页面需要数据或提交操作时，优先找或新增 `services/data-service.js`、`auth-service.js`、`permission-service.js` 等入口。
- 页面不得直接读取 `utils/mock-data.js` 或 `utils/mock-user.js`。
- service 需要当前本地数据时，可以读写 `utils/mock-data.js`。
- service 写操作后，该持久化的走 `cloud-data.js`/本地模拟云存储，该记录日志的走 `audit-service.js`。
- 只有补初始样例数据时，才直接改 mock 文件。
- 每完成一阶段，同步更新 `TODO.md`、`docs/PROJECT_SPEC.md`、`docs/HANDOFF_TO_NEXT_AGENT.md`、`services/README.md`；如是根口径变化，也更新 `README.md` 和本文件。

## 必守架构

- 路径保持：`pages -> services/* -> utils/mock-data.js / cloud-data.js`。
- `getProject/getDevice/getUser` 等入口必须严格等值查找，不得缺参时回退第一条。
- 权限角色和业务部门严格分开：角色看 `role/roleLabel`，部门看 `department`，不要用 `isManager` 泛化授予部门管理员权限。
- QB 保持只读，只预留钉钉同步接口，不恢复小程序内转交、进展、关单、建单。

## 当前关键业务口径

- 普通员工按单台设备工序提交进度，提交后自动记为“已完成”。
- 部门管理员不按单台设备提交进度，只按项目提交本部门工序进度。
- 部门管理员项目级提交入口由 `data-service.getDepartmentProjectSubmitOptions(projectNo, user)` 生成，只有项目下存在当前部门工序时才显示。
- 项目详情展开后的设备工序行不得显示“提交项目进度”；该按钮只保留在项目级入口。
- 部门管理员项目级提交前必须先调用 `getProjectDepartmentProgressPreview()`。若存在未完成设备，页面展示“未完成设备 / 负责人 / 预计完成时间”阻断表，按钮只有“已知晓”，点击后返回前置界面，本次提交失败且不写任何工序。
- `C26-0501` 可以存在于项目总列表；不要因为标题文案问题隐藏或删除它。它当前没有设备/工序，所以没有项目级提交入口。
- 项目总列表顶部只显示“项目总列表”，不要加“除湿机项目试点”等静态小字。

## 实际开始日期口径

- `actualStart` 最终写入来自样例数据、Excel 导入字段或进度提交页提交值，不由系统自动推算。
- 进度提交页默认值：
  - 部门管理员项目级提交：优先读取项目 `adminOrderDate`，即项目卡片上的“下单时间/进度管理员派单时间”；再兜底显式 `dispatchedAt` 或工序 `actualStart`。
  - 普通员工设备级提交：读取部门管理员派给员工的 `assignedAt`；缺失时再兜底工序 `actualStart`。
- C26-0422 当前样例：项目级电气设计默认 `2026-06-18`；秦朗设备级电气设计默认 `2026-06-21`。

## 联动回归

项目详情工序展开、任务页个人任务、参数库列表/详情/导出共用底层设备、工序、参数和云快照回退链路。修改相关功能时，必须同时验证：

- `getDevicesByProject()` / `getProcessesByDevice()`
- `filterTasksByView("mine")`
- `listParamDevices()` / `getDeviceParams()` / `searchParams()`

本地模拟云快照可能缺少 `processMap`、`electricalParamValues`、`paramCategories` 等细字段。service 层必须保留种子数据回退，不得让页面空白，不得让页面绕过 service 直接读 mock。

## 当前测试数据口径

- 当前测试用户、业务部门、工序负责人以 `outputs/relationship-review-20260630/人员角色部门工序核对表.xlsx` 的落地结果为准。
- 陈尚杰是电气设计部部门管理员；秦朗是电气设计部普通员工；彭博是结构设计部普通员工。
- 当前工序包含 `ERP录入`、`物料采购`；旧 `采购物料` 只能作为兼容输入规范到 `物料采购`。

