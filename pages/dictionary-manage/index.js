const dataService = require("../../services/data-service");

const DICT_KEYS = {
  processes: { label: "工序字典", icon: "工序" },
  paramCategories: { label: "参数分类字典", icon: "参数" },
  qbCategories: { label: "QB分类字典", icon: "QB" },
  userRoles: { label: "用户角色字典", icon: "角色" }
};

Page({
  data: {
    dictTabs: Object.keys(DICT_KEYS).map((key) => ({
      key,
      label: DICT_KEYS[key].label,
      icon: DICT_KEYS[key].icon
    })),
    activeDict: "processes",
    items: [],
    editingIndex: -1,
    editValue: ""
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '字典管理' });
    this.loadDict();
  },

  loadDict() {
    const items = dataService.getDictionary ? dataService.getDictionary(this.data.activeDict) : [];
    this.setData({ items: items.slice(), editingIndex: -1, editValue: "" });
  },

  switchDict(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeDict: key }, () => this.loadDict());
  },

  startEdit(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ editingIndex: index, editValue: this.data.items[index] || "" });
  },

  onEditInput(e) {
    this.setData({ editValue: e.detail.value });
  },

  cancelEdit() {
    this.setData({ editingIndex: -1, editValue: "" });
  },

  saveEdit() {
    const value = String(this.data.editValue || "").trim();
    if (!value) { wx.showToast({ title: "内容不能为空", icon: "none" }); return; }
    const items = this.data.items.slice();
    if (this.data.editingIndex >= 0) {
      items[this.data.editingIndex] = value;
    } else {
      items.push(value);
    }
    this.setData({ items, editingIndex: -1, editValue: "" });
    wx.showToast({ title: "已保存（当前为 mock 模式）", icon: "none" });
  },

  deleteItem(e) {
    const index = e.currentTarget.dataset.index;
    const items = this.data.items.slice();
    items.splice(index, 1);
    this.setData({ items });
    wx.showToast({ title: "已删除（当前为 mock 模式）", icon: "none" });
  },

  startAdd() {
    this.setData({ editingIndex: -1, editValue: "" });
  }
});
