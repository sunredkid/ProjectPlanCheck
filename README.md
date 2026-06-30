# 除湿机生产进度小程序

本项目是公司内部微信小程序，用于管理除湿机项目、设备工序、任务、参数库、QB 只读展示、Excel 导入导出和本地/云端数据同步。

## 接手必读

新对话或新 agent 接手时，先读这些文件：

1. `AGENTS.md`
2. `TODO.md`
3. `docs/PROJECT_SPEC.md`
4. `docs/HANDOFF_TO_NEXT_AGENT.md`
5. `services/README.md`
6. `cloudfunctions/README.md`
7. `utils/README.md`
8. 如涉及 QB/钉钉，再读 `docs/QB_DINGTALK_FEASIBILITY.md`

业务真相以当前代码和用户最新口径为准；旧文档中可能有历史口径，遇到不一致要边核对边修正文档。

## 架构边界

- 不重构架构，不恢复原生 `tabBar`，不恢复旧首页按钮。
- 页面只调用 service：`pages -> services/* -> utils/mock-data.js / cloud-data.js`。
- 页面不得直接读取 `utils/mock-data.js` 或 `utils/mock-user.js`。
- service 需要本地数据时可以读写 mock；写操作后，该持久化的走 `cloud-data.js`/本地模拟云存储，该记录日志的走 `audit-service.js`。
- 只有补初始样例数据时，才直接修改 mock 文件。
- 权限判断要区分后台权限角色和业务部门；不要用 `isManager` 泛化判断部门管理员。

## 当前业务口径

- 权限角色包括：普通员工、部门管理员、进度管理员、综管部管理员、观察员、后台管理员。
- 业务部门和权限角色不是一回事；如电气设计部、结构设计部、项目部、采购部等是业务部门。
- 当前人员/部门/工序以 `outputs/relationship-review-20260630/人员角色部门工序核对表.xlsx` 落地结果为准。
- 陈尚杰是电气设计部部门管理员；秦朗是电气设计部普通员工；彭博是结构设计部普通员工。
- 当前工序包括：项目设计、结构设计、电气设计、ERP录入、物料采购、电气盘安装、结构总装、电气总装、电箱组装、调试、发货。
- 旧工序名要在 service 层兼容规范化，例如 `采购物料` -> `物料采购`，`电工房` -> `电气电控车间`。

## 进度提交规则

- 普通员工按单台设备工序提交进度，提交后自动记为“已完成”。
- 部门管理员不按单台设备提交进度，只按项目提交本部门工序进度。
- 部门管理员项目级提交入口由 `data-service.getDepartmentProjectSubmitOptions(projectNo, user)` 生成；只有项目下存在当前部门工序时才显示。
- `C26-0501` 当前有项目记录但没有设备/工序，所以陈尚杰看不到“提交项目进度”是正常的。
- 项目详情展开后的每台设备工序行不得显示“提交项目进度”；该按钮只保留在项目级入口。
- 部门管理员提交项目前必须先走 `getProjectDepartmentProgressPreview()`。如有未完成设备，弹出“未完成设备 / 负责人 / 预计完成时间”表，按钮只有“已知晓”，关闭后返回前置界面，本次提交失败且不写回任何工序。
- “写回”指把提交结果写入底层数据对象，例如工序的 `status / actualStart / actualFinish / quantity / remark / attachments`。

## 实际开始日期

- `actualStart` 不自动推算；最终写入来自初始样例数据、Excel 导入字段或进度提交页提交值。
- 进度提交页的默认实际开始日期按派单口径带出：
  - 部门管理员项目级提交：优先读取项目 `adminOrderDate`，也就是项目卡片上的“下单时间/进度管理员派单时间”；再兜底显式 `dispatchedAt` 或工序 `actualStart`。
  - 普通员工设备级提交：读取部门管理员派给员工的 `assignedAt`；缺失时再兜底工序 `actualStart`。
- 对 C26-0422 当前样例：项目级电气设计默认是 `2026-06-18`；秦朗设备级电气设计默认是 `2026-06-21`。

## 联动回归要求

项目详情工序展开、任务页个人任务、参数库列表/详情/导出共用设备、工序、参数底层读取和回退链路。任何修改触及设备、工序、任务、参数、导入、权限、云快照或页面数据加载时，必须一起验证：

- `getDevicesByProject()` / `getProcessesByDevice()`
- `filterTasksByView("mine")`
- `listParamDevices()` / `getDeviceParams()` / `searchParams()`

本地模拟云快照可能缺少 `processMap`、`electricalParamValues`、`paramCategories` 等细字段，service 层必须保留种子数据回退，不能让页面空白，也不能让页面绕过 service 直接读 mock。

## 项目列表与标题

- 项目总列表顶部只显示主标题“项目总列表”，不要添加静态小字如“除湿机项目试点”。
- 不得因为标题文案问题隐藏或删除项目记录，例如 `C26-0501`。
- 项目列表按 `adminOrderDate` 筛选和排序。

## QB 口径

- QB 在小程序内保持只读。
- 不恢复小程序内转交、进展、关单、建单。
- 仅保留钉钉同步预留接口：`upsertQbFromDingTalk()` / `syncQbFromDingTalk()`。

## 常用验证命令

```powershell
Get-ChildItem -Recurse pages,services,utils -Filter *.js | ForEach-Object { node --check $_.FullName }
node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('app.json ok')"
```

页面直读 mock 扫描：

```powershell
$matches = Get-ChildItem -Recurse pages -Filter *.js | Select-String -Pattern 'utils/mock-data|utils/mock-user'
if ($matches) { $matches | ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line)" } } else { 'pages mock direct require scan ok' }
```

