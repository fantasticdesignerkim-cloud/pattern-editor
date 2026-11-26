// ══════════════════════════════════════════════
// versionHelper.js — index.html 캐시 토큰·앱 표시 버전 공용 검사(하네스 전용, 스위트 아님).
//
//   규칙(고정 날짜 비교 금지):
//   - 스크립트/스타일 캐시 토큰 = 10자리 숫자 YYYYMMDDNN (실제 달력 날짜 + 순번 01~99).
//     파일마다 값이 달라도 된다. 토큰끼리, 또는 화면 버전과 숫자가 같아야 한다고 강제하지 않는다.
//   - 앱 표시 버전(#appVersion) = 본문 "vYYYY.MM.DD.N" 과 aria-label "앱 버전 YYYY.MM.DD.N" 이 서로 같은 날짜·순번.
//   - 파일 존재·로드 순서는 token()/pos() 로 그대로 확인한다(토큰이 없으면 null/-1).
//   require("./versionHelper")
// ══════════════════════════════════════════════
"use strict";

function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// 10자리 YYYYMMDDNN 형식 + 실제 날짜 + 순번 1~99
function isToken(t) {
  if (typeof t !== "string" || !/^\d{10}$/.test(t)) return false;
  const y = +t.slice(0, 4), m = +t.slice(4, 6), d = +t.slice(6, 8), n = +t.slice(8, 10);
  if (y < 2000 || y > 2999 || n < 1) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// 자산 상대경로(예 "js/ui.js", "css/style.css") 의 ?v= 값. 없으면 null. 숫자가 아니어도 문자열 그대로 돌려줘 형식 검사에서 걸리게 한다.
function assetToken(html, rel) {
  const m = new RegExp('(?:src|href)="' + esc(rel) + '\\?v=([^"&]*)"').exec(html);
  return m ? m[1] : null;
}
// js 파일명만 받는 축약("ui.js" → "js/ui.js"). 이미 경로면 그대로.
function token(html, file) { return assetToken(html, /\//.test(file) ? file : "js/" + file); }
function tokenOk(html, file) { return isToken(token(html, file)); }
function tokensOk(html, files) { return files.every(f => tokenOk(html, f)); }
// 로드 순서용 위치(없으면 -1)
function pos(html, file) { return html.indexOf('src="' + (/\//.test(file) ? file : "js/" + file) + "?v="); }

// #appVersion 읽기: { display, aria, ok, why }
function appVersion(html) {
  const m = /<span[^>]*id="appVersion"[^>]*>([^<]*)<\/span>/.exec(html);
  if (!m) return { display: null, aria: null, ok: false, why: "no #appVersion" };
  const tag = m[0], text = m[1].trim();
  const a = /aria-label="([^"]*)"/.exec(tag);
  const disp = /^v(\d{4})\.(\d{2})\.(\d{2})\.(\d+)$/.exec(text);
  const aria = a ? /^앱 버전 (\d{4})\.(\d{2})\.(\d{2})\.(\d+)$/.exec(a[1]) : null;
  if (!disp) return { display: text, aria: a ? a[1] : null, ok: false, why: "display format" };
  if (!aria) return { display: text, aria: a ? a[1] : null, ok: false, why: "aria format" };
  const same = [1, 2, 3, 4].every(i => disp[i] === aria[i]); // 문자열 그대로 대조
  const dateOk = isToken(disp[1] + disp[2] + disp[3] + "01");
  return { display: text, aria: a[1], ok: same && dateOk, why: same ? (dateOk ? "" : "invalid date") : "display≠aria" };
}
function appVersionOk(html) { return appVersion(html).ok; }

module.exports = { isToken, assetToken, token, tokenOk, tokensOk, pos, appVersion, appVersionOk };
