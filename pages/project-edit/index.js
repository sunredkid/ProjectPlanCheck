const dataService = require("../../services/data-service");

Page({
  data: {
    title: "新建项目",
    isEdit: false,
    loadError: "",
    isSaving: false,
    statuses: ["进行中", "未开始", "已完成", "暂停"],
    form: {
      id: "",
      projectNo: "",
      name: "",
      customer: "",
      admin: "",
      shipDate: "2026-07-31",
      status: "进行中"
    }
  },

  onLoad(options = {}) {
    const projectNo = decodeURIComponent(options.projectNo || "");
    if (!projectNo) return;

    const project = dataService.getProject(projectNo);
    if (!project || project.projectNo !== projectNo) {
      this.setData({ loadError: "未找到该项目，无法编辑。" });
      wx.showToast({ title: "项目不存在", icon: "none" });
      return;
    }

    this.setData({
      title: "编辑项目",
      isEdit: true,
      loadError: "",
      form: {
        id: project.id || "",
        projectNo: project.projectNo || "",
        name: project.name || "",
        customer: project.customer || "",
        admin: project.admin || "",
        shipDate: project.shipDate || "",
        status: project.status || "进行中"
      }
    });
  },

  setField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  chooseStatus(e) {
    this.setData({ "form.status": e.currentTarget.dataset.value });
  },

  onShipDateChange(e) {
    this.setData({ "form.shipDate": e.detail.value });
  },

  save() {
    if (this.data.isSaving) {
      return;
    }

    if (this.data.loadError) {
      wx.showToast({ title: "项目信息异常", icon: "none" });
      return;
    }

    if (!this.data.form.projectNo || !this.data.form.name) {
      wx.showToast({ title: "请填写项目号和项目名称", icon: "none" });
      return;
    }

    this.setData({ isSaving: true });
    try {
      const result = dataService.saveProject(this.data.form);
      wx.showToast({
        title: result.ok ? "项目已保存" : result.message || "保存失败",
        icon: result.ok ? "success" : "none"
      });
      if (!result.ok) return;
      setTimeout(() => wx.navigateBack(), 800);
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ isSaving: false });
    }
  }
});
