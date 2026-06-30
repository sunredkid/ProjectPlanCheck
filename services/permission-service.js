const authService = require("./auth-service");

// ---- Role matching (mock mode) ----

const ROLE_KEYS = {
  superAdmin: ["后台管理员", "最高级管理员", "超级管理员", "閺堚偓妤傛楠囩粻锛勬倞閸?"],
  projectAdmin: ["进度管理员", "项目管理员", "妞ゅ湱娲扮粻锛勬倞閸?"],
  observer: ["观察员", "鐟欏倸鐧傞崨?"],
  departmentManager: ["部门管理员", "部门主管", "闁劑妫稉鑽ゎ吀"]
};

const DEPARTMENT_KEYS = {
  quality: ["品质部", "采购部", "閸濅浇宸濋柈?"],
  electrical: ["电气设计部", "智能自控部", "电气设计", "閻㈠灚鐨电拋鎹愵吀"]
};

function textMatches(value, keys) {
  return keys.some((key) => value === key || String(value || "").indexOf(key) >= 0);
}

function roleMatches(user, keys) {
  if (!user) return false;
  return [user.role, user.roleLabel].some((value) => textMatches(value, keys));
}

function departmentMatches(user, keys) {
  if (!user) return false;
  return textMatches(user.department, keys);
}

function getUser(user) {
  return user || authService.getCurrentUser();
}

// ---- Cloud permission table (P2 ready, mock fallback) ----

// Cloud permissions collection schema (per document):
// {
//   _id: "superAdmin",
//   role: "superAdmin",
//   label: "后台管理员",
//   permissions: ["viewAdminEntry", "manageUsers", "manageDepartments", ...]
// }
//
// Query: db.collection("permissions").where({ role: userRole }).get()
// Returns the list of allowed permission keys for that role.

const MOCK_PERMISSION_MAP = {
  superAdmin: [
    "viewAdminEntry", "manageUsers", "manageDepartments",
    "createQb", "closeQb",
    "dispatchProject", "dispatchDepartment",
    "maintainParams", "editParams", "importExcel", "submit"
  ],
  projectAdmin: ["dispatchProject", "importExcel", "submit"],
  departmentManager: ["dispatchDepartment", "submit"],
  quality: ["createQb", "closeQb", "submit"],
  electrical: ["maintainParams", "editParams", "submit"],
  observer: []
};


// ---- P2 Data scope (cloud permissions扩展) ----
// dataScope 控制用户能看到哪些数据:
//   "all"       — 全部数据（superAdmin / projectAdmin）
//   "department" — 仅本部门数据（departmentManager / 部门人员）
//   "project"   — 仅参与项目的设备/任务（品质/电气人员，根据 dispatch/assign 记录）
//   "self"      — 仅自己的数据（observer / 未匹配角色）

const DATA_SCOPE_MAP = {
  superAdmin: "all",
  projectAdmin: "all",
  departmentManager: "department",
  quality: "project",
  electrical: "project",
  observer: "self"
};

function getDataScope(user = {}) {
  const u = user || {};
  const role = u.roleLabel || u.role || "";
  if (role.indexOf("后台管理员") >= 0 || role.indexOf("最高级") >= 0 || role.indexOf("超级") >= 0 || role.indexOf("超級") >= 0) return "all";
  if (role.indexOf("进度管理员") >= 0 || role.indexOf("项目管理") >= 0) return "all";
  if (role.indexOf("部门管理员") >= 0 || role.indexOf("部门主管") >= 0 || role.indexOf("部門主管") >= 0) return "department";
  if (u.department === "采购部" || u.department === "品质部" || (u.department && u.department.indexOf("品质") >= 0)) return "project";
  if (u.department === "电气设计部" || u.department === "智能自控部" || u.department === "电气设计" || (u.department && u.department.indexOf("电气") >= 0)) return "project";
  if (role.indexOf("观察") >= 0 || role.indexOf("觀察") >= 0) return "self";
  return "self";
}

function getDataScopeFilter(user = {}) {
  var scope = getDataScope(user);
  var u = user || {};
  return { scope: scope, department: u.department || "", userName: u.name || "" };
}
function getMockPermissionsForUser(user = {}) {
  const role = user.roleLabel || user.role || "";
  if (role.indexOf("后台管理员") >= 0 || role.indexOf("最高级") >= 0 || role.indexOf("超级") >= 0 || role.indexOf("超級") >= 0) return MOCK_PERMISSION_MAP.superAdmin;
  if (role.indexOf("进度管理员") >= 0 || role.indexOf("项目管理") >= 0) return MOCK_PERMISSION_MAP.projectAdmin;
  if (role.indexOf("部门管理员") >= 0 || role.indexOf("部门主管") >= 0 || role.indexOf("部門主管") >= 0) return MOCK_PERMISSION_MAP.departmentManager;
  if (user.department === "采购部" || user.department === "品质部" || (user.department && user.department.indexOf("品质") >= 0)) return MOCK_PERMISSION_MAP.quality;
  if (user.department === "电气设计部" || user.department === "智能自控部" || user.department === "电气设计" || (user.department && user.department.indexOf("电气") >= 0)) return MOCK_PERMISSION_MAP.electrical;
  if (role.indexOf("观察") >= 0 || role.indexOf("觀察") >= 0) return MOCK_PERMISSION_MAP.observer;
  return [];
}

// Async version for cloud query.
// In mock mode returns mock permissions synchronously wrapped in Promise.
// In cloud mode queries wx.cloud.database().collection("permissions").
function getUserPermissionsAsync(user = {}) {
  const currentUser = user || authService.getCurrentUser();

  if (!authService.isReleaseEnv()) {
    return Promise.resolve(getMockPermissionsForUser(currentUser));
  }

  if (typeof wx !== "undefined" && wx.cloud && wx.cloud.database) {
    const role = currentUser.role || currentUser.roleLabel || "";
    return wx.cloud.database().collection("permissions")
      .where({ role })
      .get()
      .then((res) => {
        if (res.data && res.data.length > 0 && Array.isArray(res.data[0].permissions)) {
          return res.data[0].permissions.slice();
        }
        // Fallback to mock if no cloud permissions found
        return getMockPermissionsForUser(currentUser);
      })
      .catch(() => getMockPermissionsForUser(currentUser));
  }

  return Promise.resolve(getMockPermissionsForUser(currentUser));
}

// ---- Permission checks (all use mock role-matching for now) ----

function isSuperAdmin(user) {
  return roleMatches(getUser(user), ROLE_KEYS.superAdmin);
}

function isProjectAdmin(user) {
  return roleMatches(getUser(user), ROLE_KEYS.projectAdmin);
}

function isObserver(user) {
  return roleMatches(getUser(user), ROLE_KEYS.observer);
}

function isDepartmentManager(user) {
  const currentUser = getUser(user);
  return Boolean(currentUser && roleMatches(currentUser, ROLE_KEYS.departmentManager));
}

function isQualityUser(user) {
  return departmentMatches(getUser(user), DEPARTMENT_KEYS.quality);
}

function isElectricalUser(user) {
  return departmentMatches(getUser(user), DEPARTMENT_KEYS.electrical);
}

function canViewAdminEntry(user) {
  const currentUser = getUser(user);
  const role = String((currentUser && (currentUser.roleLabel || currentUser.role)) || "");
  return isSuperAdmin(currentUser) || role.indexOf("综管部管理员") >= 0;
}

function canManageUsers(user) {
  return isSuperAdmin(user);
}

function canManageDepartments(user) {
  return isSuperAdmin(user);
}

function canCreateQb(user) {
  return isQualityUser(user);
}

function canCloseQb(user) {
  return isQualityUser(user);
}

function canDispatchProject(user) {
  const currentUser = getUser(user);
  const roleText = String((currentUser && `${currentUser.role || ""} ${currentUser.roleLabel || ""}`) || "");
  return isSuperAdmin(currentUser) || roleText.indexOf("进度管理员") >= 0 || roleText.indexOf("项目管理员") >= 0;
}

function canDispatchDepartment(user) {
  return isSuperAdmin(user) || isDepartmentManager(user);
}

function canProjectDispatch(user) {
  return canDispatchProject(user);
}

function canDepartmentDispatch(user) {
  return canDispatchDepartment(user);
}

function canMaintainParams(user) {
  return isSuperAdmin(user) || isElectricalUser(user);
}

function canSubmit(user) {
  return !isObserver(user);
}

function canTransferQb(user, qb) {
  return false;
}

function canEditParams(user) {
  return canMaintainParams(user);
}

function canImportExcel(user) {
  return isSuperAdmin(user) || isProjectAdmin(user);
}

module.exports = {
  isSuperAdmin,
  isProjectAdmin,
  isObserver,
  isDepartmentManager,
  isQualityUser,
  isElectricalUser,
  canViewAdminEntry,
  canManageUsers,
  canManageDepartments,
  canCreateQb,
  canTransferQb,
  canCloseQb,
  canProjectDispatch,
  canDepartmentDispatch,
  canDispatchProject,
  canDispatchDepartment,
  canMaintainParams,
  canEditParams,
  canImportExcel,
  canSubmit,
  getDataScope,
  getDataScopeFilter,
  // P2 cloud permission API
  getUserPermissionsAsync,
  getMockPermissionsForUser
};
