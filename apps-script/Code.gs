/**
 * 馬拉松跑者 3D 跳躍閃避 — Google Apps Script 網頁應用程式＋線上排行榜
 *
 * 部署：部署 → 新增部署作業 → 類型「網頁應用程式」
 *   執行身分：我　／　誰可以存取：任何人
 * 第一次有人送出成績時，會自動在你的 Google 雲端硬碟建立「馬拉松跑者排行榜」試算表。
 * 想先看到試算表，可在編輯器選擇函式 setup 按「執行」，網址會印在執行紀錄裡。
 */

const SHEET_NAME = '成績';
const HEADERS = ['時間戳記', '姓名', '分數', '距離(K)', '比賽時間(秒)', '比賽時間', '完賽'];
const NAME_MAX = 12;

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'top') {
    return json_(getTop({ name: e.parameter.name || '' }));
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('馬拉松跑者 3D 跳躍閃避')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** 供 GitHub Pages 版跨網域送成績（Content-Type: text/plain，避免 CORS 預檢） */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'submit') return json_(submitScore(body));
    return json_(getTop(body));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function setup() {
  const ss = getSpreadsheet_();
  Logger.log('排行榜試算表：' + ss.getUrl());
}

/** 送出一筆成績，回傳前 10 名與此玩家名次 */
function submitScore(rec) {
  const name = cleanName_(rec && rec.name);
  if (!name) return { ok: false, error: '缺少姓名' };
  const score = Math.max(0, Math.min(1e7, Math.floor(Number(rec.score) || 0)));
  const dist = Math.max(0, Math.min(1000, Number(rec.dist) || 0));
  const time = Math.max(0, Math.min(360000, Math.floor(Number(rec.time) || 0)));
  const finished = rec.finished ? '是' : '';

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    getSheet_().appendRow([new Date(), name, score, Math.round(dist * 100) / 100, time, fmtTime_(time), finished]);
  } finally {
    lock.releaseLock();
  }
  return getTop({ name: name });
}

/** 每人取最佳一次（依分數），排出前 10 名 */
function getTop(opts) {
  const sheet = getSheet_();
  const n = sheet.getLastRow() - 1;
  const best = {};
  if (n > 0) {
    const rows = sheet.getRange(2, 1, n, HEADERS.length).getValues();
    rows.forEach(function (r) {
      const name = String(r[1]);
      const item = { name: name, score: Number(r[2]) || 0, dist: Number(r[3]) || 0, time: Number(r[4]) || 0, finished: r[6] === '是' };
      const cur = best[name];
      if (!cur || item.score > cur.score || (item.score === cur.score && item.dist > cur.dist)) best[name] = item;
      // 完賽時間另外記最佳（最短）
      if (item.finished) {
        const b = best[name];
        if (!b.bestFinish || item.time < b.bestFinish) b.bestFinish = item.time;
      }
    });
  }
  const list = Object.keys(best).map(function (k) { return best[k]; });
  list.sort(function (a, b) { return b.score - a.score || b.dist - a.dist; });
  const me = cleanName_(opts && opts.name);
  let myRank = 0;
  list.forEach(function (it, i) { if (it.name === me) myRank = i + 1; });
  return {
    ok: true,
    total: list.length,
    myRank: myRank,
    top: list.slice(0, 10).map(function (it, i) {
      return { rank: i + 1, name: it.name, score: it.score, dist: it.dist, finish: it.bestFinish ? fmtTime_(it.bestFinish) : '' };
    })
  };
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* 試算表被刪除，重建 */ }
  }
  const ss = SpreadsheetApp.create('馬拉松跑者排行榜');
  const sh = ss.getSheets()[0];
  sh.setName(SHEET_NAME);
  sh.appendRow(HEADERS);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function getSheet_() {
  const ss = getSpreadsheet_();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function cleanName_(s) {
  return String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
}

function fmtTime_(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h + ':' + ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
