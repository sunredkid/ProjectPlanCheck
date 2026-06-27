const dataService = require("../../services/data-service");

Page({
  data: {
    title: "新增设备",
    isEdit: false,
    loadError: "",
    isSaving: false,
    project: {},
    statuses: ["启用", "停用"],
    form: {
      id: "",
      projectNo: "",
      deviceNo: "",
      model: "",
      area: "",
      shipDate: "2026-07-31",
      status: "启用"
    }
  },

  onLoad(options = {}) {
    if (options.id) {
      const deviceId = decodeURIComponent(options.id || "");
      const device = dataService.getDevice(deviceId);
      if (!device || device.id !== deviceId) {
        this.setData({ loadError: "未找到该设备，无法编辑。" });
        wx.showToast({ title: "设备不存在", icon: "none" });
        return;
      }
      const project = dataService.getProject(device.projectNo);
      this.setData({
        title: "编辑设备",
        isEdit: true,
        project,
        form: {
          id: device.id || "",
          projectNo: device.projectNo || "",
          deviceNo: device.deviceNo || "",
          model: device.model || "",
          area: device.area || "",
          shipDate: device.shipDate || "",
          status: device.status || "启用"
        }
      });
      return;
    }

    const projectNo = decodeURIComponent(options.projectNo || "");
    if (!projectNo) {
      this.setData({ loadError: "缺少项目编号，请从项目详情重新进入。" });
      wx.showToast({ title: "缺少项目编号", icon: "none" });
      return;
    }
    const project = dataService.getProject(projectNo);
    if (!project || project.projectNo !== projectNo) {
      this.setData({ loadError: "未找到该项目，无法新增设备。" });
      wx.showToast({ title: "项目不存在", icon: "none" });
      return;
    }
    const devices = dataService.getDevicesByProject(projectNo);
    const nextIndex = devices.length + 1;
    const suffix = String(nextIndex).padStart(2, "0");

    this.setData({
      project,
      "form.projectNo": projectNo,
      "form.deviceNo": `${projectNo}-${suffix}`,
      "form.shipDate": project.shipDate || this.data.form.shipDate
    });
  },

  setField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onShipDateChange(e) {
    this.setData({ "form.shipDate": e.detail.value });
  },

  chooseStatus(e) {
    this.setData({ "form.status": e.currentTarget.dataset.value });
  },

  save() {
    if (this.data.isSaving) {
      return;
    }

    if (this.data.loadError) {
      wx.showToast({ title: "设备信息异常", icon: "none" });
      return;
    }

    if (!this.data.form.deviceNo) {
      wx.showToast({ title: "请填写设备编号", icon: "none" });
      return;
    }
    if (!this.data.form.projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }

    this.setData({ isSaving: true });
    try {
      const result = dataService.saveDevice(this.data.form);
      wx.showToast({
        title: result.ok ? "设备已保存" : result.message || "保存失败",
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
