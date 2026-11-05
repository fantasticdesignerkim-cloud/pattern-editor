// ══════════════════════════════════════════════
// js/sleeveSplit.js — 소매 파트 분리(2026-11-05 김님 승인 «소매에서도 선 그리기 → 그리기 완료 → 절개선 → 파트 분리»).
//
// 몸판 파트 분리(designLineTool.splitRingByCut)를 **그대로 재사용**한다. 다른 점은 고리를 만드는 방법 하나뿐이다.
//   · 몸판: 열린 다트 입구 1개를 construction 다트 다리로 닫아 고리(buildPieceRing).
//   · 소매: 소매 외곽(outline)이 **그 자체로 닫힌 고리**다(기본 · Ⓐ~Ⓧ 실측 — Ⓒ 의 열린 뒤 다트 V 도 outline 에 있다).
//     → 보조선·제도선(construction)으로 아무것도 봉합하지 않는다. 열린 V 는 실제 외곽선 그대로 두 파트 중 한쪽에 남는다.
//     닫힌 한 고리가 아니면(끊김·갈래·여러 고리) 숨기지 않고 사유를 낸다.
//   · 두 장 소매(Ⓥ: geometry.pieces = [back, front], primitive.piece 태그): 절개선 양끝이 **같은 조각** 위여야 한다.
//   · 별도 소매 조각이 없는 소매(Ⓨ·Ⓩ: sleevePiece:false · 빈 outline): 자를 대상 없음(소매 파생 몸판 분리는 범위 밖).
//
// 현재성(sleeveRef): 분리 기준 = **현재 몸판·입력과 일치하는 sleeveResult**(frozen geometry). 화면 소매(working.geometry.sleeve)와
//   완료본 outline 이 바이트 동일할 때만 «현재» — 그래서 snap(화면)·검증·분할이 같은 형상을 본다. 미완료·변경·차단·몸판 변경은
//   이전 형상으로 자르지 않고 재완료 이유를 낸다.
// 파트 결속(makeParts/partCurrent): 소매 파트는 sourcePiece:"sleeve" + sourceCutId 에 더해 출처 소매·몸판 hash · 소매 기호 ·
//   조각 이름 · 절개선 서명을 들고, 하나라도 현재와 다르면 «현재 결과»가 아니다(표시·집계 제외 → prune 으로 제거).
//
// 외곽 대체 미리보기(2026-11-06): 같은 고리·같은 현재성(sleeveRef)으로 몸판 replaceArcOnRing 을 재사용한다 — 아래 «외곽 대체 미리보기» 절.
//
// 불변: 원형·bodiceResult·sleeveResult·working.geometry 를 읽기만 한다(파트는 새 세그먼트 — cloneSeg/subSegment 경유).
// 저장·출력 체계 없음: working.parts 는 종전대로 세션 미리보기(마지막 분리 한 쌍)이고 designResult hash 에 들어가지 않는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const ON_TOL = 0.05;          // 절개선 끝점이 외곽 위로 인정되는 거리(cm) — validateCut·splitRingByCut 와 같은 값
  const RING_EPS = 0.02;        // 외곽 끝점 이음 허용(cm) — buildPieceRing 과 같은 값
  const SYMS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const T = () => window.designLineTool;
  const J = JSON.stringify;

  // ── 순수: primitive → line/cubic 세그먼트(조각 태그 보존) ──
  function _pt(p) { return { x: p.x, y: p.y }; }
  function primToSegs(pr) {
    if (pr.kind === "path" && (pr.commands || []).some(c => c.type !== "M" && c.type !== "C")) {   // L 이 섞인 path(현재 소매엔 없음 — 방어)
      const out = []; let cur = null;
      pr.commands.forEach(c => {
        if (c.type === "M") cur = c.points[0];
        else if (c.type === "L") { out.push({ kind: "line", from: _pt(cur), to: _pt(c.points[0]) }); cur = c.points[0]; }
        else if (c.type === "C") { out.push({ kind: "cubic", from: _pt(cur), c1: _pt(c.points[0]), c2: _pt(c.points[1]), to: _pt(c.points[2]) }); cur = c.points[2]; }
      });
      if (pr.edge) out.forEach(s => { s.edge = pr.edge; });
      return out;
    }
    return T().outlinePrimsToSegs([pr]);    // 몸판과 같은 변환(의미 metadata 승계)
  }
  // 소매 geometry → 조각 목록 [{ name, segs, darts }]. pieces 가 둘 이상이면 primitive.piece 태그로 나눈다(Ⓥ).
  //   darts[i] = segs[i] 가 열린 다트 V 다리(primitive role 에 "dart" — Ⓒ dart-leg-* · Ⓦ shoulder-dart)인가. 외곽 대체만 쓴다(분리는 종전대로 무시).
  const DART_ROLE = /dart/;
  function _groupOf(name, list) {
    const segs = [], darts = [];
    list.forEach(pr => primToSegs(pr).forEach(sg => { segs.push(sg); darts.push(DART_ROLE.test(pr.role || "")); }));
    return { name: name, segs: segs, darts: darts };
  }
  function pieceGroups(g) {
    const prims = (g && Array.isArray(g.outline)) ? g.outline : [];
    if (!prims.length) return [];
    if (Array.isArray(g.pieces) && g.pieces.length > 1) {
      return g.pieces.map(name => _groupOf(name, prims.filter(pr => pr.piece === name)))
        .concat(prims.some(pr => g.pieces.indexOf(pr.piece) < 0) ? [_groupOf("?", prims.filter(pr => g.pieces.indexOf(pr.piece) < 0))] : []);
    }
    return [_groupOf((Array.isArray(g.pieces) && g.pieces[0]) || "sleeve", prims)];
  }
  function _d(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // 순수: 세그먼트(무순서) → 외곽만으로 닫힌 한 고리 [{seg, source:"outline"}]. 다른 선으로 메우지 않는다.
  //   끝점마다 짝이 정확히 하나여야 한다(0 = 끊김 · 2 이상 = 갈래). 모두 쓰기 전에 닫히면 여러 고리.
  function buildClosedRing(segs) {
    const D = T(), n = segs.length;
    if (!n) return { ok: false, reason: "외곽선 없음" };
    const ends = []; segs.forEach((s, i) => { ends.push({ i: i, p: s.from }); ends.push({ i: i, p: s.to }); });
    let gaps = 0, maxGap = 0, forks = 0;
    ends.forEach(e => {
      let k = 0, best = Infinity;
      ends.forEach(f => { if (f.i === e.i) return; const d = _d(e.p, f.p); if (d <= RING_EPS) k++; else best = Math.min(best, d); });
      if (k === 0) { gaps++; maxGap = Math.max(maxGap, best); } else if (k > 1) forks++;
    });
    if (gaps) return { ok: false, reason: "외곽선 끊김 " + Math.ceil(gaps / 2) + "곳(틈 최대 " + maxGap.toFixed(3) + "cm) — 닫힌 한 고리가 아님" };
    if (forks) return { ok: false, reason: "외곽선 갈래(한 점에 셋 이상 모임) — 닫힌 한 고리가 아님" };
    const used = new Array(n).fill(false), chain = [], idx = [0];   // idx = 고리 순서의 원래 세그먼트 번호(외곽 대체가 다트 다리 출처를 되찾는 데 쓴다)
    let first = D.cloneSeg(segs[0]);   // 복사(의미 승계)
    chain.push(first); used[0] = true; let cur = first.to;
    for (let step = 1; step < n; step++) {
      if (_d(cur, first.from) <= RING_EPS) return { ok: false, reason: "외곽이 여러 고리(" + step + "개 세그먼트에서 먼저 닫힘) — 한 조각이 아님" };
      let found = -1, oriented = null;
      for (let j = 0; j < n; j++) {
        if (used[j]) continue;
        if (_d(segs[j].from, cur) <= RING_EPS) { found = j; oriented = D.cloneSeg(segs[j]); break; }
        if (_d(segs[j].to, cur) <= RING_EPS) { found = j; oriented = D.reverseSeg(segs[j]); break; }
      }
      if (found < 0) return { ok: false, reason: "외곽선이 이어지지 않음 — 닫힌 한 고리가 아님" };
      oriented.from = _pt(cur);                         // 이음점 정확 공유(drift 제거 — buildPieceRing 과 같음)
      used[found] = true; chain.push(oriented); idx.push(found); cur = oriented.to;
    }
    if (_d(cur, first.from) > RING_EPS) return { ok: false, reason: "외곽선 고리가 닫히지 않음" };
    chain[chain.length - 1].to = _pt(first.from);
    return { ok: true, ring: chain.map((s, i) => ({ seg: s, source: "outline", k: idx[i] })) };
  }
  function _polyOf(ring) { const pts = []; ring.forEach(r => T().flattenSegment(r.seg).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); })); return pts; }
  function _inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (((a.y > pt.y) !== (b.y > pt.y)) && (pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x)) c = !c;
    }
    return c;
  }

  // 순수: 소매 geometry 를 절개선으로 두 파트. 반환 { ok, parts:[segsA, segsB], piece, code?, reason }.
  //   code: no-piece | off-outline | cross-piece | ring | invalid | outside | split — 화면 문구는 reason(구체적 이유).
  function splitSleeve(g, cutSegs, opts) {
    opts = opts || {}; const tol = opts.onTol != null ? opts.onTol : ON_TOL, D = T();
    if (!g || g.sleevePiece === false || !Array.isArray(g.outline) || !g.outline.length)
      return { ok: false, code: "no-piece", reason: "별도 소매 조각이 없음(소매가 몸판과 한 장) — 자를 소매 파트가 없습니다" };
    if (!cutSegs || !cutSegs.length) return { ok: false, code: "invalid", reason: "절개선 없음" };
    const C0 = cutSegs[0].from, C1 = cutSegs[cutSegs.length - 1].to;
    const groups = pieceGroups(g).map(gr => { const f = D.flattenLine(gr.segs); return { name: gr.name, segs: gr.segs, flat: f, d0: D.distPtToSegs(C0, f), d1: D.distPtToSegs(C1, f) }; });
    const on0 = groups.filter(x => x.d0 <= tol), on1 = groups.filter(x => x.d1 <= tol);
    if (!on0.length) return { ok: false, code: "off-outline", reason: "절개선 시작점이 소매 외곽선 위에 없음" };
    if (!on1.length) return { ok: false, code: "off-outline", reason: "절개선 끝점이 소매 외곽선 위에 없음" };
    const gr = on0.filter(x => on1.indexOf(x) >= 0)[0];
    if (!gr) return { ok: false, code: "cross-piece", reason: "절개선 양끝이 서로 다른 소매 조각(" + on0[0].name + " ↔ " + on1[0].name + ") 위 — 한 조각 안에서 시작·끝나야 두 파트가 됩니다" };
    const rb = buildClosedRing(gr.segs);
    if (!rb.ok) return { ok: false, code: "ring", reason: "소매 외곽 형태 미지원: " + rb.reason };
    const v = D.validateCut({ role: "cut", segments: cutSegs }, gr.flat, [], { onTol: tol });
    if (!v.ok) return { ok: false, code: "invalid", reason: v.reason };
    // 끝점 근처를 뺀 내부 샘플이 소매 안이어야 한다(바깥으로 돌아 나가는 선은 종이를 두 조각으로 나누지 못한다).
    const poly = _polyOf(rb.ring), samples = [];
    D.flattenLine(cutSegs).forEach(ab => { samples.push({ x: (ab[0].x + ab[1].x) / 2, y: (ab[0].y + ab[1].y) / 2 }); samples.push(ab[1]); });
    if (samples.filter(q => _d(q, C0) > tol && _d(q, C1) > tol).some(q => !_inside(q, poly)))
      return { ok: false, code: "outside", reason: "절개선이 소매 조각 바깥을 지남 — 종이 위에서 두 조각으로 나뉘지 않음" };
    const res = D.splitRingByCut(rb.ring, cutSegs, { onTol: tol });
    if (!res.ok) return { ok: false, code: "split", reason: res.reason };
    return { ok: true, parts: res.parts, piece: gr.name };
  }

  // ── 현재성: 분리 기준 소매 ──
  function symOf(presetId) { const m = /^bunka-sleeve-([A-Z])$/.exec(presetId || ""); return m ? String.fromCharCode(0x24B6 + m[1].charCodeAt(0) - 65) : "기본"; }
  function liveLine(p) {
    const w = p && p.working; if (!w) return null;
    for (const s of SYMS) if (w["sleeve" + s]) return { key: "sleeve" + s, state: w["sleeve" + s], sym: symOf("bunka-sleeve-" + s) };
    return null;
  }
  // 반환 { source:"current", sym, geometry(frozen), sleeveHash, bodiceHash } | { source:"pending", sym, reason, blocked? } | { source:"none", sym, reason }.
  function sleeveRef(p) {
    const w = p && p.working; if (!w) return { source: "pending", sym: "?", reason: "Design 프로젝트 없음" };
    const live = liveLine(p), sym = live ? live.sym : "기본", g = w.geometry && w.geometry.sleeve;
    const pend = (reason, extra) => Object.assign({ source: "pending", sym: sym, reason: reason }, extra || {});
    if (!g || g.sleevePiece === false || !Array.isArray(g.outline) || !g.outline.length)
      return { source: "none", sym: sym, reason: "소매 " + sym + " 는 별도 소매 조각이 없음(소매가 몸판과 한 장) — 소매 파트로 자를 대상이 없습니다 · 파생 몸판 분리는 이번 범위 밖" };
    if (live && live.state.blocked) return pend("소매 " + sym + " 적용이 차단됨(" + (live.state.blocked.text || live.state.blocked.reason || "차단") + ") — 화면 소매는 이전 형상입니다 · 소매 탭에서 고쳐 다시 적용·완료하세요", { blocked: true });
    const SCk = window.sleeveCheckpoint, BCk = window.bodiceCheckpoint;
    if (!SCk || !BCk) return pend("소매·몸판 완료 조회 모듈 없음");
    const bodice = BCk.latest(p);
    if (!bodice) return pend("몸판 모양 완료 전 — 몸판·소매 모양을 완료하면 그 소매를 기준으로 자릅니다");
    if (BCk.isCurrentBodiceChanged(p)) return pend("몸판이 완료 후 바뀜 — 몸판·소매 모양을 다시 완료하세요");
    const sleeve = SCk.latest(p);
    if (!sleeve) return pend("소매 " + sym + " 모양 완료 전 — 소매 모양을 완료하면 그 완료본 기준으로 자릅니다");
    const doneSym = symOf(sleeve.origin && sleeve.origin.presetId);
    if (doneSym !== sym) return pend("완료된 소매는 " + doneSym + ", 현재 소매는 " + sym + " — 소매 모양을 다시 완료하세요");
    if (sleeve.sourceBodiceHash !== bodice.hash || SCk.invalidatedByBodice(p)) return pend("소매 완료본의 출처가 현재 몸판과 다름 — 소매 모양을 다시 완료하세요");
    if (SCk.isCurrentSleeveChanged(p)) return pend("소매(" + sym + ")가 완료 후 바뀜(입력·형상) — 소매 모양을 다시 완료하세요");
    if (!sleeve.geometry || J(sleeve.geometry.outline) !== J(g.outline)) return pend("화면 소매와 소매 완료본이 다름 — 소매 모양을 다시 완료하세요");
    return { source: "current", sym: sym, geometry: sleeve.geometry, sleeveHash: sleeve.hash, bodiceHash: bodice.hash };
  }

  // 절개선 상태(소매) — designLineTool.cutStatusOf 가 소매 선에 부른다. 유효성(validateCut)과 실제 분리 가능(splitSleeve 시험)을 따로 낸다.
  //   반환 { ok(=유효 절개선), basis:"sleeve", kind: ok|pending|physical|invalid|none, ready(=지금 분리 가능), sym, reason, piece? }.
  //   검증 형상 = 현재면 완료본(= 화면과 바이트 동일), 아니면 화면 소매(snap 과 같은 형상) · 차단이면 이전 형상이라 판정 보류.
  function cutStatus(p, line, othersFlat) {
    const ref = sleeveRef(p), base = { basis: "sleeve", sym: ref.sym };
    Object.defineProperty(base, "_ref", { value: ref, enumerable: false });   // 같은 동기화 안에서 prune·doSplit 이 재사용(전체 판정 1회)
    if (ref.source === "none") return Object.assign(base, { ok: false, ready: false, kind: "none", reason: ref.reason });
    if (ref.blocked) return Object.assign(base, { ok: false, ready: false, kind: "pending", reason: ref.reason });
    const g = ref.source === "current" ? ref.geometry : p.working.geometry.sleeve;
    const flat = T().flattenLine([].concat.apply([], pieceGroups(g).map(x => x.segs)));
    const v = T().validateCut(line, flat, othersFlat || []);
    if (!v.ok) return Object.assign(base, { ok: false, ready: false, kind: "invalid", reason: v.reason });
    if (ref.source !== "current") return Object.assign(base, { ok: true, ready: false, kind: "pending", reason: ref.reason });
    const dry = splitSleeve(g, line.segments);
    if (!dry.ok) return Object.assign(base, { ok: true, ready: false, kind: "physical", code: dry.code, reason: dry.reason });
    return Object.assign(base, { ok: true, ready: true, kind: "ok", piece: dry.piece, reason: "분리 가능" });
  }

  // ── 파트 결속 ──
  function cutSig(segs) {
    const r = v => Math.round(v * 1e6) / 1e6;
    return (segs || []).map(s => s.kind === "cubic" ? "C" + [s.from.x, s.from.y, s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.to.x, s.to.y].map(r).join(",")
      : "L" + [s.from.x, s.from.y, s.to.x, s.to.y].map(r).join(",")).join("|");
  }
  function makeParts(ref, line, res) {
    return res.parts.map((outline, i) => ({ id: "part-" + (i + 1), sourcePiece: "sleeve", sourceCutId: line.id, sourceSleevePiece: res.piece,
      sourceSleeveSym: ref.sym, sourceSleeveHash: ref.sleeveHash, sourceBodiceHash: ref.bodiceHash, sourceCutSig: cutSig(line.segments), outline: outline }));
  }
  // 표시용 빠른 현재성(render·막대가 매번 부른다 — isCurrentSleeveChanged 는 파생 소매 Ⓡ~Ⓦ 에서 250~580ms 라 여기서 부르지 않는다).
  //   완료본 hash(소매·몸판) · 소매↔몸판 출처 · 현재 소매 기호 · 차단 · **화면 outline = 완료본 outline(바이트)** 만 본다.
  //   입력만 바뀌고 형상이 같은 경우 등 전체 판정이 필요한 변화는 상태 동기화(syncCutStatus → pruneStaleSleeveParts = sleeveRef 전체)가 지운다.
  function quickRef(p) {
    const w = p && p.working; if (!w) return { source: "pending" };
    const live = liveLine(p), sym = live ? live.sym : "기본", g = w.geometry && w.geometry.sleeve, s = w.sleeveResult, b = w.bodiceResult;
    if (!g || !Array.isArray(g.outline) || !g.outline.length || (live && live.state.blocked) || !s || !b || !s.geometry) return { source: "pending", sym: sym };
    if (s.sourceBodiceHash !== b.hash || symOf(s.origin && s.origin.presetId) !== sym || J(s.geometry.outline) !== J(g.outline)) return { source: "pending", sym: sym };
    return { source: "current", sym: sym, sleeveHash: s.hash, bodiceHash: b.hash };
  }
  // 소매 파트가 지금도 현재 결과인가(ref 를 넘기면 재계산하지 않는다 · 기본 = 빠른 판정).
  function partCurrent(p, part, ref) {
    if (!part || part.sourcePiece !== "sleeve") return false;
    ref = ref || quickRef(p);
    if (ref.source !== "current" || ref.sym !== part.sourceSleeveSym || ref.sleeveHash !== part.sourceSleeveHash || ref.bodiceHash !== part.sourceBodiceHash) return false;
    const line = ((p.working && p.working.patternLines) || []).filter(l => l.id === part.sourceCutId)[0];
    return !!(line && line.piece === "sleeve" && line.role === "cut" && cutSig(line.segments) === part.sourceCutSig);
  }

  // ── 외곽 대체 미리보기(2026-11-06 김님 «외곽 선택하면 외곽 대체 미리보기가 있어야지») ──
  // 몸판 외곽 대체(designLineTool.replaceArcOnRing)를 **그대로 재사용**한다. 다른 점은 고리뿐이다(분리와 같은 닫힌 한 고리).
  //   · 열린 다트 V(Ⓒ·Ⓦ)의 다리 = 고리에서 dartleg 출처 → 대체 구간이 V 를 품거나 끝점이 다리 위면 거부(V 는 실제 외곽 — 지우지 않음),
  //     유지 구간의 V 는 결과에 그대로 남는다(keepDartlegs · 결과 = 닫힌 한 고리).
  //   · 두 장(Ⓥ): 선 양끝이 같은 조각 위여야 한다(다른 조각과 잇지 않음) · 결과는 그 조각만 — 다른 조각은 손대지 않는다.
  //   · 애매한 대체 구간(양쪽 길이 유사) · 자기교차 · 유지 외곽과 교차 · 폐곡선 무효는 몸판과 같은 판정(계약 그대로).
  //   미리보기일 뿐 — 원형·bodiceResult·sleeveResult·working.geometry 를 바꾸지 않고 sleeveResult·Design 완료/hash 에 들어가지 않는다.
  function _bndReason(r) {
    if (/다트 다리 위/.test(r)) return "대체선 끝점이 열린 다트 V 다리 위 — V 는 실제 외곽이라 그 다리에서 시작·끝내지 않습니다(V 밖 외곽에서 시작·끝내세요)";
    if (/다트를 포함/.test(r)) return "대체할 구간이 열린 다트 V 를 품음 — V 는 실제 외곽이라 지우지 않습니다";
    return r;
  }
  // 순수: 소매 geometry 의 한 조각 외곽을 대체선으로 바꾼 결과. 반환 { ok, outline(닫힌 한 고리 · 새 세그먼트), piece, code?, reason }.
  //   code: no-piece | off-outline | cross-piece | ring | replace
  function boundarySleeve(g, bndSegs, opts) {
    opts = opts || {}; const tol = opts.onTol != null ? opts.onTol : ON_TOL, D = T();
    if (!g || g.sleevePiece === false || !Array.isArray(g.outline) || !g.outline.length)
      return { ok: false, code: "no-piece", reason: "별도 소매 조각이 없음(소매가 몸판과 한 장) — 대체할 소매 외곽이 없습니다" };
    if (!bndSegs || !bndSegs.length) return { ok: false, code: "replace", reason: "대체선 없음" };
    const B0 = bndSegs[0].from, B1 = bndSegs[bndSegs.length - 1].to;
    const groups = pieceGroups(g).map(gr => { const f = D.flattenLine(gr.segs); return Object.assign({}, gr, { d0: D.distPtToSegs(B0, f), d1: D.distPtToSegs(B1, f) }); });
    const on0 = groups.filter(x => x.d0 <= tol), on1 = groups.filter(x => x.d1 <= tol);
    if (!on0.length) return { ok: false, code: "off-outline", reason: "대체선 시작점이 소매 외곽선 위에 없음" };
    if (!on1.length) return { ok: false, code: "off-outline", reason: "대체선 끝점이 소매 외곽선 위에 없음" };
    const gr = on0.filter(x => on1.indexOf(x) >= 0)[0];
    if (!gr) return { ok: false, code: "cross-piece", reason: "대체선 양끝이 서로 다른 소매 조각(" + on0[0].name + " ↔ " + on1[0].name + ") 위 — 한 조각의 외곽만 대체합니다(다른 조각과 잇지 않음)" };
    const rb = buildClosedRing(gr.segs);
    if (!rb.ok) return { ok: false, code: "ring", reason: "소매 외곽 형태 미지원: " + rb.reason };
    rb.ring.forEach(r => { if (gr.darts[r.k]) r.source = "dartleg"; });
    const r = D.replaceArcOnRing(rb.ring, bndSegs, { onTol: tol, keepDartlegs: true });
    if (!r.ok) return { ok: false, code: "replace", reason: _bndReason(r.reason) };
    return { ok: true, outline: r.outline, piece: gr.name };
  }
  // 대체선 상태(소매) — designLineTool.validateSelectedBoundary 가 소매 선에 부른다(상태 동기화 때만 · render 는 안 부른다).
  //   기준 = 분리와 같은 현재 소매 완료본(sleeveRef) — 미완료·변경·차단·몸판 변경이면 이전 형상으로 대체하지 않고 재완료 이유.
  //   반환 { ok, basis:"sleeve", kind: ok|pending|invalid|none, sym, reason, piece?, outline? } (_ref 비열거 = 같은 동기화에서 재사용).
  function boundaryStatus(p, line) {
    const ref = sleeveRef(p), base = { basis: "sleeve", sym: ref.sym };
    Object.defineProperty(base, "_ref", { value: ref, enumerable: false });
    if (ref.source === "none") return Object.assign(base, { ok: false, kind: "none", reason: ref.reason });
    if (ref.source !== "current") return Object.assign(base, { ok: false, kind: "pending", reason: ref.reason });
    const res = boundarySleeve(ref.geometry, T().boundarySegsOf(line));
    if (!res.ok) return Object.assign(base, { ok: false, kind: res.code === "no-piece" ? "none" : "invalid", code: res.code, reason: res.reason });
    return Object.assign(base, { ok: true, kind: "ok", piece: res.piece, outline: res.outline, reason: "대체 가능 — 소매 " + ref.sym + " 완료본 기준" });
  }
  // 미리보기 결속: 출처 소매·몸판 hash · 소매 기호 · 조각 이름 · 대체선 서명. 하나라도 현재와 다르면 «현재 결과»가 아니다.
  function makeBoundaryPreview(ref, line, st) {
    return { sourcePiece: "sleeve", sourceLineId: line.id, outline: st.outline, sourceSleevePiece: st.piece,
      sourceSleeveSym: ref.sym, sourceSleeveHash: ref.sleeveHash, sourceBodiceHash: ref.bodiceHash, sourceLineSig: cutSig(line.segments) };
  }
  function previewCurrent(p, bp, ref) {
    if (!bp || bp.sourcePiece !== "sleeve") return false;
    ref = ref || quickRef(p);
    if (ref.source !== "current" || ref.sym !== bp.sourceSleeveSym || ref.sleeveHash !== bp.sourceSleeveHash || ref.bodiceHash !== bp.sourceBodiceHash) return false;
    const line = ((p.working && p.working.patternLines) || []).filter(l => l.id === bp.sourceLineId)[0];
    return !!(line && line.piece === "sleeve" && line.role === "boundary" && cutSig(line.segments) === bp.sourceLineSig);
  }

  window.sleeveSplit = Object.freeze({ pieceGroups, buildClosedRing, splitSleeve, sleeveRef, quickRef, cutStatus, cutSig, makeParts, partCurrent, symOf, liveLine, ON_TOL, RING_EPS,
    boundarySleeve, boundaryStatus, makeBoundaryPreview, previewCurrent });
})();
