const dataService = require("../../services/data-service");
const permissionService = require("../../services/permission-service");

const ROLE_LIST = [
  { id: "superAdmin", label: "后台管理员", role: "后台管理员" },
  { id: "projectAdmin", label: "进度管理员", role: "进度管理员" },
  { id: "departmentManager", label: "部门管理员", role: "部门管理员" },
  { id: "quality", label: "采购人员", role: "采购人员" },
  { id: "electrical", label: "电气人员", role: "电气人员" },
  { id: "observer", label: "观察员", role: "观察员" }
];

const PERM_LIST = [
  { key: "canViewAdminEntry", label: "后台管理入口" },
  { key: "canManageUsers", label: "用户管理" },
  { key: "canManageDepartments", label: "部门管理" },
  { key: "canCreateQb", label: "创建QB" },
  { key: "canCloseQb", label: "关闭QB" },
  { key: "canTransferQb", label: "转交QB" },
  { key: "canDispatchProject", label: "项目派单" },
  { key: "canDispatchDepartment", label: "部门派单" },
  { key: "canMaintainParams", label: "维护参数库" },
  { key: "canEditParams", label: "编辑参数" },
  { key: "canImportExcel", label: "Excel导入" },
  { key: "canSubmit", label: "提交进度" }
];

const SCOPE_LABELS = {
  all: "全部数据",
  department: "仅本部门",
  project: "仅参与项目",
  self: "仅自己"
};

const CHECK_MAP = {
  superAdmin: function() { return true; },
  projectAdmin: function(fn) { return ["canDispatchProject", "canImportExcel", "canSubmit"].indexOf(fn) >= 0; },
  departmentManager: function(fn) { return ["canDispatchDepartment", "canSubmit"].indexOf(fn) >= 0; },
  quality: function(fn) { return ["canCreateQb", "canCloseQb", "canTransferQb", "canSubmit"].indexOf(fn) >= 0; },
  electrical: function(fn) { return ["canMaintainParams", "canEditParams", "canSubmit"].indexOf(fn) >= 0; },
  observer: function(fn) { return fn === ""; }
};

Page({
  data: {
    roles: ROLE_LIST,
    perms: PERM_LIST,
    matrix: {},
    scopeLabels: SCOPE_LABELS,
    dataScopePreview: {}
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '权限管理' });
    var matrix = {};
    ROLE_LIST.forEach(function(role) {
      matrix[role.id] = {};
      PERM_LIST.forEach(function(perm) {
        var check = CHECK_MAP[role.id];
        matrix[role.id][perm.key] = typeof check === "function" ? check(perm.key) : false;
      });
    });

    // Preview dataScope for each role
    var scopePreview = {};
    ROLE_LIST.forEach(function(role) {
      var mockUser = { role: role.role || role.label, roleLabel: role.label };
      scopePreview[role.id] = permissionService.getDataScope(mockUser);
    });

    this.setData({ matrix: matrix, dataScopePreview: scopePreview });
  }
});
