const dataService = require("../../services/data-service");

Page({
  data: {
    loadError: "",
    task: {},
    users: [],
    selectedUser: "",
    remark: "",
    isSubmitting: false
  },

  onLoad(options = {}) {
    const rowKey = decodeURIComponent(options.rowKey || "");
    if (!rowKey) {
      this.setData({ loadError: "缺少任务标识，请从任务列表重新进入。" });
      wx.showToast({ title: "缺少任务标识", icon: "none" });
      return;
    }
    const preview = dataService.getDepartmentDispatchPreview(rowKey);
    if (!preview.ok) {
      this.setData({ loadError: preview.message || "任务不存在，无法派单" });
      wx.showToast({ title: this.data.loadError, icon: "none" });
      return;
    }
    this.setData({
      loadError: "",
      task: preview.task,
      users: preview.users,
      selectedUser: preview.selectedUser
    });
  },

  chooseUser(e) {
    this.setData({ selectedUser: e.currentTarget.dataset.value });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  submit() {
    if (this.data.isSubmitting) {
      return;
    }

    if (this.data.loadError || !this.data.task.rowKey) {
      wx.showToast({ title: "任务信息缺失", icon: "none" });
      return;
    }
    if (!this.data.selectedUser) {
      wx.showToast({ title: "请选择具体负责人", icon: "none" });
      return;
    }

    this.setData({ isSubmitting: true });
    try {
      const result = dataService.assignDepartmentTask({
        task: this.data.task,
        selectedUser: this.data.selectedUser,
        remark: this.data.remark
      });
      wx.showToast({ title: result.ok ? "已派给个人" : result.message || "派单失败", icon: result.ok ? "success" : "none" });
      if (!result.ok) return;
      setTimeout(() => wx.navigateBack(), 800);
    } catch (error) {
      wx.showToast({ title: error.message || "派单失败", icon: "none" });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
