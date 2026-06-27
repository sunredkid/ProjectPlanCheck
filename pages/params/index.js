const dataService = require("../../services/data-service");

Page({
  data: {
    modes: [
      { key: "device", label: "按设备查" },
      { key: "param", label: "按参数查" }
    ],
    activeMode: "device",
    keyword: "",
    paramKeyword: "",
    valueKeyword: "",
    remarkKeyword: "",
    categoryFilter: "",
    showAdvanced: false,
    devices: []
  },

  onLoad() {
    this.cloudUnsubscribe = dataService.onCloudStoreChange(() => {
      this.loadParams();
    });
  },

  onShow() {
    this.loadParams();
  },

  onUnload() {
    if (this.cloudUnsubscribe) {
      this.cloudUnsubscribe();
      this.cloudUnsubscribe = null;
    }
  },

  loadParams() {
    this.setData({
      devices: dataService.searchParams({
        modeKey: this.data.activeMode,
        keyword: this.data.keyword,
        paramKeyword: this.data.paramKeyword,
        valueKeyword: this.data.valueKeyword,
        remarkKeyword: this.data.remarkKeyword,
        category: this.data.categoryFilter
      })
    });
  },

  switchMode(e) {
    this.setData({ activeMode: e.currentTarget.dataset.value }, () => {
      this.loadParams();
    });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value }, () => {
      this.loadParams();
    });
  },

  onParamKeywordInput(e) {
    this.setData({ paramKeyword: e.detail.value }, () => {
      this.loadParams();
    });
  },

  onValueKeywordInput(e) {
    this.setData({ valueKeyword: e.detail.value }, () => {
      this.loadParams();
    });
  },

  onRemarkKeywordInput(e) {
    this.setData({ remarkKeyword: e.detail.value }, () => {
      this.loadParams();
    });
  },

  onCategoryInput(e) {
    this.setData({ categoryFilter: e.detail.value }, () => {
      this.loadParams();
    });
  },

  toggleAdvanced() {
    this.setData({ showAdvanced: !this.data.showAdvanced });
  },


  // ---- Templates ----

  toggleTemplateMenu: function() {
    this.setData({ showTemplateMenu: !this.data.showTemplateMenu, showBatchMenu: false });
    if (!this.data.showTemplateMenu) return;
    // Load saved templates from dictionary
    var templates = dataService.getDictionary ? (
      dataService.getDictionary("paramTemplates") || []
    ) : [];
    this.setData({ templates: templates });
  },

  applyTemplate: function(e) {
    var tplId = e.currentTarget.dataset.id;
    var templates = this.data.templates;
    var tpl = templates.find(function(t) { return t.id === tplId; });
    if (!tpl) {
      wx.showToast({ title: "模板不存在", icon: "none" });
      return;
    }
    var that = this;
    wx.showModal({
      title: "应用模板",
      content: "将模板 \"" + tpl.name + "\" 的参数值批量套用到当前设备？此操作将覆盖现有参数值。",
      success: function(res) {
        if (res.confirm) {
          that.doTemplateApply(tpl);
        }
      }
    });
  },

  doTemplateApply: function(tpl) {
    var devices = this.data.devices;
    var count = 0;
    (tpl.params || []).forEach(function(p) {
      devices.forEach(function(d) {
        if (!d.id) return;
        var result = dataService.saveParam({
          deviceId: d.id,
          name: p.name,
          value: p.value,
          unit: p.unit || "",
          category: p.category || "",
          remark: p.remark || ""
        });
        if (result && result.ok) count++;
      });
    });
    this.setData({ showTemplateMenu: false });
    wx.showToast({ title: "已套用 " + count + " 个参数", icon: "none" });
    this.loadParams();
  },

  saveAsTemplate: function() {
    var devices = this.data.devices;
    if (devices.length === 0) {
      wx.showToast({ title: "先加载设备参数", icon: "none" });
      return;
    }
    var device = devices[0];
    var params = dataService.getDeviceParams ? dataService.getDeviceParams(device.id) : [];
    if (params.length === 0) {
      wx.showToast({ title: "该设备无参数可保存", icon: "none" });
      return;
    }
    wx.showModal({
      title: "保存为模板",
      content: "将 \"" + (device.deviceNo || device.id) + "\" 的 " + params.length + " 个参数保存为新模板？",
      editable: true,
      placeholderText: "输入模板名称",
      success: function(res) {
        if (res.confirm && res.content) {
          this.doSaveTemplate(res.content.trim(), params, device);
        }
      }.bind(this)
    });
  },

  doSaveTemplate: function(name, params, device) {
    var tpl = {
      id: "tpl-" + Date.now(),
      name: name,
      sourceDevice: device.deviceNo || device.id,
      sourceModel: device.model || "",
      createdAt: new Date().toISOString(),
      params: params.map(function(p) {
        return { name: p.name, value: p.value, unit: p.unit || "", category: p.category || "", remark: p.remark || "" };
      })
    };
    var templates = dataService.getDictionary ? (dataService.getDictionary("paramTemplates") || []) : [];
    templates.unshift(tpl);
    // Use dictionary-manage to save
    var mockData = require("../../utils/mock-data");
    if (mockData.dictionaries) {
      mockData.dictionaries.paramTemplates = templates;
    }
    wx.showToast({ title: "模板已保存", icon: "none" });
    this.setData({ templates: templates });
  },

  deleteTemplate: function(e) {
    var tplId = e.currentTarget.dataset.id;
    var mockData = require("../../utils/mock-data");
    var templates = (mockData.dictionaries && mockData.dictionaries.paramTemplates) || [];
    templates = templates.filter(function(t) { return t.id !== tplId; });
    if (mockData.dictionaries) { mockData.dictionaries.paramTemplates = templates; }
    this.setData({ templates: templates });
    wx.showToast({ title: "模板已删除", icon: "none" });
  },

  // ---- Batch operations ----

  toggleBatchMode: function() {
    this.setData({
      batchMode: !this.data.batchMode,
    batchSelected: {},
    batchSelectedCount: 0,
      showBatchMenu: false,
      showTemplateMenu: false
    });
  },

  toggleBatchSelect: function(e) {
    var id = e.currentTarget.dataset.id;
    var sel = this.data.batchSelected;
    if (sel[id]) {
      delete sel[id];
    } else {
      sel[id] = true;
    }
    this.setData({ batchSelected: sel, batchSelectedCount: Object.keys(sel).filter(function(k) { return sel[k]; }).length });
  },

  batchDisable: function() {
    var ids = Object.keys(this.data.batchSelected).filter(function(k) { return this.data.batchSelected[k]; }.bind(this));
    if (ids.length === 0) {
      wx.showToast({ title: "请先选择设备", icon: "none" });
      return;
    }
    var that = this;
    wx.showModal({
      title: "批量停用",
      content: "确认停用选中的 " + ids.length + " 台设备的参数？",
      success: function(res) {
        if (res.confirm) {
          ids.forEach(function(id) { dataService.disableDevice(id); });
          that.setData({ batchMode: false, batchSelected: {}, batchSelectedCount: 0 });
          that.loadParams();
          wx.showToast({ title: "已停用 " + ids.length + " 台", icon: "none" });
        }
      }
    });
  },

  batchDisableParams: function() {
    var ids = Object.keys(this.data.batchSelected).filter(function(k) { return this.data.batchSelected[k]; }.bind(this));
    if (ids.length === 0) {
      wx.showToast({ title: "请先选择设备", icon: "none" });
      return;
    }
    var that = this;
    wx.showModal({
      title: "批量停用参数",
      content: "确认停用所选设备下所有已启用的参数？",
      success: function(res) {
        if (res.confirm) {
          var count = 0;
          ids.forEach(function(deviceId) {
            var params = dataService.getDeviceParams(deviceId);
            params.forEach(function(p) {
              if (!p.disabled) {
                dataService.disableParam({ deviceId: deviceId, paramId: p.id });
                count++;
              }
            });
          });
          that.setData({ batchMode: false, batchSelected: {}, batchSelectedCount: 0 });
          that.loadParams();
          wx.showToast({ title: "已停用 " + count + " 个参数", icon: "none" });
        }
      }
    });
  },
  openCompare() {
    wx.navigateTo({ url: "/pages/param-compare/index" });
  },

  resetFilters() {
    this.setData({
      keyword: "",
      paramKeyword: "",
      valueKeyword: "",
      remarkKeyword: "",
      categoryFilter: ""
    }, () => {
      this.loadParams();
    });
  },

  openParam(e) {
    const deviceId = e.currentTarget.dataset.id;
    if (!deviceId) {
      wx.showToast({ title: "设备标识缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/param-detail/index?deviceId=${encodeURIComponent(deviceId)}`
    });
  }
});
