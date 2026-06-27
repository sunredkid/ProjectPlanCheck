const dataService = require("../../services/data-service");

Page({
  data: {
    loadError: "",
    title: "新增用户",
    departments: [],
    roles: [],
    statuses: [],
    editingId: "",
    form: {
      name: "",
      phone: "",
      department: "",
      role: "",
      isManager: false,
      status: ""
    },
    isSaving: false
  },

  onLoad(options) {
    const editOptions = dataService.getUserEditOptions();
    this.setData({
      departments: editOptions.departments,
      roles: editOptions.roles,
      statuses: editOptions.statuses,
      "form.department": editOptions.departments[0] || "",
      "form.role": editOptions.roles[0] || "",
      "form.status": editOptions.statuses[0] || ""
    });

    if (options.mode === "edit") {
      const userId = decodeURIComponent(options.id || "");
      const user = dataService.getUser(userId);
      if (!user || user.id !== userId) {
        this.setData({ loadError: "未找到该用户，请返回用户管理确认。" });
        wx.showToast({ title: "用户不存在", icon: "none" });
        return;
      }
      this.setData({
        title: "编辑用户",
        editingId: user.id,
        form: {
          name: user.name,
          phone: user.phone,
          department: user.department,
          role: user.role,
          isManager: user.isManager,
          status: user.status
        }
      });
    }
  },

  setField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  chooseOption(e) {
    this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.currentTarget.dataset.value });
  },

  toggleManager() {
    this.setData({ "form.isManager": !this.data.form.isManager });
  },

  save() {
    if (this.data.isSaving) {
      return;
    }

    if (this.data.loadError) {
      wx.showToast({ title: "用户信息缺失", icon: "none" });
      return;
    }
    if (!this.data.form.name || !this.data.form.phone) {
      wx.showToast({ title: "请填写姓名和手机号", icon: "none" });
      return;
    }

    this.setData({ isSaving: true });
    try {
      const result = dataService.saveUser({
        id: this.data.editingId,
        ...this.data.form
      });
      wx.showToast({ title: result.ok ? "用户已保存" : result.message || "保存失败", icon: result.ok ? "success" : "none" });
      if (!result.ok) return;
      setTimeout(() => wx.navigateBack(), 800);
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ isSaving: false });
    }
  }
});
