const users = [
  { id: "u1", name: "秦朗", phone: "18352439458", department: "电气设计部", role: "普通员工", roleLabel: "普通员工", isManager: false, status: "启用" },
  { id: "u2", name: "李洋", phone: "138****0101", department: "品质部", role: "普通员工", roleLabel: "普通员工", isManager: false, status: "启用" },
  { id: "u3", name: "张绍方", phone: "138****0201", department: "制造部", role: "进度管理员", roleLabel: "进度管理员", isManager: true, status: "启用" },
  { id: "u4", name: "总经理", phone: "138****0301", department: "总经办/销售/市场", role: "观察员", roleLabel: "观察员", isManager: false, status: "启用" },
  { id: "u5", name: "IT", phone: "138****0000", department: "信息化", role: "后台管理员", roleLabel: "后台管理员", isManager: true, status: "启用" },
  { id: "u6", name: "彭博", phone: "138****0401", department: "结构设计部", role: "普通员工", roleLabel: "普通员工", isManager: false, status: "启用" },
  { id: "u7", name: "郭敬锋", phone: "138****0501", department: "仓库部", role: "普通员工", roleLabel: "普通员工", isManager: false, status: "启用" },
  { id: "u8", name: "吴洁", phone: "138****0601", department: "综管部", role: "综管部管理员", roleLabel: "综管部管理员", isManager: true, status: "启用" },
  { id: "u9", name: "刘爽", phone: "138****0701", department: "工艺部门", role: "普通员工", roleLabel: "普通员工", isManager: false, status: "启用" },
  { id: "u10", name: "蒋相波", phone: "138****0801", department: "项目部", role: "普通员工", roleLabel: "普通员工", isManager: false, status: "启用" },
  { id: "u11", name: "卢建平", phone: "138****0901", department: "电气电控车间", role: "普通员工", roleLabel: "普通员工", isManager: false, status: "启用" },
  { id: "u12", name: "郑雪莲", phone: "138****1001", department: "采购部", role: "普通员工", roleLabel: "普通员工", isManager: false, status: "启用" },
  { id: "u13", name: "孙志勇", phone: "138****1301", department: "生产装配", role: "普通员工", roleLabel: "普通员工", isManager: false, status: "启用" },
  { id: "u14", name: "朱建闯", phone: "138****1401", department: "生产装配", role: "普通员工", roleLabel: "普通员工", isManager: false, status: "启用" },
  { id: "u15", name: "王国峰", phone: "138****1501", department: "壁板车间", role: "普通员工", roleLabel: "普通员工", isManager: false, status: "启用" },
  { id: "u16", name: "陈尚杰", phone: "138****1601", department: "电气设计部", role: "部门管理员", roleLabel: "部门管理员", isManager: true, status: "启用" },
  { id: "u17", name: "苏高森", phone: "138****1701", department: "总经办/销售/市场", role: "观察员", roleLabel: "观察员", isManager: false, status: "启用" }
];

const departments = [
  { id: "d1", name: "项目部", managers: "蒋相波", status: "启用", sort: 1 },
  { id: "d2", name: "电气设计部", managers: "陈尚杰", status: "启用", sort: 2 },
  { id: "d3", name: "结构设计部", managers: "", status: "启用", sort: 3 },
  { id: "d4", name: "工艺部门", managers: "刘爽", status: "启用", sort: 4 },
  { id: "d5", name: "采购部", managers: "郑雪莲", status: "启用", sort: 5 },
  { id: "d6", name: "电气电控车间", managers: "卢建平", status: "启用", sort: 6 },
  { id: "d7", name: "生产装配", managers: "孙志勇、朱建闯", status: "启用", sort: 7 },
  { id: "d8", name: "壁板车间", managers: "王国峰", status: "启用", sort: 8 },
  { id: "d9", name: "品质部", managers: "李洋", status: "启用", sort: 9 },
  { id: "d10", name: "仓库部", managers: "郭敬锋", status: "启用", sort: 10 },
  { id: "d11", name: "总经办/销售/市场", managers: "总经理、苏高森", status: "启用", sort: 11 },
  { id: "d12", name: "制造部", managers: "张绍方", status: "启用", sort: 12 },
  { id: "d13", name: "信息化", managers: "IT", status: "启用", sort: 13 },
  { id: "d14", name: "综管部", managers: "吴洁", status: "启用", sort: 14 }
];

const projects = [
  {
    id: "p1",
    projectNo: "C26-0422",
    name: "中创新航藤洲",
    customer: "中创新航",
    admin: "张绍方",
    adminOrderDate: "2026-06-18",
    adminOrderYear: "2026",
    adminOrderMonth: "06",
    archivePath: "projects/2026/06",
    shipDate: "2026-07-10",
    progress: 67,
    done: 68,
    doing: 12,
    delayed: 3,
    notStarted: 19,
    qbOpen: 1,
    status: "进行中"
  },
  {
    id: "p2",
    projectNo: "C26-0501",
    name: "除湿机试点项目",
    customer: "示例客户",
    admin: "张绍方",
    adminOrderDate: "2026-06-25",
    adminOrderYear: "2026",
    adminOrderMonth: "06",
    archivePath: "projects/2026/06",
    shipDate: "2026-07-25",
    progress: 28,
    done: 20,
    doing: 16,
    delayed: 0,
    notStarted: 36,
    qbOpen: 0,
    status: "进行中"
  }
];

const devices = [
  {
    id: "dvc1",
    projectNo: "C26-0422",
    deviceNo: "C26-0422-01",
    seq: "第1台",
    area: "DHU-01 注液区",
    model: "SJD125-38000Z-H1",
    shipDate: "2026-07-10",
    progress: 62
  },
  {
    id: "dvc2",
    projectNo: "C26-0422",
    deviceNo: "C26-0422-02",
    seq: "第2台",
    area: "DHU-02 涂布区",
    model: "SJD125-38000Z-H1",
    shipDate: "2026-07-10",
    progress: 50
  }
];

const processMap = {
  dvc1: [
    { name: "项目设计", status: "已完成", owner: "蒋相波", phone: "138****0801", due: "2026-06-20", actualStart: "2026-06-15", actualFinish: "2026-06-19" },
    { name: "结构设计", status: "进行中", owner: "彭博", phone: "138****0401", due: "2026-06-26", actualStart: "2026-06-21", actualFinish: "" },
    { name: "电气设计", status: "进行中", owner: "秦朗", phone: "18352439458", due: "2026-06-28", actualStart: "2026-06-21", actualFinish: "" },
    { name: "ERP录入", status: "未开始", owner: "刘爽", phone: "138****0701", due: "2026-06-29", actualStart: "", actualFinish: "" },
    { name: "物料采购", status: "未开始", owner: "郑雪莲", phone: "138****1001", due: "2026-07-01", actualStart: "", actualFinish: "" },
    { name: "电气盘安装", status: "未开始", owner: "卢建平", phone: "138****0901", due: "2026-07-03", actualStart: "", actualFinish: "" },
    { name: "结构总装", status: "未开始", owner: "孙志勇", phone: "138****1301", due: "2026-07-05", actualStart: "", actualFinish: "" },
    { name: "电气总装", status: "未开始", owner: "朱建闯", phone: "138****1401", due: "2026-07-07", actualStart: "", actualFinish: "" },
    { name: "电箱组装", status: "未开始", owner: "王国峰", phone: "138****1501", due: "2026-07-08", actualStart: "", actualFinish: "" },
    { name: "调试", status: "未开始", owner: "李洋", phone: "138****0101", due: "2026-07-09", actualStart: "", actualFinish: "" },
    { name: "发货", status: "未开始", owner: "刘爽", phone: "138****0701", due: "2026-07-10", actualStart: "", actualFinish: "" }
  ],
  dvc2: [
    { name: "项目设计", status: "已完成", owner: "蒋相波", phone: "138****0801", due: "2026-06-20", actualStart: "2026-06-15", actualFinish: "2026-06-19" },
    { name: "结构设计", status: "进行中", owner: "彭博", phone: "138****0401", due: "2026-06-24", actualStart: "2026-06-21", actualFinish: "" },
    { name: "电气设计", status: "进行中", owner: "秦朗", phone: "18352439458", due: "2026-06-28", actualStart: "2026-06-22", actualFinish: "" },
    { name: "ERP录入", status: "未开始", owner: "刘爽", phone: "138****0701", due: "2026-06-29", actualStart: "", actualFinish: "" },
    { name: "物料采购", status: "未开始", owner: "郑雪莲", phone: "138****1001", due: "2026-07-01", actualStart: "", actualFinish: "" },
    { name: "电气盘安装", status: "未开始", owner: "卢建平", phone: "138****0901", due: "2026-07-03", actualStart: "", actualFinish: "" },
    { name: "结构总装", status: "未开始", owner: "孙志勇", phone: "138****1301", due: "2026-07-05", actualStart: "", actualFinish: "" },
    { name: "电气总装", status: "未开始", owner: "朱建闯", phone: "138****1401", due: "2026-07-07", actualStart: "", actualFinish: "" },
    { name: "电箱组装", status: "未开始", owner: "王国峰", phone: "138****1501", due: "2026-07-08", actualStart: "", actualFinish: "" },
    { name: "调试", status: "未开始", owner: "李洋", phone: "138****0101", due: "2026-07-09", actualStart: "", actualFinish: "" },
    { name: "发货", status: "未开始", owner: "刘爽", phone: "138****0701", due: "2026-07-10", actualStart: "", actualFinish: "" }
  ]
};

const qbList = [
  { qbNo: "QB26-534", projectNo: "C26-0422", title: "电柜风扇防护网不贴合", process: "电气电控", owner: "秦朗", status: "处理中", occurredAt: "2026-06-08" }
];

const tasks = [
  { type: "生产任务", project: "C26-0422 中创新航藤洲", device: "C26-0422-01 第1台", process: "电气设计", department: "电气设计部", dueDate: "2026-06-28", status: "进行中", assignedAt: "2026-06-21" },
  { type: "生产任务", project: "C26-0422 中创新航藤洲", device: "C26-0422-02 第2台", process: "结构设计", department: "结构设计部", dueDate: "2026-06-26", status: "进行中" },
  { type: "QB待处理", project: "C26-0422 中创新航藤洲", qbNo: "QB26-534", title: "电柜风扇防护网不贴合", status: "处理中" }
];

function getProject(projectNo) {
  return projects.find((item) => item.projectNo === projectNo) || projects[0];
}

function getDevicesByProject(projectNo) {
  return devices
    .filter((item) => item.projectNo === projectNo)
    .map((device) => ({ ...device, processes: processMap[device.id] || [] }));
}

function getDevice(deviceId) {
  const device = devices.find((item) => item.id === deviceId) || devices[0];
  return { ...device, processes: processMap[device.id] || [] };
}

const dictionaries = {
  paramCategories: [
    "风量/表冷",
    "配置",
    "总电源",
    "处理风机",
    "再生风机",
    "强冷风扇",
    "转轮驱动",
    "加热",
    "加热电流",
    "热泵",
    "阀门",
    "控制",
    "点位",
    "通讯",
    "备注"
  ],
  processes: [
    "项目设计",
    "结构设计",
    "电气设计",
    "ERP录入",
    "物料采购",
    "电气盘安装",
    "结构总装",
    "电气总装",
    "电箱组装",
    "调试",
    "发货"
  ],
  qbCategories: ["厂内异常", "客户现场异常", "来料异常", "设计异常", "装配异常"],
  userRoles: ["普通员工", "部门管理员", "进度管理员", "综管部管理员", "观察员", "后台管理员"],
  paramLibraries: [
    {
      key: "electrical",
      name: "电气参数",
      sourceKey: "electricalParamValues",
      visibleDepartments: ["电气设计部"]
    }
  ],
  recordStatuses: ["启用", "停用"],
  excelFieldMappings: [
    { field: "deviceUniqueNo", header: "唯一台号", aliases: ["唯一台号\\n(项目号+台号)"], required: true },
    { field: "projectNo", header: "项目号", required: true },
    { field: "deviceNo", header: "台号", required: true },
    { field: "projectName", header: "项目名称", aliases: ["项目名称\\n(自动带出)"], required: true },
    { field: "model", header: "型号", required: false },
    { field: "area", header: "机内位号/区域", required: false },
    { field: "requiredShipDate", header: "要求交货期", required: false },
    { field: "plannedShipDate", header: "计划交货期", required: false },
    { field: "actualShipDate", header: "实际发货日期", required: false },
    { field: "currentStage", header: "当前所在阶段/部门", aliases: ["当前所在\\n阶段/部门"], required: false },
    { field: "currentOwner", header: "当前负责人", required: false },
    { field: "progressPercent", header: "进度%", required: false },
    { field: "isOverdue", header: "是否逾期", required: false },
    { field: "daysToShip", header: "距交货(天)", aliases: ["距交货\\n(天)"], required: false },
    { field: "stagePlanFinishDate", header: "阶段计划完成日", required: false },
    { field: "stageActualFinishDate", header: "阶段实际完成日", required: false },
    { field: "stageOwner", header: "阶段负责人", required: false },
    { field: "remark", header: "备注", required: false }
  ]
};

const electricalParamValues = {
  dvc1: [
    { id: "ep1", sort: 1, name: "前表冷风量", value: "53", unit: "m3/h", category: "风量/表冷" },
    { id: "ep2", sort: 2, name: "中表冷风量", value: "40", unit: "m3/h", category: "风量/表冷" },
    { id: "ep3", sort: 3, name: "后表冷风量", value: "-", unit: "m3/h", category: "风量/表冷" },
    { id: "ep4", sort: 4, name: "热泵", value: "有", unit: "", category: "配置" },
    { id: "ep5", sort: 5, name: "初中效过滤器", value: "有", unit: "", category: "配置" },
    { id: "ep6", sort: 6, name: "高效过滤器", value: "无", unit: "", category: "配置" },
    { id: "ep7", sort: 7, name: "总电流", value: "125", unit: "A", category: "总电源" },
    { id: "ep8", sort: 8, name: "总电流预留1.2倍", value: "150", unit: "A", category: "总电源" },
    { id: "ep9", sort: 9, name: "总开", value: "125A NSC160S3125N", unit: "", category: "总电源" },
    { id: "ep10", sort: 10, name: "处理风机台数", value: "3", unit: "台", category: "处理风机" },
    { id: "ep11", sort: 11, name: "处理风机每台功率", value: "15", unit: "kW", category: "处理风机" },
    { id: "ep12", sort: 12, name: "处理风机电流", value: "90", unit: "A", category: "处理风机" },
    { id: "ep13", sort: 13, name: "处理风机QF", value: "PRO iC65N 3P D40A", unit: "", category: "处理风机" },
    { id: "ep14", sort: 14, name: "处理风机KM", value: "-", unit: "", category: "处理风机" },
    { id: "ep15", sort: 15, name: "处理风机线径", value: "10", unit: "mm2", category: "处理风机" },
    { id: "ep16", sort: 16, name: "处理风机电压/频率", value: "380V/50Hz", unit: "", category: "处理风机" },
    { id: "ep17", sort: 17, name: "再生风机功率", value: "3", unit: "kW", category: "再生风机" },
    { id: "ep18", sort: 18, name: "再生风机电流", value: "6", unit: "A", category: "再生风机" },
    { id: "ep19", sort: 19, name: "再生风机QF", value: "PRO iC65N 3P D10A", unit: "", category: "再生风机" },
    { id: "ep20", sort: 20, name: "再生风机KM", value: "LC1-D09M7C", unit: "", category: "再生风机" },
    { id: "ep21", sort: 21, name: "再生风机线径", value: "1.5", unit: "mm2", category: "再生风机" },
    { id: "ep22", sort: 22, name: "强冷风扇功率", value: "100", unit: "W", category: "强冷风扇" },
    { id: "ep23", sort: 23, name: "强冷风扇电流", value: "0.4", unit: "A", category: "强冷风扇" },
    { id: "ep24", sort: 24, name: "驱动马达1功率", value: "200", unit: "W", category: "转轮驱动" },
    { id: "ep25", sort: 25, name: "驱动马达1电流", value: "0.67", unit: "A", category: "转轮驱动" },
    { id: "ep26", sort: 26, name: "驱动马达1QF", value: "GV2-ME05C", unit: "", category: "转轮驱动" },
    { id: "ep27", sort: 27, name: "驱动马达1KM", value: "LC1-D09M7C", unit: "", category: "转轮驱动" },
    { id: "ep28", sort: 28, name: "驱动马达2功率", value: "400", unit: "W", category: "转轮驱动" },
    { id: "ep29", sort: 29, name: "驱动马达2电流", value: "1.24", unit: "A", category: "转轮驱动" },
    { id: "ep30", sort: 30, name: "转轮1再生加热电功率", value: "83.7", unit: "kW", category: "加热" },
    { id: "ep31", sort: 31, name: "转轮2再生加热电功率", value: "-", unit: "kW", category: "加热" },
    { id: "ep32", sort: 32, name: "后加热电功率", value: "-", unit: "kW", category: "加热" },
    { id: "ep33", sort: 33, name: "1#再生加热方式", value: "电", unit: "", category: "加热" },
    { id: "ep34", sort: 34, name: "2#再生加热方式", value: "-", unit: "", category: "加热" },
    { id: "ep35", sort: 35, name: "后加热方式", value: "-", unit: "", category: "加热" },
    { id: "ep36", sort: 36, name: "转轮1再生加热总电流", value: "125.55", unit: "A", category: "加热电流" },
    { id: "ep37", sort: 37, name: "热泵功率", value: "26", unit: "kW", category: "热泵" },
    { id: "ep38", sort: 38, name: "热泵电流", value: "52", unit: "A", category: "热泵" },
    { id: "ep39", sort: 39, name: "热泵断路器", value: "PRO iC65N 3P D63A", unit: "", category: "热泵" },
    { id: "ep40", sort: 40, name: "新风阀出轴", value: "1", unit: "", category: "阀门" },
    { id: "ep41", sort: 41, name: "旁通风阀出轴", value: "-", unit: "", category: "阀门" },
    { id: "ep42", sort: 42, name: "PLC品牌", value: "西门子", unit: "", category: "控制" },
    { id: "ep43", sort: 43, name: "DI点数", value: "48", unit: "点", category: "点位" },
    { id: "ep44", sort: 44, name: "DO点数", value: "32", unit: "点", category: "点位" },
    { id: "ep45", sort: 45, name: "AI点数", value: "8", unit: "点", category: "点位" },
    { id: "ep46", sort: 46, name: "AO点数", value: "2", unit: "点", category: "点位" },
    { id: "ep47", sort: 47, name: "通讯方式", value: "Profinet", unit: "", category: "通讯" },
    { id: "ep48", sort: 48, name: "特殊配置备注", value: "触摸屏需交换机、保护盖；中后表冷和再生加热配电动阀门", unit: "", category: "备注" }
  ],
  dvc2: [
    { id: "ep2-1", sort: 1, name: "前表冷风量", value: "38", unit: "m3/h", category: "风量/表冷" },
    { id: "ep2-2", sort: 2, name: "中表冷风量", value: "35", unit: "m3/h", category: "风量/表冷" },
    { id: "ep2-3", sort: 3, name: "后表冷风量", value: "-", unit: "m3/h", category: "风量/表冷" },
    { id: "ep2-4", sort: 4, name: "PLC品牌", value: "西门子", unit: "", category: "控制" },
    { id: "ep2-5", sort: 5, name: "DI点数", value: "44", unit: "点", category: "点位" },
    { id: "ep2-6", sort: 6, name: "DO点数", value: "30", unit: "点", category: "点位" },
    { id: "ep2-7", sort: 7, name: "AI点数", value: "8", unit: "点", category: "点位" },
    { id: "ep2-8", sort: 8, name: "通讯方式", value: "Profinet", unit: "", category: "通讯" }
  ]
};

const dispatchTasks = [
  { projectNo: "C26-0422", process: "结构设计", department: "结构设计部", device: "C26-0422-01 第1台", due: "2026-06-26", status: "已派部门", dispatchedAt: "2026-06-18" },
  { projectNo: "C26-0422", process: "电气设计", department: "电气设计部", device: "C26-0422-01 第1台", due: "2026-06-28", status: "已派部门", dispatchedAt: "2026-06-18" }
];

const qbDetails = {
  "QB26-534": {
    qb: {
      qbNo: "QB26-534",
      projectNo: "C26-0422",
      projectName: "中创新航滁州",
      category: "厂内异常",
      productLine: "除湿机",
      raisedProcess: "电气电控",
      occurredAt: "2026-06-08",
      quantity: 1,
      description: "该项目部分电柜的风扇开孔处，金属防护网型号与风扇不贴合，现需调整。",
      reason: "核对疏忽",
      temporaryAction: "补购物料",
      longTermAction: "加强核查",
      department: "电气设计部",
      responsibleDepartment: "电气设计部",
      initiator: "李洋",
      currentOwner: "秦朗",
      status: "处理中"
    },
    linkedDevices: ["C26-0422-01", "C26-0422-02"],
    logs: [
      { time: "2026-06-08", user: "李洋", content: "创建QB，并指定秦朗处理。" },
      { time: "2026-06-09", user: "秦朗", content: "已核对现场问题，需调整电气清单。" },
      { time: "2026-06-10", user: "秦朗", content: "转交给秦朗，原因：涉及电气清单调整。" }
    ]
  }
};

const importPreview = {
  templateVersion: "单台设备生产进度统一跟踪表 v3",
  projectCount: 1,
  deviceCount: 6,
  taskCount: 90,
  errorCount: 0,
  warningCount: 2,
  warnings: [
    "责任人为空的阶段，导入后将先保留为部门待分配任务。",
    "模板结构如后期调整，只需维护字段映射，不需要重写导入功能。"
  ],
  errors: [],
  detailRows: [
    { projectNo: "C26-0422", deviceNo: "C26-0422-01", process: "电气设计", department: "电气设计部", due: "2026-06-28", status: "可导入" },
    { projectNo: "C26-0422", deviceNo: "C26-0422-01", process: "结构设计", department: "结构设计部", due: "2026-06-26", status: "可导入" },
    { projectNo: "C26-0422", deviceNo: "C26-0422-02", process: "电气设计", department: "电气设计部", due: "2026-06-28", status: "可导入" }
  ]
};

const importLogs = [];
const operationLogs = [];
const permissions = [
  { role: "superAdmin", label: "后台管理员", dataScope: "all", permissions: ["viewAdminEntry", "manageUsers", "manageDepartments", "dispatchProject", "dispatchDepartment", "maintainParams", "editParams", "importExcel", "submit"] },
  { role: "projectAdmin", label: "进度管理员", dataScope: "all", permissions: ["dispatchProject", "importExcel", "submit"] },
  { role: "departmentManager", label: "部门管理员", dataScope: "department", permissions: ["dispatchDepartment", "submit"] },
  { role: "quality", label: "采购/品质人员", dataScope: "project", permissions: ["createQb", "closeQb", "submit"] },
  { role: "electrical", label: "电气人员", dataScope: "project", permissions: ["maintainParams", "editParams", "submit"] },
  { role: "observer", label: "观察员", dataScope: "self", permissions: [] }
];

module.exports = {
  users,
  departments,
  projects,
  devices,
  processMap,
  qbList,
  tasks,
  dictionaries,
  electricalParamValues,
  dispatchTasks,
  qbDetails,
  importPreview,
  importLogs,
  operationLogs,
  permissions,
  getProject,
  getDevicesByProject,
  getDevice
};
