const dataService = require("../../services/data-service");

Page({
  data: {
    keyword: "",
    allUsers: [],
    users: [],
    isUpdatingStatus: false
  },

  onShow() {
    this.loadUsers();
  },

  loadUsers() {
    const allUsers = dataService.listUsers();
    this.setData({ allUsers }, () => {
      this.filterUsers();
    });
  },

  filterUsers() {
    const keyword = String(this.data.keyword || "").trim().toLowerCase();
    let users = this.data.allUsers || [];
    if (keyword) {
      users = users.filter((user) => {
        const haystack = [
          user.name,
          user.phone,
          user.department,
          user.role,
          user.roleLabel,
          user.status,
          user.isManager ? "主管" : ""
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.indexOf(keyword) >= 0;
      });
    }
    this.setData({ users });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value }, () => {
      this.filterUsers();
    });
  },

  addUser() {
    wx.navigateTo({ url: "/pages/user-edit/index?mode=add" });
  },

  editUser(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({ title: "用户标识缺失", icon: "none" });
      return;
    }
    wx.navigateTo({ url: `/pages/user-edit/index?mode=edit&id=${encodeURIComponent(id)}` });
  },

  toggleStatus(e) {
    if (this.data.isUpdatingStatus) return;
    const id = e.currentTarget.dataset.id;
    const user = this.data.allUsers.find((item) => item.id === id);
    if (!user) {
      wx.showToast({ title: "用户不存在", icon: "none" });
      return;
    }
    this.setData({ isUpdatingStatus: true });
    try {
      const result = dataService.saveUser({
        ...user,
        status: user.status === "启用" ? "停用" : "启用"
      });
      wx.showToast({
        title: result.ok ? "状态已更新" : result.message || "状态更新失败",
        icon: result.ok ? "success" : "none"
      });
      if (result.ok) this.loadUsers();
    } catch (error) {
      wx.showToast({ title: error.message || "状态更新失败", icon: "none" });
    } finally {
      this.setData({ isUpdatingStatus: false });
    }
  }
});
