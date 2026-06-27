const dataService = require("../../services/data-service");

Page({
  data: {
    allDevices: [],
    selectedIds: [],
    compareResult: null,
    showResult: false,
    categories: [],
    expandedCategories: {},
    selectedMap: {}
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '参数对比' });
    this.loadDevices();
  },

  loadDevices() {
    const devices = dataService.listParamDevices();
    this.setData({ allDevices: this.withSelectedState(devices, this.data.selectedIds) });
  },

  withSelectedState(devices, selectedIds) {
    const selectedMap = {};
    (selectedIds || []).forEach(function(id) {
      selectedMap[id] = true;
    });
    return (devices || []).map(function(device) {
      return Object.assign({}, device, { selected: !!selectedMap[device.id] });
    });
  },

  toggleDevice(e) {
    const deviceId = e.currentTarget.dataset.id;
    if (!deviceId) return;
    let ids = this.data.selectedIds.slice();
    const idx = ids.indexOf(deviceId);
    if (idx >= 0) {
      ids.splice(idx, 1);
    } else if (ids.length < 5) {
      ids.push(deviceId);
    } else {
      wx.showToast({ title: "\u6700\u591a\u9009\u62e95\u53f0\u8bbe\u5907", icon: "none" });
      return;
    }
    const selectedMap = {};
    ids.forEach(function(id) {
      selectedMap[id] = true;
    });
    this.setData({
      selectedIds: ids,
      selectedMap,
      allDevices: this.withSelectedState(this.data.allDevices, ids),
      showResult: false
    });
  },

  startCompare() {
    if (this.data.selectedIds.length < 2) {
      wx.showToast({ title: "\u8bf7\u81f3\u5c11\u9009\u62e92\u53f0\u8bbe\u5907", icon: "none" });
      return;
    }
    var result = dataService.getParamCompareData(this.data.selectedIds);
    var categoriesWithCount = [];
    var seen = {};
    var catDiffCount = {};
    (result.matrix || []).forEach(function(row) {
      var cat = row.category || "\u672a\u5206\u7c7b";
      if (!seen[cat]) { seen[cat] = true; categoriesWithCount.push({ name: cat, diffCount: 0 }); }
      if (row.hasDiff) { catDiffCount[cat] = (catDiffCount[cat] || 0) + 1; }
    });
    categoriesWithCount.forEach(function(c) { c.diffCount = catDiffCount[c.name] || 0; });
    var expanded = {};
    categoriesWithCount.forEach(function(c) { expanded[c.name] = true; });
    this.setData({
      compareResult: result,
      categories: categoriesWithCount,
      expandedCategories: expanded,
      showResult: true
    });
  },

  resetCompare() {
    this.setData({
      selectedIds: [],
      selectedMap: {},
      allDevices: this.withSelectedState(this.data.allDevices, []),
      compareResult: null,
      showResult: false,
      categories: [],
      expandedCategories: {}
    });
  },

  toggleCategory(e) {
    const cat = e.currentTarget.dataset.cat;
    const expanded = this.data.expandedCategories;
    expanded[cat] = !expanded[cat];
    this.setData({ expandedCategories: expanded });
  },
  exportCSV() {
    if (!this.data.compareResult) return;
    var result = this.data.compareResult;
    var devices = result.devices || [];
    var matrix = result.matrix || [];
    var header = ["\u53c2\u6570\u540d"];
    devices.forEach(function(d) {
      header.push(d.deviceNo + (d.model ? "(" + d.model + ")" : ""));
    });
    var lines = [header.join("\t")];
    matrix.forEach(function(row) {
      var cells = [row.paramName];
      (row.values || []).forEach(function(v) {
        cells.push((v.has ? v.value + (v.unit || "") : "-"));
      });
      lines.push(cells.join("\t"));
    });
    wx.setClipboardData({
      data: lines.join("\n"),
      success: function() {
        wx.showToast({ title: "\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f\uff0c\u53ef\u7c98\u8d34\u5230Excel", icon: "none" });
      }
    });
  }
});
