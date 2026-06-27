Component({
  data: {
    active: "projects",
    items: [
      { key: "projects", text: "项目", url: "/pages/projects/index" },
      { key: "tasks", text: "任务", url: "/pages/tasks/index" },
      { key: "params", text: "参数库", url: "/pages/params/index" },
      { key: "mine", text: "我的", url: "/pages/mine/index" }
    ]
  },

  pageLifetimes: {
    show() {
      this.refreshActive();
    }
  },

  lifetimes: {
    attached() {
      this.refreshActive();
    }
  },

  methods: {
    refreshActive() {
      const pages = getCurrentPages();
      const route = pages.length ? pages[pages.length - 1].route : "";
      let active = "projects";
      if (route.indexOf("pages/tasks/") === 0) active = "tasks";
      if (route.indexOf("pages/params/") === 0 || route.indexOf("pages/param-") === 0) active = "params";
      if (route.indexOf("pages/mine/") === 0 || route.indexOf("pages/user-") === 0 || route.indexOf("pages/department-") === 0) active = "mine";
      this.setData({ active });
    },

    go(e) {
      const url = e.currentTarget.dataset.url;
      const pages = getCurrentPages();
      const route = pages.length ? `/${pages[pages.length - 1].route}` : "";
      if (route === url) return;
      wx.reLaunch({ url });
    }
  }
});
