const dataService = require("../../services/data-service");

Page({
  data: {
    loadError: "",
    mode: "add",
    title: "新增参数",
    categories: [],
    deviceId: "",
    editingId: "",
    form: {
      name: "",
      value: "",
      unit: "",
      category: "",
      remark: ""
    },
    isSaving: false,
    isDisabling: false,
    isBusy: false
  },

  onLoad(options) {
    const mode = options.mode || "add";
    const deviceId = decodeURIComponent(options.deviceId || "");
    if (!deviceId) {
      this.setData({ loadError: "缺少设备标识，无法维护参数" });
      wx.showToast({ title: "设备标识缺失", icon: "none" });
      return;
    }
    const device = dataService.getDevice(deviceId);
    if (!device || device.id !== deviceId) {
      this.setData({ loadError: "设备不存在，无法维护参数" });
      wx.showToast({ title: "设备不存在", icon: "none" });
      return;
    }
    const categories = dataService.getParamCategoryOrder().concat(["其他"]);
    this.setData({
      loadError: "",
      mode,
      deviceId,
      categories,
      "form.category": categories[0] || ""
    });

    if (mode === "edit") {
      if (!options.id) {
        this.setData({ loadError: "缺少参数标识，无法编辑参数" });
        wx.showToast({ title: "参数标识缺失", icon: "none" });
        return;
      }
      const params = dataService.getParamsByDevice(deviceId);
      const editingId = decodeURIComponent(options.id || "");
      const sample = params.find((item) => item.id === editingId);
      if (!sample) {
        this.setData({ loadError: "参数不存在，无法编辑" });
        wx.showToast({ title: "参数不存在", icon: "none" });
        return;
      }
      this.setData({
        mode: "edit",
        title: "编辑参数",
        editingId: sample.id,
        form: {
          name: sample.name,
          value: sample.value,
          unit: sample.unit,
          category: sample.category,
          remark: sample.remark || "示例参数，后续接真实数据"
        }
      });
    }
  },

  setField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  chooseCategory(e) {
    this.setData({ "form.category": e.currentTarget.dataset.value });
  },

  save() {
    if (this.data.isBusy) {
      return;
    }

    if (!this.data.form.name || !this.data.form.value) {
      wx.showToast({ title: "请填写参数名称和参数值", icon: "none" });
      return;
    }

    this.setData({ isSaving: true, isBusy: true });
    try {
      const result = dataService.saveParam({
        id: this.data.editingId,
        deviceId: this.data.deviceId,
        ...this.data.form
      });
      wx.showToast({ title: result.ok ? "参数已保存" : result.message || "保存失败", icon: result.ok ? "success" : "none" });
      if (!result.ok) return;
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ isSaving: false, isBusy: false });
    }
  },

  disableField() {
    if (this.data.isBusy) {
      return;
    }

    wx.showModal({
      title: "停用参数字段",
      content: "停用后历史数据保留，但后续默认不再显示该字段。",
      confirmText: "停用",
      success: (res) => {
        if (res.confirm) {
          this.setData({ isDisabling: true, isBusy: true });
          try {
            const result = dataService.disableParam(this.data.deviceId, this.data.editingId);
            wx.showToast({ title: result.ok ? "字段已停用" : result.message || "停用失败", icon: result.ok ? "success" : "none" });
            if (result.ok) {
              setTimeout(() => {
                wx.navigateBack();
              }, 800);
            }
          } catch (error) {
            wx.showToast({ title: error.message || "停用失败", icon: "none" });
          } finally {
            this.setData({ isDisabling: false, isBusy: false });
          }
        }
      }
    });
  }
});
