// seamMatch.js — «맞춤 길이» 카드(읽기 전용 파생 표시 · 2026-11-13 김님 승인 1차).
// ── 목적: 봉제 전에 서로 붙는 선의 실제 길이·차이·비교 기준을 한곳에서 본다. 도움 표시일 뿐이다.
// ── 원칙
//   · 새 제도 계산 없음 · 형상/프로젝트/저장/hash 무변경(읽기만) · 자동 길이 맞춤·완료 차단 없음.
//   · 값은 기존 권위에서만: bodiceCheckpoint(check · effectiveOutline · sideSeamSegLen) · designLineTool.sideSeamLabels ·
//     sleeveCheckpoint.check(capLengths · ease) · collarDraft 형상(밴드·위 칼라 outline part 실측 · 표시 없을 때만 body.attachLenCm) · sleeveA.cuff.lengths.
//     DOM 글자 재파싱·메타 목표값을 실측처럼 쓰지 않는다.
//   · 현재 유효 형상 기준. 몸판이 완료 뒤 바뀌어 소매·카라가 옛 몸판 기준이면 «변경됨»(옛 숫자를 현재 값처럼 싣지 않는다).
//   · 못 재는 조합(소매 파생 몸판 · 여러 조각 몸판 · 1차 범위 밖 카라 등)은 «미측정 + 사유». 0 이나 원본 값으로 대체하지 않는다.
//   · 판정 기준은 코드에 이미 있는 것만(출처 표기). 기준이 없는 조합은 차이만 보여 주고 공차를 지어내지 않는다.
//     - 옆선: bodiceCheckpoint MATCH 0.1 / CHECK 0.3cm(몸판 완료 판정과 같은 status)
//     - 밴드 윗선 ↔ 위 칼라 이음선: collarCheckpoint seam-length-mismatch 0.01cm
//     - 어깨 · 진동↔소매산 · 목둘레↔밴드: 기준 없음(차이·방향만) — 0.00 으로 표시되는 차이(|차| < 0.005)만 «일치».
//   · 갱신: ui.js updateDesignResultUI(입력 적용·외곽 편집·완료·저장 복원이 모두 지나는 흐름)는 매번 #designResultCheckNote 글자를 다시 쓴다.
//     그 쓰기를 MutationObserver 로 받아 schedule() 한다(글자 내용은 읽지 않는다 — «갱신이 있었다»는 신호로만 쓴다 · ui.js 무변경).
//     끌기 도중에는 재계산하지 않고 마지막에 한 번(trailing 150ms). render 매 프레임 계산 없음.
(function () {
  "use strict";
  var EXACT = 0.005;           // 표시 정밀도(소수 둘째 자리)에서 0.00 — 공차가 아니라 표시 반올림
  var COLLAR_SEAM_GATE = 0.01; // js/collarCheckpoint.js seam-length-mismatch
  var STATUS_TEXT = { match: "일치", diff: "차이 있음", ease: "이즈", gather: "셔링", unmeasured: "미측정", changed: "변경됨" };

  function num(v) { return typeof v === "number" && isFinite(v); }
  function f2(v) { return v.toFixed(2); }
  function signed(v) { return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2); }
  function project() { return (window.designWorkflow && window.designWorkflow.current()) || null; }

  function unmeasured(id, group, name, reason, basis) { return { id: id, group: group, name: name, status: "unmeasured", reason: reason, basis: basis || [] }; }
  function changed(id, group, name, reason, basis) { return { id: id, group: group, name: name, status: "changed", reason: reason, basis: basis || [] }; }
  // 두 길이 행. diff = b − a(방향은 diffText 에 글로). status 는 호출자가 정한다.
  function pair(id, group, name, a, b, status, diffText, basis, statusText) {
    return { id: id, group: group, name: name, a: a, b: b, diff: b.cm - a.cm, status: status, statusText: statusText || null, diffText: diffText, basis: basis || [] };
  }
  function dirText(d, longer, shorter) {   // d = b − a · longer/shorter = b·a 의 이름
    if (Math.abs(d) < EXACT) return "차이 0.00";
    return (d > 0 ? longer : shorter) + " 쪽이 " + f2(Math.abs(d)) + " 김";
  }

  // ── 몸판 다조각/파생 사유(옆선은 designLineTool.sideSeamLabels 가 같은 판정을 이미 한다 — 어깨는 여기서) ──
  function multiPieceReason(g) {
    if (!g) return null;
    if (g.frontYoke || g.backYoke || g.shoulderYoke) return "요크로 나뉜 몸판 — 조각별 어깨 봉제 길이는 아직 재지 않음";
    if (g.frontCenter || g.backCenter) return "프린세스로 나뉜 몸판 — 조각별 어깨 봉제 길이는 아직 재지 않음";
    if (g.frontPeplum || g.backPeplum || g.frontBody || g.backBody) return "여러 조각 몸판 — 조각별 어깨 봉제 길이는 아직 재지 않음";
    return null;
  }
  function derivedReason(p, piece) {
    var DLT = window.designLineTool;
    return (DLT && DLT.displayedDerivedPiece && DLT.displayedDerivedPiece(p, piece)) ? "소매와 이어진 파생 몸판 — 원래 몸판 값으로 대신하지 않음" : null;
  }

  // 어깨 봉제 길이 = 유효 외곽에서 edge==="shoulder" 로 명시된 구간 합. 다트 다리는 shoulder 가 아니므로 빠진다 = 다트를 닫은 길이.
  function shoulderOf(p, piece) {
    var BC = window.bodiceCheckpoint, g = p.working.geometry;
    var r = derivedReason(p, piece) || multiPieceReason(g); if (r) return { reason: r };
    var o = BC.effectiveOutline(p, piece); if (!o) return { reason: "몸판 외곽 없음" };
    if (o.some(function (s) { return s && s.edgeStatus === "unresolved" && Array.isArray(s.replacedEdges) && s.replacedEdges.indexOf("shoulder") >= 0; }))
      return { reason: "어깨선 일부가 의미를 정하지 못한 대체선으로 덮임" };
    var segs = o.filter(function (s) { return s && s.edge === "shoulder"; });
    if (!segs.length) return { reason: "명시된 어깨선 구간 없음" };
    var dart = segs.length > 1;
    return { cm: segs.reduce(function (t, s) { return t + BC.sideSeamSegLen(s); }, 0), parts: segs.length, dart: dart };
  }

  function bodiceRows(p, bc, rows) {
    var BC = window.bodiceCheckpoint, DLT = window.designLineTool;
    // 1) 옆선
    var lab = DLT && DLT.sideSeamLabels ? DLT.sideSeamLabels(p) : null, ss = bc && bc.sideSeam;
    var sideBasis = ["봉제 길이 = 현재 몸판 유효 외곽에서 옆선으로 명시된 구간 합(허리 아래 연장 포함 · 다트 다리 제외)", "권위: bodiceCheckpoint.measureSideSeam — 몸판 완료 판정과 같은 측정"];
    if (!lab || !lab.front || !lab.back) rows.push(unmeasured("side", "몸판", "앞 옆선 ↔ 뒤 옆선", "몸판 옆선 측정을 쓸 수 없음", sideBasis));
    else if (lab.front.length == null || lab.back.length == null) {
      var rs = []; if (lab.front.length == null) rs.push("앞: " + lab.front.reason); if (lab.back.length == null) rs.push("뒤: " + lab.back.reason);
      rows.push(unmeasured("side", "몸판", "앞 옆선 ↔ 뒤 옆선", rs.join(" / "), sideBasis));
    } else {
      var d = lab.back.length - lab.front.length, st = "diff", stText = null, basis = sideBasis.slice();
      var intent = ss && ss.intent;
      if (intent && ss.status === "match") { st = "ease"; stText = "의도된 이즈"; basis.push("옆선 의도 «" + (intent.mode === "back-ease" ? "뒤" : "앞") + " 여유 " + f2(intent.easeCm) + "cm» 가 설정돼 있고 그 목표와 맞음"); }
      else if (ss && ss.status === "match" && Math.abs(d) < EXACT) st = "match";
      else if (ss && ss.status === "match") { st = "match"; stText = "일치(0.1 이내)"; }
      basis.push("판정 기준 출처: bodiceCheckpoint 옆선 기준(차 0.1cm 이내 = 일치 · 0.3cm 초과 = 몸판 완료에서 불일치)");
      rows.push(pair("side", "몸판", "앞 옆선 ↔ 뒤 옆선", { label: "앞", cm: lab.front.length }, { label: "뒤", cm: lab.back.length }, st, dirText(d, "뒤", "앞"), basis, stText));
    }
    // 2) 어깨
    var sf = shoulderOf(p, "front"), sb = shoulderOf(p, "back");
    var shBasis = ["봉제 길이 = 현재 몸판 유효 외곽에서 어깨선으로 명시된 구간 합 — 어깨에 다트가 열려 있으면 다트 다리는 빼고 양쪽 구간을 더한다(다트를 닫은 길이)"];
    if (!num(sf.cm) || !num(sb.cm)) {
      var rr = []; if (!num(sf.cm)) rr.push("앞: " + sf.reason); if (!num(sb.cm)) rr.push("뒤: " + sb.reason);
      rows.push(unmeasured("shoulder", "몸판", "앞 어깨 ↔ 뒤 어깨", rr.join(" / "), shBasis));
    } else {
      var ds = sb.cm - sf.cm, bs = shBasis.slice();
      if (sb.dart) bs.push("뒤 어깨: 다트로 나뉜 " + sb.parts + "구간 합(다트 닫힘)");
      if (sb.dart || sf.dart) bs.push("다트 양쪽 다리의 길이 차(닫았을 때 입구의 작은 단차)는 어깨 길이에 넣지 않는다 — 패턴 확정 단계 보정 대상");
      if (sf.dart) bs.push("앞 어깨: 다트로 나뉜 " + sf.parts + "구간 합(다트 닫힘)");
      bs.push("판정 기준 없음 — 뒤어깨 이세 허용량은 아직 정하지 않았다(패턴 확정 단계 결정 사항). 차이와 방향만 보여 준다");
      rows.push(pair("shoulder", "몸판", "앞 어깨 ↔ 뒤 어깨", { label: "앞", cm: sf.cm }, { label: "뒤", cm: sb.cm }, Math.abs(ds) < EXACT ? "match" : "diff", dirText(ds, "뒤", "앞"), bs));
    }
  }

  function bodiceStaleReason(p) {
    var BC = window.bodiceCheckpoint, res = BC.latest(p);
    if (!res) return { kind: "none", text: "몸판 모양 완료 뒤 측정" };
    if (BC.isCurrentBodiceChanged(p)) return { kind: "changed", text: "몸판이 완료 뒤 바뀜 — 옛 몸판 기준 값은 싣지 않음. «몸판 모양 완료»를 다시 하면 측정" };
    return null;
  }

  function sleeveRows(p, rows) {
    var SC = window.sleeveCheckpoint, w = p.working, names = [["ah-front", "앞 진동 ↔ 앞 소매산", "front"], ["ah-back", "뒤 진동 ↔ 뒤 소매산", "back"], ["ah-total", "진동 합계 ↔ 소매산 합계", "total"]];
    var basis = ["소매산 = 현재 소매 형상 실측(앞/뒤는 소매산 기준점에서 나눔)", "진동 = 소매가 기준으로 삼은 몸판 완료본의 봉제 진동 길이(다트·이음 틈 제외)", "권위: sleeveCheckpoint.check(capLengths · ease) — 소매 완료 판정과 같은 측정", "이세·셔링분은 오류가 아니다 — 판정 기준 없이 차이와 방향만 보여 준다"];
    var all = function (mk, reason) { names.forEach(function (n) { rows.push(mk(n[0], "소매", n[1], reason, basis)); }); };
    var hasSleeve = !!(w.geometry && w.geometry.sleeve) || !!w.sleeveDraft || Object.keys(w).some(function (k) { return /^sleeve[A-Z]$/.test(k) && w[k]; });
    var stale = bodiceStaleReason(p);
    if (!hasSleeve) return all(unmeasured, stale && stale.kind === "none" ? "몸판 모양 완료 뒤 소매를 만들면 측정" : "소매 없음 — 소매 탭에서 만들면 측정");
    if (stale && stale.kind === "changed") return all(changed, stale.text);
    if (stale) return all(unmeasured, stale.text);
    // Ⓡ~Ⓩ(몸판과 이어지거나 진동을 다시 그리는 소매 · 파생 몸판 소유): check 의 길이·차이가 «원래 몸판 진동 ↔ 소매산» 이라는 보장을 1차에서 확인하지 못했다 → 싣지 않는다.
    var derivedKey = ["R", "S", "T", "U", "V", "W", "X", "Y", "Z"].filter(function (k) { return w["sleeve" + k]; })[0];
    if (derivedKey) return all(unmeasured, "몸판과 이어지거나 진동을 다시 그리는 소매(Ⓡ~Ⓩ) — 진동 ↔ 소매산 비교는 1차 범위 밖. 소매 제작 정보에서 확인");
    var c; try { c = SC.check(p); } catch (e) { c = null; }
    if (!c) return all(unmeasured, "소매 측정을 쓸 수 없음");
    var fails = c.fails || [];
    if (fails.indexOf("bodice-stale") >= 0 || fails.indexOf("source-mismatch") >= 0) return all(changed, "소매가 지금 몸판 완료본이 아닌 옛 몸판 기준 — 소매를 다시 적용하면 측정");
    if (fails.indexOf("no-sleeve") >= 0) return all(unmeasured, "소매 없음 — 소매 탭에서 만들면 측정");
    var L = c.capLengths, E = c.ease;
    if (!L || !E || !num(L.front) || !num(L.back) || !num(E.front) || !num(E.back)) {
      var why = "이 소매 상태에서는 소매산·진동을 잴 수 없음" + (fails.length ? "(" + fails[0] + ")" : "");
      return all(unmeasured, why);
    }
    var tot = { front: L.front, back: L.back, total: num(L.total) ? L.total : L.front + L.back }, et = { front: E.front, back: E.back, total: num(E.total) ? E.total : E.front + E.back };
    names.forEach(function (n) {
      var cap = tot[n[2]], ease = et[n[2]], ah = cap - ease, st, txt, stText = null;
      if (Math.abs(ease) < EXACT) { st = "match"; txt = "차이 0.00"; }
      else if (ease > 0) { st = "ease"; stText = "이즈·셔링분"; txt = "소매산이 " + f2(ease) + " 김"; }
      else { st = "diff"; txt = "소매산이 " + f2(-ease) + " 짧음"; }
      rows.push(pair(n[0], "소매", n[1], { label: "진동", cm: ah }, { label: "소매산", cm: cap }, st, txt, basis, stText));
    });
    // 커프스(소매 Ⓐ 커프스가 있을 때만 — 측정 권위 = sleeveA.cuff.lengths)
    var cuff = w.sleeveA && w.sleeveA.cuff && w.sleeveA.cuff.lengths;
    if (cuff && num(cuff.sleeveHemCm) && num(cuff.attachLengthCm)) {
      var sh = cuff.sleeveHemCm - cuff.attachLengthCm;
      rows.push(pair("cuff", "소매", "소매구 ↔ 커프스", { label: "커프스", cm: cuff.attachLengthCm }, { label: "소매구", cm: cuff.sleeveHemCm },
        sh > EXACT ? "gather" : Math.abs(sh) < EXACT ? "match" : "diff", sh > EXACT ? "셔링분 " + f2(sh) : dirText(sh, "소매구", "커프스"),
        ["소매구 = 소매 Ⓐ 직선 소맷부리 실측 · 커프스 = 커프스 달림 길이(여밈까지 소매를 붙이는 방법)", "권위: designCuff 제도 기록(sleeveA.cuff.lengths) — 트임 처리분은 따로 빼지 않은 값", "셔링분은 의도된 주름 분량이다(오류 아님)"]));
    }
  }

  function roleLen(outline, role) {
    var BC = window.bodiceCheckpoint, segs = (outline || []).filter(function (s) { return s && (s.part || s.role) === role; });
    return segs.length ? segs.reduce(function (t, s) { return t + BC.sideSeamSegLen(s); }, 0) : null;
  }
  function collarRows(p, bc, rows) {
    var w = p.working, cd = w.collarDraft, BC = window.bodiceCheckpoint;
    var N1 = "목둘레 ↔ 밴드 달림선", N2 = "밴드 윗선 ↔ 위 칼라 이음선";
    var half = "모두 반쪽 길이(뒤중심 골선 ~ 앞중심)";
    var b1 = [half + " · 몸판 여밈분과 밴드 앞 끝 연장(여밈분)은 넣지 않음", "목둘레 = 현재 몸판 유효 외곽의 목둘레 실측(앞 + 뒤) · 밴드 달림선 = 현재 밴드 형상에서 달림선으로 표시된 구간 실측", "판정 기준 없음 — 차이와 방향만 보여 준다"];
    var b2 = [half + " · 밴드 앞 끝 연장은 넣지 않음", "밴드 윗선 = 현재 밴드 형상 실측 · 위 칼라 이음선 = 현재 위 칼라 형상의 이음선 구간 실측", "판정 기준 출처: collarCheckpoint — 차 0.01cm 이내여야 카라 완료(같은 길이로 붙는 선)"];
    var both = function (mk, reason) { rows.push(mk("neck-band", "카라", N1, reason, b1)); rows.push(mk("band-collar", "카라", N2, reason, b2)); };
    var stale = bodiceStaleReason(p);
    if (!cd) return both(unmeasured, "카라 없음 — 카라 탭에서 만들면 측정");
    var oldSource = !!(BC.latest(p) && cd.sourceBodiceHash !== BC.latest(p).hash), oldText = "카라가 지금 몸판 완료본이 아닌 옛 몸판 기준 — 카라를 다시 적용하면 측정";
    if (cd.type === "shirt-two-piece" && !cd.standGeometry) return both(oldSource ? changed : unmeasured, oldSource ? oldText : "밴드 형상 없음 — «카라 적용» 뒤 측정");
    if (cd.type !== "shirt-two-piece") return both(unmeasured, "밴드 + 위 칼라로 된 셔츠 칼라만 1차 지원 — 이 카라 종류의 달림선 길이는 카라 제작 정보에서 확인");
    if (stale && stale.kind === "changed") rows.push(changed("neck-band", "카라", N1, stale.text, b1));
    else if (stale) rows.push(unmeasured("neck-band", "카라", N1, stale.text, b1));
    else if (oldSource) rows.push(changed("neck-band", "카라", N1, oldText, b1));
    else {
      var neck = bc && bc.neckline && bc.neckline.ok ? bc.neckline.half : null, seam = roleLen(cd.standGeometry.outline, "neck-seam");
      if (!num(neck)) rows.push(unmeasured("neck-band", "카라", N1, "몸판 목둘레를 잴 수 없음", b1));
      else if (!num(seam)) rows.push(unmeasured("neck-band", "카라", N1, "밴드 형상에 달림선 표시 구간이 없음", b1));
      else { var d1 = seam - neck; rows.push(pair("neck-band", "카라", N1, { label: "목둘레", cm: neck }, { label: "밴드", cm: seam }, Math.abs(d1) < EXACT ? "match" : "diff", dirText(d1, "밴드", "목둘레"), b1)); }
    }
    // 위 칼라 이음선: 현재 위 칼라 형상의 attach 구간을 직접 잰다(직접 수정 뒤에도 지금 형상). 형상에 표시가 없을 때만 카라 기록값(body.attachLenCm).
    var top = roleLen(cd.standGeometry.outline, "top"), upGeo = cd.body && cd.body.geometry ? roleLen(cd.body.geometry.outline, "attach") : null;
    var up = num(upGeo) ? upGeo : (cd.body ? cd.body.attachLenCm : null);
    if (cd.body && !num(upGeo)) b2 = b2.concat(["위 칼라 형상에 이음선 표시가 없어 카라 기록값(body.attachLenCm)을 썼다"]);
    if (!cd.body) rows.push(unmeasured("band-collar", "카라", N2, "위 칼라 없음 — «본체 적용» 뒤 측정", b2));
    else if (cd.body.invalid) rows.push(unmeasured("band-collar", "카라", N2, "위 칼라 선이 유효하지 않음 — 고친 뒤 측정", b2));
    else if (!num(top)) rows.push(unmeasured("band-collar", "카라", N2, "밴드 형상에 윗선 표시 구간이 없음", b2));
    else if (!num(up)) rows.push(unmeasured("band-collar", "카라", N2, "위 칼라 이음선 길이 기록 없음", b2));
    else { var d2 = up - top; rows.push(pair("band-collar", "카라", N2, { label: "밴드 윗선", cm: top }, { label: "위 칼라", cm: up }, Math.abs(d2) <= COLLAR_SEAM_GATE ? "match" : "diff", dirText(d2, "위 칼라", "밴드 윗선"), b2, Math.abs(d2) >= EXACT && Math.abs(d2) <= COLLAR_SEAM_GATE ? "일치(0.01 이내)" : null)); }
  }

  // ── 모델: 읽기만 한다. p 를 바꾸지 않는다. ──
  function compute(p) {
    p = p || project();
    var BC = window.bodiceCheckpoint, SC = window.sleeveCheckpoint;
    if (!p || !p.working || !p.working.geometry || !BC || !SC) return { ok: false, rows: [], counts: {} };
    var rows = [], bc = null;
    try { bc = BC.check(p); } catch (e) { bc = null; }
    try { bodiceRows(p, bc, rows); } catch (e) { rows.push(unmeasured("side", "몸판", "몸판 맞춤 길이", "측정 중 오류 — 값을 싣지 않음")); }
    try { sleeveRows(p, rows); } catch (e) { rows.push(unmeasured("ah-total", "소매", "진동 ↔ 소매산", "측정 중 오류 — 값을 싣지 않음")); }
    try { collarRows(p, bc, rows); } catch (e) { rows.push(unmeasured("neck-band", "카라", "목둘레 ↔ 카라", "측정 중 오류 — 값을 싣지 않음")); }
    var counts = {}; rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
    return { ok: true, rows: rows, counts: counts };
  }

  // ── 표시 ──
  var BADGE = { match: "ok", diff: "warn", ease: "info", gather: "info", unmeasured: "mute", changed: "chg" };
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function badge(r) { return '<span class="ax-badge ax-badge-' + BADGE[r.status] + '">' + esc(r.statusText || STATUS_TEXT[r.status]) + "</span>"; }
  function rowHtml(r, open) {
    var head = '<span class="sm-name">' + esc(r.name) + "</span>" + badge(r);
    var nums = r.a ? '<span class="sm-nums"><span>' + esc(r.a.label) + " <b>" + f2(r.a.cm) + "</b></span><span>" + esc(r.b.label) + " <b>" + f2(r.b.cm) + '</b></span><span class="sm-diff">' + esc(r.diffText) + "</span></span>"
      : '<span class="sm-nums sm-reason">' + esc(r.reason) + "</span>";
    var det = (r.a ? ["차이 = " + r.b.label + " − " + r.a.label + " = " + signed(r.diff) + "cm"] : ["사유: " + r.reason]).concat(r.basis || []);
    return '<details class="sm-row" data-sm-row="' + r.id + '" data-sm-status="' + r.status + '"' + (open ? " open" : "") + "><summary>" + '<span class="sm-head">' + head + "</span>" + nums + "</summary>" +
      '<ul class="sm-basis">' + det.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></details>";
  }
  function summaryText(m) {
    var order = ["match", "diff", "ease", "gather", "unmeasured", "changed"], parts = [];
    order.forEach(function (k) { if (m.counts[k]) parts.push(STATUS_TEXT[k] + " " + m.counts[k]); });
    return parts.join(" · ");
  }
  var lastHtml = null;
  function render() {
    var card = document.getElementById("seamMatchCard"), body = document.getElementById("seamMatchBody"), sum = document.getElementById("seamMatchSummary");
    if (!card || !body || !sum) return;
    var m = compute();
    if (!m.ok) { if (lastHtml !== "") { body.innerHTML = ""; sum.textContent = ""; lastHtml = ""; } card.hidden = true; return; }
    card.hidden = false;
    var open = {}; body.querySelectorAll("details[open]").forEach(function (d) { open[d.getAttribute("data-sm-row")] = 1; });
    var html = "", group = null;
    m.rows.forEach(function (r) { if (r.group !== group) { group = r.group; html += '<div class="sm-group">' + esc(group) + "</div>"; } html += rowHtml(r, open[r.id]); });
    html += '<div class="sm-foot">단위 cm · 읽기 전용 — 길이를 자동으로 맞추거나 완료를 막지 않습니다. 행을 누르면 측정 기준이 나옵니다.</div>';
    if (html !== lastHtml) { body.innerHTML = html; lastHtml = html; }   // 자식에 리스너 없음(네이티브 details 만) · 같은 내용이면 다시 그리지 않는다
    sum.textContent = summaryText(m);
  }
  var timer = null;
  function schedule() {
    if (typeof document === "undefined") return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function tick() {
      timer = null;
      var DLT = window.designLineTool;
      if (DLT && DLT.isEditDragging && DLT.isEditDragging()) { timer = setTimeout(tick, 150); return; }   // 끌기 중에는 계산하지 않는다
      try { render(); } catch (e) { /* 표시 전용 — 실패해도 작업을 막지 않는다 */ }
    }, 150);
  }

  window.seamMatch = Object.freeze({ compute: compute, render: render, schedule: schedule, STATUS_TEXT: STATUS_TEXT });
  if (typeof document !== "undefined" && document.getElementById) {
    var sig = document.getElementById("designResultCheckNote");
    if (sig && typeof MutationObserver !== "undefined") new MutationObserver(schedule).observe(sig, { childList: true, characterData: true, subtree: true });
    if (typeof MutationObserver !== "undefined" && document.documentElement) new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ["data-workspace-stage"] });
    schedule();
  }
})();
