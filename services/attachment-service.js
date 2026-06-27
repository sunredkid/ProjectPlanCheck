const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "bmp", "webp"];

const MAX_UPLOAD_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ---- File helpers ----

function getExtension(name = "") {
  const cleanName = String(name || "").split("?")[0];
  const index = cleanName.lastIndexOf(".");
  return index >= 0 ? cleanName.slice(index + 1).toLowerCase() : "";
}

function isImage(file = {}) {
  const ext = getExtension(file.name) || getExtension(file.path) || getExtension(file.tempFilePath);
  const type = String(file.type || "").toLowerCase();
  return type === "image" || IMAGE_EXTENSIONS.indexOf(ext) >= 0;
}

function normalizeFile(file = {}, index = 0) {
  const path = file.path || file.tempFilePath || file.cloudFileID || "";
  const name = file.name || file.fileName || path.split(/[\\/]/).pop() || "附件" + (index + 1);
  const image = isImage({ ...file, name, path });
  return {
    id: file.id || "att-" + Date.now() + "-" + index,
    name,
    path,
    cloudFileID: file.cloudFileID || "",
    size: file.size || 0,
    type: image ? "image" : "file",
    icon: image ? "图片" : "文件",
    canPreview: !!path,
    uploaded: !!file.cloudFileID
  };
}

function normalizeFiles(files = []) {
  return files.map(normalizeFile);
}

// ---- Local file selection ----

function chooseAttachments(options = {}) {
  const count = options.count || 6;
  return new Promise((resolve, reject) => {
    if (typeof wx === "undefined") {
      resolve([]);
      return;
    }

    if (wx.chooseMessageFile) {
      wx.chooseMessageFile({
        count,
        type: "all",
        success: (res) => resolve(normalizeFiles(res.tempFiles || [])),
        fail: reject
      });
      return;
    }

    if (wx.chooseImage) {
      wx.chooseImage({
        count,
        success: (res) => {
          const paths = res.tempFilePaths || [];
          const files = paths.map((path, index) => ({
            name: "图片" + (index + 1),
            path,
            type: "image"
          }));
          resolve(normalizeFiles(files));
        },
        fail: reject
      });
      return;
    }

    reject(new Error("当前微信版本不支持选择附件"));
  });
}

// ---- Local preview ----

function previewAttachment(file = {}, files = []) {
  if (typeof wx === "undefined" || !file.path) return;

  if (file.type === "image") {
    const urls = files.filter((item) => item.type === "image" && item.path).map((item) => item.path);
    wx.previewImage({
      current: file.path,
      urls: urls.length ? urls : [file.path]
    });
    return;
  }

  if (wx.openDocument) {
    wx.openDocument({
      filePath: file.path,
      showMenu: true,
      fail: () => {
        wx.showModal({
          title: "附件路径",
          content: file.path,
          showCancel: false
        });
      }
    });
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Cloud upload with retry ----

// cloudPathPrefix: e.g. "projects/P2023-001/" or "qb/QB-123/"
// In cloud mode: wx.cloud.uploadFile({ cloudPath, filePath })
// In mock mode: returns the same file with a simulated cloudFileID.
function uploadToCloud(file = {}, cloudPathPrefix = "attachments/", retryCount = 0) {
  if (!file.path && !file.tempFilePath) {
    return Promise.resolve({
      ok: false,
      message: "文件路径为空，无法上传。",
      file: normalizeFile(file),
      retries: retryCount
    });
  }

  const sourcePath = file.path || file.tempFilePath || "";
  const name = file.name || sourcePath.split(/[\\/]/).pop() || "attachment";
  const cloudPath = (cloudPathPrefix + name).replace(/\/\//g, "/");

  // Mock mode: simulate cloud upload
  if (typeof wx === "undefined" || !wx.cloud || !wx.cloud.uploadFile) {
    const mockFileID = "cloud://mock-env.appStores/" + cloudPath;
    return Promise.resolve({
      ok: true,
      fileID: mockFileID,
      cloudPath,
      file: normalizeFile({ ...file, cloudFileID: mockFileID, path: sourcePath }),
      retries: retryCount
    });
  }

  // Real cloud upload with retry logic
  function attempt(retriesLeft) {
    return wx.cloud.uploadFile({
      cloudPath,
      filePath: sourcePath
    }).then((res) => ({
      ok: true,
      fileID: res.fileID || "",
      cloudPath,
      file: normalizeFile({ ...file, cloudFileID: res.fileID || "", path: sourcePath }),
      retries: retryCount
    })).catch((error) => {
      if (retriesLeft > 0) {
        return delay(RETRY_DELAY_MS).then(() => attempt(retriesLeft - 1));
      }
      return {
        ok: false,
        message: error.errMsg || error.message || "上传失败",
        file: normalizeFile(file),
        retries: retryCount
      };
    });
  }

  return attempt(retryCount > 0 ? retryCount : MAX_UPLOAD_RETRIES - 1);
}

// Upload multiple files with per-file retry and optional progress callback.
// onProgress({ index, total, file, result }) is called after each file completes.
function uploadFilesToCloud(files = [], cloudPathPrefix = "attachments/", onProgress = null) {
  if (!files.length) return Promise.resolve({ ok: true, files: [], errors: [], allRetried: false });

  const total = files.length;
  const results = [];
  let completed = 0;
  let hasAnyRetry = false;

  function processNext(index) {
    if (index >= total) {
      const allOk = results.every((r) => r.ok);
      return {
        ok: allOk,
        files: results.map((r) => r.file),
        errors: results.filter((r) => !r.ok).map((r) => r.message),
        allRetried: hasAnyRetry
      };
    }

    const file = files[index];
    return uploadToCloud(file, cloudPathPrefix, MAX_UPLOAD_RETRIES - 1).then((result) => {
      results[index] = result;
      completed += 1;
      if (result.retries > 0) hasAnyRetry = true;
      if (typeof onProgress === "function") {
        try { onProgress({ index, total, file: result.file, result }); } catch (_) { /* noop */ }
      }
      return processNext(index + 1);
    });
  }

  return processNext(0);
}

// ---- Cloud download / get temp URL ----

function getCloudFileTempUrl(fileID = "") {
  if (!fileID) return Promise.reject(new Error("fileID is empty."));

  if (typeof wx === "undefined" || !wx.cloud || !wx.cloud.getTempFileURL) {
    return Promise.resolve({
      ok: true,
      tempFileURL: fileID
    });
  }

  return wx.cloud.getTempFileURL({
    fileList: [fileID]
  }).then((res) => {
    const item = (res.fileList && res.fileList[0]) || {};
    if (item.tempFileURL) {
      return { ok: true, tempFileURL: item.tempFileURL };
    }
    return { ok: false, message: item.errMsg || "获取临时链接失败" };
  }).catch((error) => ({
    ok: false,
    message: error.errMsg || error.message || "获取临时链接失败"
  }));
}

// ---- Cloud delete ----

function deleteCloudFiles(fileIDs = []) {
  if (!fileIDs.length) return Promise.resolve({ ok: true, deleted: 0 });

  if (typeof wx === "undefined" || !wx.cloud || !wx.cloud.deleteFile) {
    return Promise.resolve({ ok: true, deleted: fileIDs.length });
  }

  return wx.cloud.deleteFile({
    fileList: fileIDs
  }).then((res) => {
    const failed = (res.fileList || []).filter((item) => item.status !== 0);
    return {
      ok: failed.length === 0,
      deleted: fileIDs.length - failed.length,
      errors: failed.map((item) => item.errMsg)
    };
  }).catch((error) => ({
    ok: false,
    deleted: 0,
    message: error.errMsg || error.message || "删除失败"
  }));
}

module.exports = {
  normalizeFile,
  normalizeFiles,
  chooseAttachments,
  previewAttachment,
  // P2 cloud storage
  uploadToCloud,
  uploadFilesToCloud,
  getCloudFileTempUrl,
  deleteCloudFiles
};
