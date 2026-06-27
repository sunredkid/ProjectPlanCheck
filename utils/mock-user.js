const STORAGE_KEY = "mock_current_user";

const users = [
  {
    name: "秦朗",
    department: "电气设计部",
    role: "普通员工",
    roleLabel: "普通员工",
    phone: "18352439458"
  },
  {
    name: "李洋",
    department: "采购部",
    role: "普通员工",
    roleLabel: "采购部员工",
    phone: "138****0101"
  },
  {
    name: "张绍方",
    department: "制造部",
    role: "进度管理员",
    roleLabel: "进度管理员",
    phone: "138****0201"
  },
  {
    name: "陈七",
    department: "结构设计部",
    role: "部门管理员",
    roleLabel: "部门管理员",
    phone: "138****0401"
  },
  {
    name: "总经理",
    department: "总经办/销售/市场",
    role: "观察员",
    roleLabel: "观察员",
    phone: "138****0301"
  },
  {
    name: "IT",
    department: "信息化",
    role: "后台管理员",
    roleLabel: "后台管理员",
    phone: "138****0000"
  }
];

function normalizeUser(user) {
  if (!user) return user;
  const normalized = Object.assign({}, user);

  if (normalized.role === "最高级管理员" || normalized.role === "超级管理员") {
    normalized.role = "后台管理员";
  }
  if (normalized.roleLabel === "最高级管理员" || normalized.roleLabel === "超级管理员") {
    normalized.roleLabel = "后台管理员";
  }
  if (normalized.name === "后台管理员" && normalized.department === "信息化") {
    normalized.name = "IT";
  }

  const departmentMap = {
    "电气设计": "电气设计部",
    "电气设计部门": "电气设计部",
    "智能自控部": "电气设计部",
    "项目管理": "制造部",
    "进度管理": "制造部",
    "总经办": "总经办/销售/市场",
    "结构设计": "结构设计部",
    "仓库": "仓库部"
  };
  if (departmentMap[normalized.department]) {
    normalized.department = departmentMap[normalized.department];
  }

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
