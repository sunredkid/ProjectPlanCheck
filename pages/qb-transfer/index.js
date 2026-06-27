const dataService = require("../../services/data-service");

Page({
  data: {
    qbNo: "",
    loadError: "",
    currentOwner: "",
    users: [],
    selectedUser: "",
    reason: "",
    isSubmitting: false
  },

  onLoad(options) {
    const qbNo = decodeURIComponent(options.qbNo || "");
    if (!qbNo) {
      this.setData({ loadError: "缺少 QB 编号，无法转交" });
      wx.showToast({ title: "QB编号缺失", icon: "none" });
      return;
    }
    const qb = dataService.getQb(qbNo);
    if (!qb) {
      this.setData({ loadError: "QB 记录不存在，无法转交" });
      wx.showToast({ title: "QB不存在", icon: "none" });
      return;
    }
    const optionsData = dataService.getQbTransferOptions();
    this.setData({
      loadError: "",
      qbNo,
      currentOwner: qb ? (qb.currentOwner || qb.owner || "") : "",
      users: optionsData.users
    });
  },

  chooseUser(e) {
    this.setData({ selectedUser: e.currentTarget.dataset.value });
  },

  onReasonInput(e) {
    this.setData({ reason: e.detail.value });
  },

  submitTransfer() {
    if (this.data.isSubmitting) {
      return;
    }

    if (this.data.loadError || !this.data.qbNo || !this.data.currentOwner) {
      wx.showToast({ title: "QB编号缺失", icon: "none" });
      return;
    }
    if (!this.data.selectedUser) {
      wx.showToast({ title: "请选择转交对象", icon: "none" });
      return;
    }
    if (!this.data.reason) {
      wx.showToast({ title: "请填写转交原因", icon: "none" });
      return;
    }

    this.setData({ isSubmitting: true });
    try {
      const result = dataService.transferQb(this.data.qbNo, {
        selectedUser: this.data.selectedUser,
        reason: this.data.reason
      });
      wx.showToast({ title: result.ok ? "QB已转交" : result.message || "转交失败", icon: result.ok ? "success" : "none" });
      if (!result.ok) return;
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (error) {
      wx.showToast({ title: error.message || "转交失败", icon: "none" });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
