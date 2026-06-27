const dataService = require("../../services/data-service");

Page({
  data: {
    loadError: "",
    title: "新增部门",
    users: [],
    statuses: [],
    editingId: "",
    form: {
      name: "",
      managers: [],
      status: "",
      sort: "1"
    },
    isSaving: false
  },

  onLoad(options) {
    const editOptions = dataService.getDepartmentEditOptions();
    this.setData({
      users: editOptions.users,
      statuses: editOptions.statuses,
      "form.managers": editOptions.users[0] ? [editOptions.users[0]] : [],
      "form.status": editOptions.statuses[0] || ""
    });

    if (options.mode === "edit") {
      const departmentId = decodeURIComponent(options.id || "");
      const department = dataService.getDepartment(departmentId);
      if (!department || department.id !== departmentId) {
        this.setData({ loadError: "未找到该部门，请返回部门管理确认。" });
        wx.showToast({ title: "部门不存在", icon: "none" });
        return;
      }
      this.setData({
        title: "编辑部门",
        editingId: department.id,
        form: {
          name: department.name,
          managers: department.managers ? String(department.managers).split(/[、,，]/) : [],
          status: department.status,
          sort: String(department.sort || "1")
        }
      });
    }
  },

  setField(e) {
    this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value });
  },

  chooseStatus(e) {
    this.setData({ "form.status": e.currentTarget.dataset.value });
  },

  toggleManager(e) {
    const name = e.currentTarget.dataset.name;
    const managers = this.data.form.managers.slice();
    const index = managers.indexOf(name);
    if (index >= 0) managers.splice(index, 1);
    else managers.push(name);
    this.setData({ "form.managers": managers });
  },

  save() {
    if (this.data.isSaving) {
      return;
    }

    if (this.data.loadError) {
      wx.showToast({ title: "部门信息缺失", icon: "none" });
      return;
    }
    if (!this.data.form.name) {
      wx.showToast({ title: "请填写部门名称", icon: "none" });
      return;
    }

    this.setData({ isSaving: true });
    try {
      const result = dataService.saveDepartment({
        id: this.data.editingId,
        ...this.data.form
      });
      wx.showToast({ title: result.ok ? "部门已保存" : result.message || "保存失败", icon: result.ok ? "success" : "none" });
      if (!result.ok) return;
      setTimeout(() => wx.navigateBack(), 800);
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ isSaving: false });
    }
  }
});
