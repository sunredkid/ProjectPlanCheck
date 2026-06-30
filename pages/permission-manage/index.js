const dataService = require("../../services/data-service");

const PERM_LIST = [
  { key: "viewAdminEntry", label: "后台入口" },
  { key: "manageUsers", label: "用户管理" },
  { key: "manageDepartments", label: "部门管理" },
  { key: "createQb", label: "查看QB来源接口" },
  { key: "closeQb", label: "QB关闭状态查看" },
  { key: "dispatchProject", label: "项目派单" },
  { key: "dispatchDepartment", label: "设备派单" },
  { key: "maintainParams", label: "维护参数库" },
  { key: "editParams", label: "编辑参数" },
  { key: "importExcel", label: "Excel导入" },
  { key: "submit", label: "提交进度" }
];

const SCOPE_LABELS = {
  all: "全部数据",
  department: "仅本部门",
  project: "仅参与项目",
  self: "仅自己"
};

function decorateRows(rows) {
  return (rows || []).map((role) => {
    const permissionMap = {};
    PERM_LIST.forEach((perm) => {
      permissionMap[perm.key] = (role.permissions || []).indexOf(perm.key) >= 0;
    });
    return Object.assign({}, role, {
      permissionMap,
      scopeText: SCOPE_LABELS[role.dataScope] || role.dataScope || ""
    });
  });
}

Page({
  data: {
    perms: PERM_LIST,
    rows: [],
    saving: false
  },

  onShow() {
    wx.setNavigationBarTitle({ title: "权限管理" });
    this.loadRows();
  },

  loadRows() {
    this.setData({ rows: decorateRows(dataService.getPermissionConfigs()) });
  },

  togglePerm(e) {
    const role = e.currentTarget.dataset.role;
    const perm = e.currentTarget.dataset.perm;
    const rows = this.data.rows.map((row) => {
      if (row.role !== role) return row;
      const permissionMap = Object.assign({}, row.permissionMap, { [perm]: !row.permissionMap[perm] });
      const permissions = PERM_LIST.filter((item) => permissionMap[item.key]).map((item) => item.key);
      return Object.assign({}, row, { permissionMap, permissions });
    });
    this.setData({ rows });
  },

  saveRows() {
    this.setData({ saving: true });
    const payload = this.data.rows.map((row) => ({
      role: row.role,
      label: row.label,
      dataScope: row.dataScope,
      permissions: row.permissions || []
    }));
    const result = dataService.savePermissionConfigs(payload);
    this.setData({ saving: false });
    wx.showToast({ title: result.ok ? "权限配置已保存" : result.message || "保存失败", icon: result.ok ? "success" : "none" });
  }
});
