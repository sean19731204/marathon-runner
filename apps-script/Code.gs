/**
 * 馬拉松跑者 3D 跳躍閃避 — Google Apps Script 網頁應用程式
 * 部署：部署 → 新增部署作業 → 類型「網頁應用程式」
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('馬拉松跑者 3D 跳躍閃避')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
