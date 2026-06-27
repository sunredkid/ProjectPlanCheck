const authService = require("../../services/auth-service");
const permissionService = require("../../services/permission-service");

Page({
  data: {
    user: {},
    permissions: []
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '我的权限' });
    const user = authService.getCurrentUser() || {};
    const check = (label, fn) => {
      try { return fn(user); } catch (e) { return false; }
    };
    const permissions = [
      { key: "viewAdminEntry", label: "后台管理入口", granted: check("viewAdminEntry", permissionService.canViewAdminEntry) },
      { key: "manageUsers", label: "用户管理", granted: check("manageUsers", permissionService.canManageUsers) },
      { key: "manageDepartments", label: "部门管理", granted: check("manageDepartments", permissionService.canManageDepartments) },
      { key: "createQb", label: "创建QB", granted: check("createQb", permissionService.canCreateQb) },
      { key: "closeQb", label: "关闭QB", granted: check("closeQb", permissionService.canCloseQb) },
      { key: "transferQb", label: "转交QB", granted: check("transferQb", permissionService.canTransferQb) },
      { key: "dispatchProject", label: "项目派单", granted: check("dispatchProject", permissionService.canDispatchProject) },
      { key: "dispatchDepartment", label: "部门派单", granted: check("dispatchDepartment", permissionService.canDispatchDepartment) },
      { key: "maintainParams", label: "维护参数库", granted: check("maintainParams", permissionService.canMaintainParams) },
      { key: "editParams", label: "编辑参数", granted: check("editParams", permissionService.canEditParams) },
      { key: "importExcel", label: "Excel导入", granted: check("importExcel", permissionService.canImportExcel) },
      { key: "submit", label: "提交进度", granted: check("submit", permissionService.canSubmit) },
      { key: "isSuperAdmin", label: "后台管理员", granted: check("isSuperAdmin", permissionService.isSuperAdmin) },
      { key: "isProjectAdmin", label: "进度管理员", granted: check("isProjectAdmin", permissionService.isProjectAdmin) },
      { key: "isDepartmentManager", label: "部门管理员", granted: check("isDepartmentManager", permissionService.isDepartmentManager) },
      { key: "isQualityUser", label: "品质人员", granted: check("isQualityUser", permissionService.isQualityUser) },
      { key: "isElectricalUser", label: "电气人员", granted: check("isElectricalUser", permissionService.isElectricalUser) },
      { key: "isObserver", label: "观察员(只读)", granted: check("isObserver", permissionService.isObserver) }
    ];
    this.setData({
      user: {
        name: user.name || "",
        department: user.department || "",
        roleLabel: user.roleLabel || user.role || "",
        phone: user.phone || ""
      },
      permissions
    });
  }
});
