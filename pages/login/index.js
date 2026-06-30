const authService = require("../../services/auth-service");
const dataService = require("../../services/data-service");

Page({
  data: {
    name: "",
    phone: "",
    departmentIndex: -1,
    departmentName: "",
    departments: [],
    departmentNames: [],
    submitting: false
  },

  onLoad() {
    const departments = dataService.listDepartments({ status: "启用" });
    const currentUser = authService.getCurrentUser() || {};
    const departmentNames = departments.map((item) => item.name);
    const departmentIndex = departmentNames.indexOf(currentUser.department || "");
    this.setData({
      departments,
      departmentNames,
      name: currentUser.name && currentUser.role !== "临时用户" ? currentUser.name : "",
      phone: currentUser.phone || "",
      departmentIndex,
      departmentName: departmentIndex >= 0 ? departmentNames[departmentIndex] : ""
    });
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onDepartmentChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      departmentIndex: index,
      departmentName: this.data.departmentNames[index] || ""
    });
  },

  onGetPhoneNumber(e) {
    if (e.detail && e.detail.errMsg && e.detail.errMsg.indexOf("ok") >= 0) {
      wx.showToast({ title: "手机号授权已获取，请提交绑定", icon: "none" });
      return;
    }
    wx.showToast({ title: "暂未获取手机号，可手动填写", icon: "none" });
  },

  submitLogin() {
    if (this.data.submitting) return;
    const loginState = authService.getLoginState();
    const payload = {
      name: this.data.name,
      department: this.data.departmentName,
      phone: this.data.phone,
      openid: loginState.openid || ""
    };
    this.setData({ submitting: true });
    const result = dataService.registerLoginUser(payload);
    if (!result.ok) {
      this.setData({ submitting: false });
      wx.showToast({ title: result.message || "绑定失败", icon: "none" });
      return;
    }
    authService.setCurrentUser(result.user);
    wx.showToast({ title: "已提交绑定", icon: "success" });
    setTimeout(() => {
      this.setData({ submitting: false });
      wx.reLaunch({ url: "/pages/mine/index" });
    }, 600);
  }
});
