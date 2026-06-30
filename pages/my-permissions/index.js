const authService = require("../../services/auth-service");
const permissionService = require("../../services/permission-service");

Page({
  data: {
    user: {},
    permissions: []
  },

  onShow() {
    wx.setNavigationBarTitle({ title: "我的权限" });
    const user = authService.getCurrentUser() || {};
    const check = (fn) => {
      try { return fn(user); } catch (e) { return false; }
    };
    const permissions = [
      { key: "viewAdminEntry", label: "后台管理入口", granted: check(permissionService.canViewAdminEntry) },
      { key: "manageUsers", label: "用户管理", granted: check(permissionService.canManageUsers) },
      { key: "manageDepartments", label: "部门管理", granted: check(permissionService.canManageDepartments) },
      { key: "createQb", label: "QB只读来源查看", granted: check(permissionService.canCreateQb) },
      { key: "closeQb", label: "QB关闭状态查看", granted: check(permissionService.canCloseQb) },
      { key: "dispatchProject", label: "项目派单", granted: check(permissionService.canDispatchProject) },
      { key: "dispatchDepartment", label: "设备派单", granted: check(permissionService.canDispatchDepartment) },
      { key: "maintainParams", label: "维护参数库", granted: check(permissionService.canMaintainParams) },
      { key: "editParams", label: "编辑参数", granted: check(permissionService.canEditParams) },
      { key: "importExcel", label: "Excel导入", granted: check(permissionService.canImportExcel) },
      { key: "submit", label: "提交进度", granted: check(permissionService.canSubmit) },
      { key: "isSuperAdmin", label: "后台管理员", granted: check(permissionService.isSuperAdmin) },
      { key: "isProjectAdmin", label: "进度管理员", granted: check(permissionService.isProjectAdmin) },
      { key: "isDepartmentManager", label: "部门管理员", granted: check(permissionService.isDepartmentManager) },
      { key: "isQualityUser", label: "品质人员", granted: check(permissionService.isQualityUser) },
      { key: "isElectricalUser", label: "电气人员", granted: check(permissionService.isElectricalUser) },
      { key: "isObserver", label: "观察员只读", granted: check(permissionService.isObserver) }
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
