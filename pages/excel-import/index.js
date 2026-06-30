const importService = require("../../services/import-service");
const cloudConfig = require("../../services/cloud-config");

Page({
  data: {
    selectedFile: "",
    selectedFileText: "尚未选择文件",
    parsed: false,
    preview: {
      templateVersion: "",
      standardSheet: "",
      projectCount: 0,
      deviceCount: 0,
      taskCount: 0,
      errorCount: 0,
      warningCount: 0
    },
    mappingMode: "按表头名称识别，不按固定列号",
    requiredFields: [],
    planGroup: "各阶段 / 计划完成日",
    actualGroup: "各阶段 / 实际完成日",
    ownerGroup: "各阶段 / 责任人",
    warnings: [],
    errors: [],
    rowIssues: [],
    detailRows: [],
    orderDateDialogVisible: false,
    projectOrderDates: [],
    acceptanceParsed: false,
    acceptanceSummary: {
      total: 0,
      passed: 0,
      failed: 0,
      projectCount: 0,
      deviceCount: 0,
      taskCount: 0,
      errorCount: 0,
      warningCount: 0
    },
    acceptanceItems: [],
    headerValidation: {
      recognizedHeaders: [],
      missingRequired: [],
      unknownHeaders: []
    },
    selectedFileInfo: null,
    templateInfo: null,
    isParsing: false,
    isAccepting: false,
    isImporting: false,
    isBusy: false
  },

  formatIssueDetail(issue = {}) {
    const detail = issue.detail || {};
    return [
      detail.projectNo || "-",
      detail.deviceNo || "-",
      detail.process || "-"
    ].join("｜");
  },

  normalizeRowIssues(rowIssues = []) {
    return rowIssues.map((item) => ({
      ...item,
      detailText: this.formatIssueDetail(item)
    }));
  },

  onLoad() {
    const template = importService.getStandardTemplateInfo();
    const requiredFields = importService
      .getFieldMappings()
      .filter((item) => item.required)
      .map((item) => item.header);

    this.setData({
      "preview.templateVersion": "单台设备生产进度统一跟踪表 v4",
      "preview.standardSheet": template.sheetName,
      requiredFields,
      templateInfo: template
    });
  },

  chooseFile() {
    if (wx.chooseMessageFile) {
      wx.chooseMessageFile({
        count: 1,
        type: "file",
        extension: ["xlsx", "xls"],
        success: (res) => {
          const file = importService.normalizeSelectedFile((res.tempFiles || [])[0]);
          this.setData({
            selectedFile: file.name,
            selectedFileText: file.name || "尚未选择文件",
            selectedFileInfo: file,
            parsed: false
          });
          wx.showToast({ title: "file selected", icon: "success" });
        },
        fail: () => {
          this.useSampleFile();
        }
      });
      return;
    }

    this.useSampleFile();
  },

  downloadTemplateFile() {
    const template = importService.getTemplateDownloadInfo();
    this.setData({ templateInfo: template });

    if (template.cloudFileID) {
      this.downloadCloudTemplate(template);
      return;
    }

    if (template.httpsUrl) {
      this.downloadHttpsTemplate(template);
      return;
    }

    this.openLocalDevTemplate(template);
  },

  openDownloadedTemplate(filePath, template = {}) {
    if (!filePath || !wx.openDocument) {
      wx.showToast({ title: "无法打开模板", icon: "none" });
      return;
    }
    wx.openDocument({
      filePath,
      fileType: "xlsx",
      showMenu: true,
      fail: () => wx.showToast({ title: "模板打开失败", icon: "none" })
    });
  },

  downloadCloudTemplate(template) {
    if (!wx.cloud || !wx.cloud.downloadFile) {
      wx.showToast({ title: "当前环境不支持云下载", icon: "none" });
      return;
    }
    wx.showLoading({ title: "下载模板中" });
    wx.cloud.downloadFile({
      fileID: template.cloudFileID,
      success: (res) => this.openDownloadedTemplate(res.tempFilePath, template),
      fail: (error) => {
        this.downloadCloudTemplateViaFunction(template, error);
      },
      complete: () => wx.hideLoading()
    });
  },

  downloadCloudTemplateViaFunction(template, originalError) {
    if (!wx.cloud || !wx.cloud.callFunction) {
      wx.showToast({ title: "云端模板下载失败", icon: "none" });
      return;
    }
    wx.showLoading({ title: "下载模板中" });
    wx.cloud.callFunction({
      name: cloudConfig.cloudFunctionName || "appStore",
      data: {
        action: "downloadTemplateFile",
        fileID: template.cloudFileID
      },
      success: (res) => {
        const result = res && res.result;
        if (!result || !result.ok || !result.contentBase64) {
          console.error("[excel-import] template function download failed", {
            fileID: template.cloudFileID,
            originalError,
            result
          });
          wx.showToast({ title: "云端模板下载失败", icon: "none" });
          return;
        }
        this.writeBase64TemplateFile(result.contentBase64, result.fileName || "progress-import-v4.xlsx", template);
      },
      fail: (error) => {
        console.error("[excel-import] template function call failed", {
          fileID: template.cloudFileID,
          originalError,
          error
        });
        wx.showToast({ title: "云端模板下载失败", icon: "none" });
      },
      complete: () => wx.hideLoading()
    });
  },

  writeBase64TemplateFile(contentBase64, fileName, template = {}) {
    if (!wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) {
      wx.showToast({ title: "当前环境无法保存模板", icon: "none" });
      return;
    }
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    wx.getFileSystemManager().writeFile({
      filePath,
      data: wx.base64ToArrayBuffer ? wx.base64ToArrayBuffer(contentBase64) : contentBase64,
      encoding: wx.base64ToArrayBuffer ? undefined : "base64",
      success: () => this.openDownloadedTemplate(filePath, template),
      fail: (error) => {
        console.error("[excel-import] template write failed", { filePath, error });
        wx.showToast({ title: "模板保存失败", icon: "none" });
      }
    });
  },

  downloadHttpsTemplate(template) {
    if (!wx.downloadFile) {
      wx.showToast({ title: "当前环境不支持下载", icon: "none" });
      return;
    }
    wx.showLoading({ title: "下载模板中" });
    wx.downloadFile({
      url: template.httpsUrl,
      filePath: wx.env && wx.env.USER_DATA_PATH ? `${wx.env.USER_DATA_PATH}/${template.fileName}` : undefined,
      success: (res) => {
        if (res.statusCode && res.statusCode !== 200) {
          wx.showToast({ title: "模板下载失败", icon: "none" });
          return;
        }
        this.openDownloadedTemplate(res.filePath || res.tempFilePath, template);
      },
      fail: () => wx.showToast({ title: "模板下载失败", icon: "none" }),
      complete: () => wx.hideLoading()
    });
  },

  openLocalDevTemplate(template) {
    if (wx.openDocument && template.path) {
      wx.openDocument({
        filePath: template.path,
        fileType: "xlsx",
        showMenu: true,
        fail: () => this.copyTemplatePath(template.path)
      });
      return;
    }

    this.copyTemplatePath(template.path);
  },

  copyTemplatePath(path) {
    if (wx.setClipboardData) {
      wx.setClipboardData({
        data: path,
        success: () => wx.showToast({ title: "模板路径已复制", icon: "success" })
      });
      return;
    }
    wx.showModal({
      title: "模板路径",
      content: path,
      showCancel: false
    });
  },

  useSampleFile() {
    const file = importService.normalizeSelectedFile({
      name: "sample_import_v4.xlsx",
      path: ""
    });
    this.setData({
      selectedFile: file.name,
      selectedFileText: file.name || "尚未选择文件",
      selectedFileInfo: file,
      parsed: false
    });
    wx.showToast({ title: "sample file selected", icon: "success" });
  },

  chooseAcceptanceFiles() {
    if (this.data.isBusy) {
      return;
    }

    if (!wx.chooseMessageFile) {
      wx.showToast({ title: "当前环境不支持多文件选择", icon: "none" });
      return;
    }

    this.setData({ isAccepting: true, isBusy: true });
    wx.chooseMessageFile({
      count: 9,
      type: "file",
      extension: ["xlsx", "xls"],
      success: (res) => {
        try {
          const files = (res.tempFiles || []).map(importService.normalizeSelectedFile);
          if (!files.length) {
            wx.showToast({ title: "未选择文件", icon: "none" });
            return;
          }

          const result = importService.validateImportSamples(files);
          this.setData({
            acceptanceParsed: true,
            acceptanceSummary: result.summary,
            acceptanceItems: result.items.map((item) => ({
              ...item,
              firstError: (item.errors || [])[0] || "",
              firstWarning: (item.warnings || [])[0] || ""
            }))
          });
          wx.showToast({
            title: result.ok ? "验收通过" : "存在问题",
            icon: result.ok ? "success" : "none"
          });
        } catch (error) {
          wx.showToast({ title: error.message || "验收失败", icon: "none" });
        } finally {
          this.setData({ isAccepting: false, isBusy: false });
        }
      },
      fail: () => {
        this.setData({ isAccepting: false, isBusy: false });
        wx.showToast({ title: "未选择文件", icon: "none" });
      }
    });
  },

  parseFile() {
    if (this.data.isBusy) {
      return;
    }

    if (!this.data.selectedFile) {
      wx.showToast({ title: "请先选择Excel文件", icon: "none" });
      return;
    }

    this.setData({ isParsing: true, isBusy: true });
    try {
      const result = importService.parseExcelPreview(this.data.selectedFileInfo || { name: this.data.selectedFile });
      this.setData({
        parsed: true,
        preview: {
          templateVersion: result.templateVersion,
          standardSheet: result.standardSheet,
          projectCount: result.projectCount,
          deviceCount: result.deviceCount,
          taskCount: result.taskCount,
          errorCount: result.errorCount,
          warningCount: result.warningCount
        },
        warnings: result.warnings,
        errors: result.errors,
        rowIssues: this.normalizeRowIssues(result.rowIssues || []),
        detailRows: result.detailRows,
        headerValidation: result.headerValidation,
        projectOrderDates: this.buildProjectOrderDates(result.detailRows || []),
        orderDateDialogVisible: false
      });
      wx.showToast({ title: "解析完成", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "解析失败", icon: "none" });
    } finally {
      this.setData({ isParsing: false, isBusy: false });
    }
  },

  buildProjectOrderDates(rows = []) {
    const seen = {};
    const today = this.getTodayString();
    return rows
      .filter((row) => row && row.projectNo && !row._skipImport)
      .filter((row) => {
        if (seen[row.projectNo]) return false;
        seen[row.projectNo] = true;
        return true;
      })
      .map((row) => ({
        projectNo: row.projectNo,
        projectName: row.projectName || "",
        adminOrderDate: row.adminOrderDate || row.orderDate || today
      }));
  },

  getTodayString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  },

  onProjectOrderDateChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    const projectOrderDates = this.data.projectOrderDates.slice();
    if (!projectOrderDates[index]) return;
    projectOrderDates[index] = {
      ...projectOrderDates[index],
      adminOrderDate: e.detail.value
    };
    this.setData({ projectOrderDates });
  },

  confirmImport() {
    if (this.data.isBusy) {
      return;
    }

    if (!this.data.parsed) {
      wx.showToast({ title: "请先解析并预览", icon: "none" });
      return;
    }
    if (this.data.preview.errorCount > 0) {
      wx.showToast({ title: "存在错误，不能导入", icon: "none" });
      return;
    }

    this.setData({ orderDateDialogVisible: true });
  },

  cancelOrderDateDialog() {
    this.setData({ orderDateDialogVisible: false });
  },

  doConfirmImport() {
    const missing = (this.data.projectOrderDates || []).find((item) => !item.adminOrderDate);
    if (missing) {
      wx.showToast({ title: "请填写全部项目下单时间", icon: "none" });
      return;
    }
    const projectOrderDateMap = {};
    (this.data.projectOrderDates || []).forEach((item) => {
      projectOrderDateMap[item.projectNo] = item.adminOrderDate;
    });

    this.setData({ isImporting: true, isBusy: true });
    try {
      const result = importService.confirmImport(this.data.detailRows, {
        projectOrderDates: projectOrderDateMap
      });
      wx.showToast({
        title: result.ok ? `导入${result.taskCount}条任务` : "导入失败",
        icon: result.ok ? "success" : "none"
      });
      if (result.ok) {
        this.setData({ orderDateDialogVisible: false });
        setTimeout(() => wx.navigateTo({ url: "/pages/import-logs/index" }), 900);
      }
    } catch (error) {
      wx.showToast({ title: error.message || "导入失败", icon: "none" });
    } finally {
      this.setData({ isImporting: false, isBusy: false });
    }
  },

  openLogs() {
    wx.navigateTo({
      url: "/pages/import-logs/index"
    });
  }
});
