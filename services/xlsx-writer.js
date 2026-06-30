const fflate = require("./vendor/fflate");

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function xmlEscape(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - mod) / 26);
  }
  return name;
}

function buildSheetXml(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const body = safeRows.map((row, rowIndex) => {
    const cells = (Array.isArray(row) ? row : []).map((cell, colIndex) => {
      const ref = columnName(colIndex) + (rowIndex + 1);
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");

  return XML_HEADER +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="18"/>' +
    `<sheetData>${body}</sheetData>` +
    '</worksheet>';
}

function buildWorkbookXml(sheets) {
  const sheetXml = sheets.map((sheet, index) =>
    `<sheet name="${xmlEscape(sheet.name || ("Sheet" + (index + 1)))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join("");
  return XML_HEADER +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${sheetXml}</sheets>` +
    '</workbook>';
}

function buildWorkbookRels(sheets) {
  const rels = sheets.map((sheet, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join("") +
    '<Relationship Id="rId999" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  return XML_HEADER +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    rels +
    '</Relationships>';
}

function buildContentTypes(sheets) {
  const overrides = sheets.map((sheet, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");
  return XML_HEADER +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    overrides +
    '</Types>';
}

function buildXlsx(sheets) {
  const safeSheets = (Array.isArray(sheets) && sheets.length ? sheets : [{ name: "Sheet1", rows: [] }]);
  const files = {
    "[Content_Types].xml": fflate.strToU8(buildContentTypes(safeSheets)),
    "_rels/.rels": fflate.strToU8(XML_HEADER + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'),
    "xl/workbook.xml": fflate.strToU8(buildWorkbookXml(safeSheets)),
    "xl/_rels/workbook.xml.rels": fflate.strToU8(buildWorkbookRels(safeSheets)),
    "xl/styles.xml": fflate.strToU8(XML_HEADER + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>'),
    "docProps/core.xml": fflate.strToU8(XML_HEADER + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>miniprogram</dc:creator></cp:coreProperties>'),
    "docProps/app.xml": fflate.strToU8(XML_HEADER + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>WeChat Mini Program</Application></Properties>')
  };

  safeSheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = fflate.strToU8(buildSheetXml(sheet.rows || []));
  });

  return fflate.zipSync(files, { level: 6 });
}

module.exports = {
  buildXlsx
};
