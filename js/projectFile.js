// ══════════════════════════════════════════════
// js/projectFile.js — 프로젝트 저장·열기(JSON 파일 한 개) · 2026-11-09 김님 승인.
//
// 기존 «데이터 내보내기/가져오기»(원형 진동선 곡선 localStorage 백업)와 **별개**다.
// 이 파일은 «원형 완료 뒤 만든 디자인 프로젝트»를 통째로 담는다:
//   · 출발 원형 완료본(blockWorkflow 레코드 — snapshot·canonicalHash·version)
//   · designProject 전체(sourceBlock·baseSource·referenceGeometry·working 전부 —
//     geometry·parameters·patternLines·designOutline·layout·parts·sleeveEdit·
//     bodice/sleeve/collar/designResult 완료본·각 프리셋 상태)
//   · 화면 단계(원형/디자인 + 몸판/소매/카라 서브탭)
//   · 저장 시점 완료/변경됨 판정(열 때 기존 판정 함수로 재계산해 같아야 연다)
//
// 직렬화 = 충실한 그래프 인코딩(JSON 한계를 숨기지 않는다):
//   · NaN/±Infinity/함수/Map 등 비 JSON 값 = 저장 거부(경로 표시) — 조용히 null 로 바꾸지 않는다.
//   · undefined 속성·-0 = 경로 목록으로 기록해 그대로 되살린다.
//   · 공유 참조(예: designResult.bodice === bodiceResult) = alias 목록으로 같은 객체로 되살린다.
//   · Object.freeze 상태 = deep/shallow 경로 목록으로 기록해 똑같이 동결한다(완료본·불변 출처).
//   · 열 때 되살린 그래프를 다시 인코딩해 파일과 바이트 동일해야 통과(충실성 자체 검증).
//
// 열기 = 읽기 → JSON → format/schemaVersion → sha256 무결성 → 금지 키·유한수 → 그래프 복원
//   → 원형 완료본 canonical 재계산(blockWorkflow.verifyCompleted) → project 형태·출처 정합
//   → 동결 불변식 → 완료/변경됨 재계산(기존 checkpoint 함수, designWorkflow.evaluateIsolated)
//   → 판정 뒤 재인코딩 동일(판정이 후보를 바꾸지 않음) → **여기까지 무변경** → 사용자 확인
//   → blockWorkflow.adoptRestored + designWorkflow.adoptRestored(원자 · 실패 시 되돌림) → 화면 단계.
//   실패·취소 = 현재 project·원형 완료본·화면·localStorage 무변경. eval·전역 덮어쓰기 없음.
//
// 원형 편집 화면(치수 입력·진동선 곡선·다트 이동 상태)은 이 파일이 저장·복원하지 않는다 —
// 그건 기존 곡선 JSON 의 몫이다. 디자인은 완료본에 고정된 referenceGeometry 만 쓰므로 원형 화면과 무관하게 이어진다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  var FORMAT = "bunka-pattern-editor.project";
  var SCHEMA_VERSION = 1;
  var MAX_BYTES = 64 * 1024 * 1024;
  var FORBIDDEN = { "__proto__": 1, "constructor": 1, "prototype": 1 };

  function fail(reason, detail) {
    var e = new Error("projectFile: " + reason + (detail !== undefined ? " (" + detail + ")" : ""));
    e.reason = reason; if (detail !== undefined) e.detail = detail;
    throw e;
  }
  function pathStr(path) { return path.length ? path.join(".") : "(root)"; }

  // ── SHA-256(동기 · UTF-8) ──
  var K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function utf8(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var d = str.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function sha256(str) {
    var bytes = utf8(str), bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);
    for (var off = 0; off < bytes.length; off += 64) {
      for (var t = 0; t < 16; t++) w[t] = (bytes[off + 4 * t] << 24) | (bytes[off + 4 * t + 1] << 16) | (bytes[off + 4 * t + 2] << 8) | bytes[off + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K256[t] + w[t]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (v) { return ("0000000" + (v >>> 0).toString(16)).slice(-8); }).join("");
  }

  // ── 충실한 그래프 인코딩 ──
  // 반환 { data, meta:{ aliases:[[path,target]], undef:[path], negZero:[path], frozenDeep:[path], frozenShallow:[path] } }
  function encodeGraph(root) {
    var seen = new Map(), done = new Map();
    var meta = { aliases: [], undef: [], negZero: [], frozenDeep: [], frozenShallow: [] };
    function walk(v, path) {
      if (v === undefined) { meta.undef.push(path); return { d: null, deep: true }; }
      if (v === null) return { d: null, deep: true };
      var t = typeof v;
      if (t === "number") {
        if (!Number.isFinite(v)) fail("non-finite-number", pathStr(path));
        if (v === 0 && 1 / v < 0) { meta.negZero.push(path); return { d: 0, deep: true }; }
        return { d: v, deep: true };
      }
      if (t === "string" || t === "boolean") return { d: v, deep: true };
      if (t !== "object") fail("unsupported-type", t + " @ " + pathStr(path));
      if (seen.has(v)) { meta.aliases.push([path, seen.get(v)]); return { d: null, deep: done.get(v) === true }; }
      seen.set(v, path);
      var isArr = Array.isArray(v), proto = Object.getPrototypeOf(v);
      // 일반 객체/배열만(realm 무관 판정): Map·Date·클래스 인스턴스·null 프로토타입 = 거부
      var plain = isArr ? (proto !== null && Object.getPrototypeOf(proto) !== null && Object.getPrototypeOf(Object.getPrototypeOf(proto)) === null)
        : (proto !== null && Object.getPrototypeOf(proto) === null && Object.prototype.toString.call(v) === "[object Object]");
      if (!plain) fail("unsupported-object", pathStr(path));
      if (Object.getOwnPropertySymbols(v).length) fail("symbol-key", pathStr(path));
      var deepStart = meta.frozenDeep.length, allDeep = true, out, i, r;
      if (isArr) {
        out = [];
        for (i = 0; i < v.length; i++) {
          if (!Object.prototype.hasOwnProperty.call(v, i)) fail("sparse-array", pathStr(path));
          r = walk(v[i], path.concat(i)); out.push(r.d); if (!r.deep) allDeep = false;
        }
        if (Object.keys(v).length !== v.length) fail("array-extra-key", pathStr(path));
      } else {
        out = {};
        var keys = Object.keys(v);
        if (Object.getOwnPropertyNames(v).length !== keys.length) fail("non-enumerable-key", pathStr(path));
        for (i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (FORBIDDEN[k]) fail("forbidden-key", pathStr(path.concat(k)));
          var desc = Object.getOwnPropertyDescriptor(v, k);
          if (desc.get || desc.set) fail("accessor", pathStr(path.concat(k)));
          r = walk(v[k], path.concat(k)); out[k] = r.d; if (!r.deep) allDeep = false;
        }
      }
      var frozen = Object.isFrozen(v), deep = frozen && allDeep;
      if (deep) { meta.frozenDeep.length = deepStart; meta.frozenDeep.push(path); }
      else if (frozen) meta.frozenShallow.push(path);
      done.set(v, deep);
      return { d: out, deep: deep };
    }
    var res = walk(root, []);
    return { data: res.d, meta: meta };
  }

  // 파싱된 값 전체 검사: JSON 타입·유한수·금지 키(프로토타입 오염 방지).
  function scanPlain(v, path) {
    if (v === null) return;
    var t = typeof v;
    if (t === "number") { if (!Number.isFinite(v)) fail("non-finite-number", pathStr(path)); return; }
    if (t === "string" || t === "boolean") return;
    if (t !== "object") fail("unsupported-type", pathStr(path));
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) scanPlain(v[i], path.concat(i)); return; }
    var keys = Object.getOwnPropertyNames(v);
    for (var j = 0; j < keys.length; j++) {
      if (FORBIDDEN[keys[j]]) fail("forbidden-key", pathStr(path.concat(keys[j])));
      scanPlain(v[keys[j]], path.concat(keys[j]));
    }
  }
  function validPath(p) {
    return Array.isArray(p) && p.every(function (k) { return (typeof k === "string" && !FORBIDDEN[k]) || (Number.isInteger(k) && k >= 0); });
  }
  function resolveParent(root, path) {
    if (!validPath(path) || path.length === 0) fail("bad-path", JSON.stringify(path));
    var o = root;
    for (var i = 0; i < path.length - 1; i++) {
      if (!o || typeof o !== "object" || !Object.prototype.hasOwnProperty.call(o, path[i])) fail("bad-path", pathStr(path));
      o = o[path[i]];
    }
    var last = path[path.length - 1];
    if (!o || typeof o !== "object" || !Object.prototype.hasOwnProperty.call(o, last)) fail("bad-path", pathStr(path));
    if (Array.isArray(o) !== (typeof last === "number")) fail("bad-path", pathStr(path));
    return { obj: o, key: last };
  }
  function resolve(root, path) {
    if (!validPath(path)) fail("bad-path", JSON.stringify(path));
    if (path.length === 0) return root;
    var r = resolveParent(root, path); return r.obj[r.key];
  }
  function freezeDeep(o) {
    if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { freezeDeep(o[k]); }); Object.freeze(o); }
    return o;
  }
  // graph = { data, meta }(JSON 파싱 결과 — 이미 scanPlain 통과). data 를 제자리에서 되살린다.
  function decodeGraph(graph) {
    if (!graph || typeof graph !== "object" || !graph.meta || typeof graph.meta !== "object") fail("graph-shape");
    var m = graph.meta, root = graph.data;
    ["aliases", "undef", "negZero", "frozenDeep", "frozenShallow"].forEach(function (k) { if (!Array.isArray(m[k])) fail("graph-meta", k); });
    if (!root || typeof root !== "object") fail("graph-root");
    m.undef.forEach(function (p) { var r = resolveParent(root, p); if (r.obj[r.key] !== null) fail("graph-undef", pathStr(p)); r.obj[r.key] = undefined; });
    m.negZero.forEach(function (p) { var r = resolveParent(root, p); if (r.obj[r.key] !== 0) fail("graph-negzero", pathStr(p)); r.obj[r.key] = -0; });
    m.aliases.forEach(function (a) {
      if (!Array.isArray(a) || a.length !== 2) fail("graph-alias");
      var r = resolveParent(root, a[0]); if (r.obj[r.key] !== null) fail("graph-alias", pathStr(a[0]));
      var target = resolve(root, a[1]); if (!target || typeof target !== "object") fail("graph-alias-target", pathStr(a[1]));
      r.obj[r.key] = target;
    });
    m.frozenShallow.forEach(function (p) { var o = resolve(root, p); if (!o || typeof o !== "object") fail("graph-freeze", pathStr(p)); Object.freeze(o); });
    m.frozenDeep.forEach(function (p) { var o = resolve(root, p); if (!o || typeof o !== "object") fail("graph-freeze", pathStr(p)); freezeDeep(o); });
    return root;
  }

  // ── 완료/변경됨 판정(기존 checkpoint 함수 재사용 — 새 판정 없음) ──
  function stageStatus(res, changedFn, proj) {
    if (!res) return { completed: false, hash: null, changed: null };
    return { completed: true, hash: typeof res.hash === "string" ? res.hash : null, changed: !!changedFn(proj) };
  }
  function computeStatus(proj) {
    var w = proj.working, BC = window.bodiceCheckpoint, SC = window.sleeveCheckpoint, CC = window.collarCheckpoint, DR = window.designResult;
    if (!BC || !SC || !CC || !DR) fail("checkpoint-unavailable");
    return {
      bodice: stageStatus(w.bodiceResult, BC.isCurrentBodiceChanged, proj),
      sleeve: stageStatus(w.sleeveResult, SC.isCurrentSleeveChanged, proj),
      collar: stageStatus(w.collarResult, CC.isCurrentCollarChanged, proj),
      design: stageStatus(w.designResult, DR.isCurrentDesignChanged, proj)
    };
  }
  function summaryOf(block, proj) {
    var ms = (block.snapshot.source && block.snapshot.source.measurements) || {};
    return { B: ms.B, W: ms.W, BL: ms.BL, blockVersion: block.version, blockHash: block.canonicalHash, createdAt: proj.createdAt };
  }
  function sameJSON(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function isDeepFrozen(o) {
    if (!o || typeof o !== "object") return true;
    if (!Object.isFrozen(o)) return false;
    return Object.keys(o).every(function (k) { return isDeepFrozen(o[k]); });
  }

  function ui() { return window.projectSessionUI || null; }
  function sourceBlockOf(proj) {
    var bw = window.blockWorkflow; if (!bw) return null;
    var sb = proj.sourceBlock;
    var all = bw.versions();
    for (var i = all.length - 1; i >= 0; i--) {
      var b = all[i];
      if (b.id === sb.id && b.version === sb.version && b.canonicalHash === sb.canonicalHash) return b;
    }
    return null;
  }

  // ── 저장: 현재 세션 → 파일 텍스트(쓰기 전 같은 열기 검증으로 자체 확인) ──
  function buildFileText(opts) {
    var dw = window.designWorkflow, proj = dw && dw.current();
    if (!proj) fail("no-project");
    var U = ui();
    var unfinished = U ? U.unfinished() : [];
    if (unfinished.length) fail("unfinished", unfinished.join(" / "));
    var block = sourceBlockOf(proj);
    if (!block) fail("source-block-missing");
    var status = computeStatus(proj);
    var graph = encodeGraph({ block: block, project: proj });
    var uiState = U ? U.snapshot() : { stage: "design", subtab: "body" };
    var payload = { graph: graph, ui: uiState, status: status, summary: summaryOf(block, proj) };
    var payloadText = JSON.stringify(payload);
    var savedAt = (opts && opts.savedAt) || new Date().toISOString();
    var text = '{"format":' + JSON.stringify(FORMAT) + ',"schemaVersion":' + SCHEMA_VERSION + ',"savedAt":' + JSON.stringify(savedAt)
      + ',"integrity":{"algorithm":"sha256","payload":"' + sha256(payloadText) + '"},"payload":' + payloadText + "}";
    // 자체 검증: 방금 만든 파일이 열기 검증을 통과해야만 내보낸다(열 수 없는 파일을 만들지 않음).
    var v = verifyText(text);
    if (!v.ok) fail("self-verify-failed", v.reason + (v.detail ? " " + v.detail : ""));
    return { text: text, summary: payload.summary, status: status };
  }

  // ── 열기 검증: 텍스트 → 격리 후보(세션 무변경) ──
  function verifyText(text) {
    try { return { ok: true, candidate: verifyTextOrThrow(text) }; }
    catch (e) { return { ok: false, reason: (e && e.reason) || "unexpected", detail: e && e.detail, message: e && e.message }; }
  }
  function verifyTextOrThrow(text) {
    if (typeof text !== "string" || !text.length) fail("empty-file");
    if (text.length > MAX_BYTES) fail("too-large");
    var file;
    try { file = JSON.parse(text); } catch (e) { fail("broken-json"); }
    if (Array.isArray(file) || (file && typeof file === "object" && (file.version !== undefined || file.entries !== undefined || file.armhole_data !== undefined) && file.format === undefined))
      fail("curve-data-file");
    if (!file || typeof file !== "object" || Array.isArray(file)) fail("not-project-file");
    if (file.format !== FORMAT) fail("not-project-file");
    if (file.schemaVersion !== SCHEMA_VERSION) fail("unsupported-version", String(file.schemaVersion));
    scanPlain(file, []);
    if (!file.integrity || file.integrity.algorithm !== "sha256" || typeof file.integrity.payload !== "string") fail("integrity-missing");
    var payload = file.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail("payload-shape");
    var payloadText = JSON.stringify(payload);
    if (sha256(payloadText) !== file.integrity.payload) fail("integrity-mismatch");
    var graphText = JSON.stringify(payload.graph);
    var root = decodeGraph(payload.graph);   // payload.graph.data 를 제자리 복원(파일 객체는 이 함수 지역)
    var keys = Object.keys(root).sort().join(",");
    if (keys !== "block,project") fail("graph-root-keys", keys);
    var block = root.block, proj = root.project;
    // 원형 완료본: canonical 재계산 hash 일치(변조·손상 거부)
    var bw = window.blockWorkflow, dw = window.designWorkflow;
    if (!bw || !bw.verifyCompleted || !dw || !dw.evaluateIsolated) fail("workflow-unavailable");
    var bv = bw.verifyCompleted(block);
    if (!bv.ok) fail("block-invalid", bv.reason);
    var sv = block.snapshot.schemaVersion;
    if (sv !== 8) fail("block-schema-unsupported", String(sv));
    // project 형태·출처 정합
    if (!proj || typeof proj !== "object") fail("project-missing");
    var pk = Object.keys(proj).sort().join(",");
    if (pk !== "baseSource,createdAt,id,referenceGeometry,semanticStatus,sourceBlock,working") fail("project-keys", pk);
    if (proj.id !== "design-1") fail("project-id");
    var sb = proj.sourceBlock;
    if (!sb || sb.id !== block.id || sb.version !== block.version || sb.canonicalHash !== block.canonicalHash || sb.schemaVersion !== sv) fail("source-block-mismatch");
    if (proj.semanticStatus !== "complete") fail("semantic-status");
    if (!sameJSON(proj.baseSource, block.snapshot.source)) fail("base-source-mismatch");
    if (!sameJSON(proj.referenceGeometry, block.snapshot.geometry)) fail("reference-geometry-mismatch");
    // 동결 불변식(startFromBlock·각 complete 가 만든 그대로)
    if (!Object.isFrozen(proj) || !Object.isFrozen(sb) || !isDeepFrozen(proj.baseSource) || !isDeepFrozen(proj.referenceGeometry)) fail("frozen-invariant", "project");
    var w = proj.working;
    if (!w || typeof w !== "object" || Array.isArray(w) || Object.isFrozen(w)) fail("working-shape");
    var g = w.geometry;
    if (!g || typeof g !== "object" || !g.front || !g.back || !Array.isArray(g.front.outline) || !Array.isArray(g.back.outline)) fail("working-geometry");
    if (!w.parameters || typeof w.parameters !== "object") fail("working-parameters");
    if (!Array.isArray(w.patternLines)) fail("working-pattern-lines");
    if (!w.layout || typeof w.layout !== "object") fail("working-layout");
    Object.keys(w).forEach(function (k) { if (!/^[A-Za-z][A-Za-z0-9]*$/.test(k)) fail("working-key", k); });
    ["bodiceResult", "sleeveResult", "collarResult"].forEach(function (k) { if (w[k] != null && !isDeepFrozen(w[k])) fail("frozen-invariant", k); });
    if (w.designResult != null && !Object.isFrozen(w.designResult)) fail("frozen-invariant", "designResult");
    // 화면 단계
    var u = payload.ui;
    if (!u || (u.stage !== "draft" && u.stage !== "design") || ["body", "sleeve", "collar"].indexOf(u.subtab) < 0) fail("ui-state");
    // 완료/변경됨: 기존 판정 함수로 재계산 → 저장 시점과 같아야 한다(몰래 완료·몰래 변경 없음)
    var status = dw.evaluateIsolated(proj, computeStatus);
    if (!sameJSON(status, payload.status)) fail("status-mismatch", JSON.stringify(payload.status) + " → " + JSON.stringify(status));
    if (!sameJSON(summaryOf(block, proj), payload.summary)) fail("summary-mismatch");
    // 충실성 + 판정 무부작용: 되살린 그래프 재인코딩 = 파일 그래프
    if (JSON.stringify(encodeGraph(root)) !== graphText) fail("graph-roundtrip");
    return { block: block, project: proj, ui: { stage: u.stage, subtab: u.subtab }, status: status, summary: payload.summary, savedAt: file.savedAt };
  }

  // ── 세션 원자 교체 ──
  // 트랜잭션: ① 화면 상태 캡처 ② 원형 레코드 교체 ③ project 교체 ④ 화면 단계 적용.
  // ③·④ 어느 단계든 throw 하면 역순으로 되돌린다 — project(이전 객체 그대로 · null 포함)·원형 완료 레코드·
  // 화면 단계/탭/도구/미적용 라인 선택/입력칸 값/카메라(projectSessionUI.rollback). 되돌린 뒤 ui-restore-failed 로 알린다.
  // 후보 객체만 화면 갱신 중 바뀔 수 있다(실패 시 버려짐) — 원본 project 는 이 경로에서 쓰지 않는다.
  function commitCandidate(c) {
    var bw = window.blockWorkflow, dw = window.designWorkflow, U = ui();
    var cap = (U && U.capture) ? U.capture() : null;
    var undoBlock = bw.adoptRestored(c.block);
    var undoProject;
    try { undoProject = dw.adoptRestored(c.project); }
    catch (e) { undoBlock(); throw e; }
    try { if (U) U.afterRestore(c.ui); }
    catch (e) {
      undoProject(); undoBlock();
      var rolledUi = true;
      if (U && U.rollback && cap) { try { U.rollback(cap); } catch (e2) { rolledUi = false; } }
      var err = new Error("projectFile: ui-restore-failed");
      err.reason = "ui-restore-failed"; err.detail = (e && e.message) || String(e); err.uiRolledBack = rolledUi;
      throw err;
    }
  }

  // ── 제품 UI(파일 메뉴) ──
  var REASON_TEXT = {
    "no-project": "디자인 프로젝트가 없습니다 · 원형 완료 → «디자인 시작» 뒤 저장할 수 있습니다",
    "unfinished": "마무리하지 않은 작업이 있습니다",
    "source-block-missing": "출발 원형 완료본을 찾을 수 없습니다",
    "non-finite-number": "형상에 유한하지 않은 수가 있어 저장할 수 없습니다",
    "self-verify-failed": "저장 파일 자체 검증 실패 · 저장하지 않았습니다",
    "empty-file": "빈 파일입니다",
    "too-large": "파일이 너무 큽니다",
    "broken-json": "깨진 파일입니다(JSON 아님 또는 잘림)",
    "curve-data-file": "원형 곡선 데이터 파일입니다 · 파일 메뉴 «데이터 가져오기»로 여세요",
    "not-project-file": "프로젝트 파일이 아닙니다",
    "unsupported-version": "지원하지 않는 프로젝트 파일 버전입니다",
    "integrity-missing": "무결성 정보가 없습니다",
    "integrity-mismatch": "파일 내용이 저장 뒤 바뀌었습니다(무결성 불일치)",
    "forbidden-key": "허용되지 않는 키가 있습니다",
    "block-invalid": "원형 완료본 서명이 맞지 않습니다",
    "block-schema-unsupported": "지원하지 않는 원형 완료본 형식입니다",
    "status-mismatch": "완료/변경됨 상태를 재계산한 결과가 파일과 다릅니다",
    "graph-roundtrip": "복원 검증 실패(재인코딩 불일치)"
  };
  function reasonText(r, detail) {
    var t = REASON_TEXT[r] || ("열 수 없습니다(" + r + ")");
    if (r === "unfinished" && detail) t += ": " + detail;
    return t;
  }
  function note(msg) { var el = document.getElementById("projectFileNote"); if (el) el.textContent = msg; }
  function stamp(d) {
    function z(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + "-" + z(d.getHours()) + z(d.getMinutes());
  }
  function statusLine(st) {
    function one(name, s) { return name + " " + (!s.completed ? "미완료" : s.changed ? "변경됨" : "완료"); }
    return [one("몸판", st.bodice), one("소매", st.sleeve), one("카라", st.collar), one("Design", st.design)].join(" · ");
  }

  function onSave() {
    var built;
    try { built = buildFileText(); }
    catch (e) { note("저장 안 됨 · " + reasonText(e && e.reason, e && e.detail)); sync(); return; }
    var s = built.summary;
    var name = "pattern-project_B" + s.B + "-W" + s.W + "-BL" + s.BL + "_" + stamp(new Date()) + ".json";
    var blob = new Blob([built.text], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    note("프로젝트 저장: " + name + " · " + statusLine(built.status));
  }

  var _pending = null;   // 검증 통과 · 확인 대기 후보
  function showConfirm(on, text) {
    var row = document.getElementById("projectOpenConfirm"); if (row) row.hidden = !on;
    var t = document.getElementById("projectOpenConfirmText"); if (t) t.textContent = on ? text : "";
  }
  function sessionHasWork() {
    var dw = window.designWorkflow, bw = window.blockWorkflow;
    return !!((dw && dw.hasProject()) || (bw && bw.hasCompleted()));
  }
  function onOpenFile(input) {
    var f = input && input.files && input.files[0];
    if (!f) return;
    _pending = null; showConfirm(false);
    var reset = function () { try { input.value = ""; } catch (e) { /* noop */ } };
    if (f.size > MAX_BYTES) { note("열지 않음 · " + reasonText("too-large")); reset(); return; }
    note("파일 확인 중…");
    f.text().then(function (text) {
      reset();
      var v = verifyText(text);
      if (!v.ok) { note("열지 않음(현재 작업 그대로) · " + reasonText(v.reason, v.detail)); return; }
      var c = v.candidate, s = c.summary;
      var desc = "B" + s.B + "/W" + s.W + "/BL" + s.BL + " · 원형 v" + s.blockVersion + " · " + statusLine(c.status) + " · 저장 " + (c.savedAt || "?");
      if (!sessionHasWork()) { openCommit(c, desc); return; }
      _pending = { candidate: c, desc: desc };
      showConfirm(true, "현재 디자인 프로젝트·원형 완료본을 이 파일로 바꿉니다(저장하지 않은 현재 작업은 사라집니다 · 필요하면 먼저 «프로젝트 저장»). 파일: " + desc);
      note("확인 대기 · 아직 아무것도 바뀌지 않았습니다");
    }, function () { reset(); note("열지 않음 · 파일을 읽을 수 없습니다"); });
  }
  function openCommit(c, desc) {
    var U = ui();
    var unfinished = U ? U.unfinished() : [];
    if (unfinished.length) { note("열지 않음(현재 작업 그대로) · " + reasonText("unfinished", unfinished.join(" / "))); return; }
    try { commitCandidate(c); }
    catch (e) {
      note(e && e.reason === "ui-restore-failed" && e.uiRolledBack === false
        ? "열지 않음 · 데이터는 이전 프로젝트로 되돌렸으나 화면 복원 중 오류 — 새로고침 전에 «프로젝트 저장»으로 현재 작업을 보관하세요"
        : "열지 않음(현재 작업 그대로 — 화면 갱신 실패로 되돌림) · " + ((e && e.reason) || "error"));
      sync(); return;
    }
    note("프로젝트 열기 완료: " + desc);
    sync();
  }
  function onConfirmOpen() {
    var p = _pending; _pending = null; showConfirm(false);
    if (!p) return;
    openCommit(p.candidate, p.desc);
  }
  function onCancelOpen() {
    _pending = null; showConfirm(false);
    note("열기 취소 · 현재 작업 그대로");
  }
  function sync() {
    var btn = document.getElementById("btnSaveProject");
    if (!btn) return;
    var dw = window.designWorkflow, has = !!(dw && dw.hasProject());
    btn.disabled = !has;
    if (has) { btn.removeAttribute("aria-disabled"); btn.setAttribute("title", "디자인 프로젝트(원형 완료본 + 몸판·소매·카라 작업·완료 상태)를 JSON 파일로 저장"); }
    else { btn.setAttribute("aria-disabled", "true"); btn.setAttribute("title", "원형 완료 → «디자인 시작» 뒤 저장할 수 있습니다(원형 곡선만은 «데이터 내보내기»)"); }
  }
  function bindMenu() {
    var menu = (typeof document.querySelector === "function") ? document.querySelector('details[data-menu="file"]') : null;
    if (menu) menu.addEventListener("toggle", function () { if (menu.open) sync(); });
    sync();
  }
  if (typeof document !== "undefined" && document.addEventListener) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindMenu);
    else bindMenu();
  }

  window.projectFile = Object.freeze({
    FORMAT: FORMAT, SCHEMA_VERSION: SCHEMA_VERSION,
    buildFileText: buildFileText, verifyText: verifyText, commitCandidate: commitCandidate,
    encodeGraph: encodeGraph, decodeGraph: decodeGraph, sha256: sha256, computeStatus: computeStatus,
    onSave: onSave, onOpenFile: onOpenFile, onConfirmOpen: onConfirmOpen, onCancelOpen: onCancelOpen, sync: sync
  });
})();
