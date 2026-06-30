const STORAGE_KEY = "mock_current_user";

const users = [
  { id: "u10", name: "蒋相波", department: "项目部", role: "普通员工", roleLabel: "普通员工", phone: "138****0801" },
  { id: "u6", name: "彭博", department: "结构设计部", role: "普通员工", roleLabel: "普通员工", phone: "138****0401" },
  { id: "u1", name: "秦朗", department: "电气设计部", role: "普通员工", roleLabel: "普通员工", phone: "18352439458" },
  { id: "u9", name: "刘爽", department: "工艺部门", role: "普通员工", roleLabel: "普通员工", phone: "138****0701" },
  { id: "u12", name: "郑雪莲", department: "采购部", role: "普通员工", roleLabel: "普通员工", phone: "138****1001" },
  { id: "u11", name: "卢建平", department: "电气电控车间", role: "普通员工", roleLabel: "普通员工", phone: "138****0901" },
  { id: "u13", name: "孙志勇", department: "生产装配", role: "普通员工", roleLabel: "普通员工", phone: "138****1301" },
  { id: "u14", name: "朱建闯", department: "生产装配", role: "普通员工", roleLabel: "普通员工", phone: "138****1401" },
  { id: "u15", name: "王国峰", department: "壁板车间", role: "普通员工", roleLabel: "普通员工", phone: "138****1501" },
  { id: "u2", name: "李洋", department: "品质部", role: "普通员工", roleLabel: "普通员工", phone: "138****0101" },
  { id: "u16", name: "陈尚杰", department: "电气设计部", role: "部门管理员", roleLabel: "部门管理员", phone: "138****1601" },
  { id: "u7", name: "郭敬锋", department: "仓库部", role: "普通员工", roleLabel: "普通员工", phone: "138****0501" },
  { id: "u17", name: "苏高森", department: "总经办/销售/市场", role: "观察员", roleLabel: "观察员", phone: "138****1701" },
  { id: "u3", name: "张绍方", department: "制造部", role: "进度管理员", roleLabel: "进度管理员", phone: "138****0201" },
  { id: "u5", name: "IT", department: "信息化", role: "后台管理员", roleLabel: "后台管理员", phone: "138****0000" },
  { id: "u8", name: "吴洁", department: "综管部", role: "综管部管理员", roleLabel: "综管部管理员", phone: "138****0601" },
  { id: "u4", name: "总经理", department: "总经办/销售/市场", role: "观察员", roleLabel: "观察员", phone: "138****0301" }
];

function normalizeUser(user) {
  if (!user) return user;
  const normalized = Object.assign({}, user);
  const roleMap = {
    "最高级管理员": "后台管理员",
    "超级管理员": "后台管理员",
    "采购部员工": "普通员工",
    "工艺部门员工": "普通员工",
    "项目部员工": "普通员工",
    "电工房员工": "普通员工"
  };
  normalized.role = roleMap[normalized.role] || normalized.role;
  normalized.roleLabel = roleMap[normalized.roleLabel] || normalized.roleLabel || normalized.role;
  if (normalized.name === "后台管理员" && normalized.department === "信息化") {
    normalized.name = "IT";
  }

  const departmentMap = {
    "电气设计": "电气设计部",
    "电气设计部门": "电气设计部",
    "智能自控部": "电气设计部",
    "项目管理": "项目部",
    "结构设计": "结构设计部",
    "电工房": "电气电控车间",
    "结构班组": "生产装配",
    "电气班组": "生产装配",
    "生产部": "工艺部门",
    "仓库": "仓库部",
    "工艺": "工艺部门",
    "工艺部": "工艺部门"
  };
  normalized.department = departmentMap[normalized.department] || normalized.department;
  if (normalized.name === "综管部管理员") normalized.name = "吴洁";
  if (normalized.name === "周八") normalized.name = "郭敬锋";
  return normalized;
}

function getCurrentUser() {
  if (typeof wx === "undefined" || !wx.getStorageSync) return users[0];
  return normalizeUser(wx.getStorageSync(STORAGE_KEY) || users[0]);
}

function setCurrentUser(user) {
  const normalized = normalizeUser(user);
  if (typeof wx !== "undefined" && wx.setStorageSync) {
    wx.setStorageSync(STORAGE_KEY, normalized);
  }
  return normalized;
}

module.exports = {
  users,
  getCurrentUser,
  setCurrentUser,
  normalizeUser
};
