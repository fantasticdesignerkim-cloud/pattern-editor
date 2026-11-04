// ══════════════════════════════════════════════
// designResult.js — Design 형상 통합 결과(몸판+소매+카라를 묶은 형상 패키지).
//
// ★ 이건 형상 패키지일 뿐 **아직 재단 패턴이 아니다**. 다음 파트명·수량·식서·시접·너치(재단) 단계는
//   오직 현재 유효한 designResult.hash 에 고정한다.
//
// 다운스트림 재현성 감사(읽기 전용) 결과 반영:
//   · 세 frozen result 는 앞·뒤 유효 외곽·여밈·소매 외곽/소매산·스탠드/본체 외곽을 이미 담는다.
//   · **`role:"cut"` 절개선은 어떤 result 에도 없다**(working.patternLines 에만) → structuralLines 로 보강.
//     boundary 는 이미 effective outline 에 합성돼 원본 선 중복 저장 불필요.
//   · cut 은 bodiceResult.hash·스테일 판정에도 미포함 → **designResult.hash 가 structuralLines 를 포함**해야
//     cut 변경이 Design 변경으로 잡힌다.
//
// 완료 게이트: 몸판·소매·카라 result 모두 존재·현재 상태 일치 / sleeve·collar 의 sourceBodiceHash===bodice.hash /
//   collar 의 소매 작업 순서 정상 / 유효 cut 이 **최종 몸판**의 effective outline 에서 재검증. idempotent(같은 상태 반복 →
//   기존 참조·completedAt 유지). 완료 후 형상 수정은 기존 결과를 삭제하지 않고 "Design 변경됨" 표시.
//
// ★ 최종 몸판(2026-11-04 김님 승인 — 재단이 읽을 «현재 몸판»): 소매 작업까지 반영한 형상.
//   sleeveResult.derivedBodice(Ⓡ~Ⓩ — 몸판·소매 함께 제도)가 있으면 그것, 없으면 bodiceResult. **복제·새 저장 없음** —
//   finalBodiceOf 가 이미 frozen 인 두 result 중 하나를 그대로 가리킨다(소유권: 원형·bodiceResult·sleeveResult 그대로).
//   sleeveHash 가 derivedBodice 외곽을 이미 담으므로 designResult.hash 가 최종 몸판을 덮는다(별도 참조 필드 없음).
// ★ 절개선 3분류(같은 DLT 판정 · 같은 외곽 유틸): 최종 몸판에서 유효 → structuralLines 포함 /
//   원래 몸판에서는 유효했지만 최종 몸판에서 무효 → **완료 거부**(cut-invalid-on-final-bodice · 사유·선 id 를 cutRejects 로) /
//   둘 다에서 무효 → 작성 중·미완성 선(기존 계약 그대로 제외 · 차단 아님). 자동 회전·이동·삭제·조용한 제외 없음.
//   파생 몸판이 없으면 최종 = 원래 → 이전과 완전히 같다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  function project() { return (window.designWorkflow && window.designWorkflow.current()) || null; }
  function round4(v) { return Math.round(v * 1e4) / 1e4; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function deepFreeze(o) { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); Object.freeze(o); } return o; }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }

  // cut 정준(순서 무관): piece + 좌표 반올림 문자열, 정렬.
  function canonCuts(cuts) {
    return (cuts || []).map(function (c) {
      var segs = (c.segments || []).map(function (s) {
        if (s.kind === "cubic") return "C" + [s.from.x, s.from.y, s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.to.x, s.to.y].map(round4).join(",");
        return "L" + [s.from.x, s.from.y, s.to.x, s.to.y].map(round4).join(",");
      }).join("|");
      return c.piece + ":" + segs;
    }).sort();
  }
  function signatureOf(res) {
    return JSON.stringify({ bh: res.bodiceHash, sh: res.sleeveHash, ch: res.collarHash, cuts: canonCuts(res.structuralLines.cut) });
  }

  // ── 최종 몸판 조회(공용 경계 · 순수) ── src = 결과 묶음({ bodice, sleeve }) — designResult 완료본이나 check 의 중간값.
  //   { source: "sleeve-derived" | "bodice", front, back } — front/back 은 frozen result 의 조각 그대로(복제 아님). 몸판 없으면 null.
  function finalBodiceOf(src) {
    var b = src && src.bodice, s = src && src.sleeve, d = s && s.derivedBodice;
    if (d && d.front && d.back) return { source: "sleeve-derived", front: d.front, back: d.back };
    if (b) return { source: "bodice", front: b.front, back: b.back };
    return null;
  }
  // 절개선 분류: 최종 몸판 유효 목록(gatherValidCuts 그대로) + 원래 몸판에서만 유효한 선의 거부 사유(같은 validateCut · 같은 외곽 평탄화).
  function classifyCuts(DLT, patternLines, bodice, fin) {
    if (!DLT.gatherValidCuts || !bodice || !fin) return { cuts: [], rejects: [] };
    if (fin.source === "bodice") return { cuts: DLT.gatherValidCuts(patternLines, bodice), rejects: [] };   // 파생 없음 = 이전과 똑같은 호출(frozen bodiceResult)
    var cuts = DLT.gatherValidCuts(patternLines, fin);
    var onFinal = {}, onOrig = {};
    canonCuts(cuts).forEach(function (k) { onFinal[k] = true; });
    canonCuts(DLT.gatherValidCuts(patternLines, bodice)).forEach(function (k) { onOrig[k] = true; });   // 원래 몸판 기준(이전 계약과 같은 판정)
    var rejects = [], src = Array.isArray(patternLines) ? patternLines : [];
    ["front", "back"].forEach(function (piece) {
      var mine = src.filter(function (l) { return l && l.piece === piece && l.role === "cut"; });
      mine.forEach(function (line) {
        var key = canonCuts([{ piece: piece, segments: line.segments }])[0];
        if (onFinal[key]) return;
        if (!onOrig[key]) return;   // 원래 몸판에서도 무효 = 작성 중·미완성(기존 계약 그대로 제외)
        var outlineFlat = DLT.flattenLine(DLT.outlinePrimsToSegs(fin[piece].outline));
        var others = mine.filter(function (l) { return l !== line; }).map(function (l) { return DLT.flattenLine(l.segments); });
        var v = DLT.validateCut(line, outlineFlat, others);
        rejects.push({ piece: piece, lineId: line.id != null ? line.id : null, reason: v && !v.ok ? v.reason : "최종 몸판에서 무효" });
      });
    });
    return { cuts: cuts, rejects: rejects };
  }

  // ── 검사 ──
  function check(proj) {
    proj = proj || project();
    if (!proj) return { ok: false, fails: ["no-project"] };
    var BC = window.bodiceCheckpoint, SC = window.sleeveCheckpoint, CC = window.collarCheckpoint, DLT = window.designLineTool;
    if (!BC || !SC || !CC || !DLT) return { ok: false, fails: ["no-module"] };
    var fails = [];
    var bodice = BC.latest(proj), sleeve = SC.latest(proj), collar = CC.latest(proj);
    if (!bodice) fails.push("no-bodice"); else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-changed");
    if (!sleeve) fails.push("no-sleeve"); else { if (SC.isCurrentSleeveChanged(proj)) fails.push("sleeve-changed"); if (SC.invalidatedByBodice(proj)) fails.push("sleeve-bodice-mismatch"); }
    if (!collar) fails.push("no-collar"); else { if (CC.isCurrentCollarChanged(proj)) fails.push("collar-changed"); if (CC.invalidatedByBodice(proj)) fails.push("collar-bodice-mismatch"); if (CC.sleeveStepChanged(proj)) fails.push("collar-sleeve-order"); }
    if (sleeve && bodice && sleeve.sourceBodiceHash !== bodice.hash) fails.push("sleeve-source-mismatch");
    if (collar && bodice && collar.sourceBodiceHash !== bodice.hash) fails.push("collar-source-mismatch");
    // 유효 cut: **최종 몸판(frozen — 소매 파생 몸판 또는 bodiceResult)의 effective outline 기준** 재검증.
    //   mutable working outline 이 아니라 frozen 형상을 명시 전달 → 완료 후 표류로부터 격리. 거부 분류는 위 classifyCuts.
    var fin = finalBodiceOf({ bodice: bodice, sleeve: sleeve });
    var cc = classifyCuts(DLT, proj.working.patternLines, bodice, fin);
    if (cc.rejects.length) fails.push("cut-invalid-on-final-bodice");
    return { ok: fails.length === 0, fails: fails, _bodice: bodice, _sleeve: sleeve, _collar: collar, _cuts: cc.cuts, _finalBodice: fin, cutRejects: cc.rejects };
  }

  // ── 완료 ── 게이트 통과 시 working.designResult 불변 스냅샷. 실패 시 변경 없음. 같은 상태 반복은 idempotent.
  function complete(proj) {
    proj = proj || project();
    if (!proj) return { ok: false, reason: "no-project" };
    var c = check(proj);
    if (!c.ok) return { ok: false, reason: c.fails[0], check: c };
    var sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      bodiceHash: c._bodice.hash, sleeveHash: c._sleeve.hash, collarHash: c._collar.hash,
      bodice: c._bodice, sleeve: c._sleeve, collar: c._collar,   // 이미 deep-frozen → 안전하게 참조
      structuralLines: { cut: c._cuts.map(function (cut) { return { piece: cut.piece, segments: clone(cut.segments) }; }) }
      // ★ 전역 symmetry 필드 없음: 조각마다 접힘이 다르다(앞여밈 몸판=비대칭, 뒤판=CB fold, 소매=1피스,
      //   스탠드·칼라 본체=CB fold 반패턴). 파트별 접힘·수량은 다음 재단 단계에서 결정. 하위 collarResult.symmetry 는 유지.
    };
    result.hash = hashStr(signatureOf(result));
    var existing = proj.working.designResult;
    if (existing && existing.hash === result.hash) return { ok: true, result: existing, idempotent: true, check: c };   // 같은 상태 → 기존 참조·completedAt 유지
    result.completedAt = Date.now();
    // structuralLines·최상위만 동결(하위 result 는 이미 frozen).
    deepFreeze(result.structuralLines); deepFreeze(result.sourceBlock); Object.freeze(result);
    proj.working.designResult = result;
    return { ok: true, result: result, check: c };
  }

  function latest(proj) { proj = proj || project(); return (proj && proj.working.designResult) || null; }
  // 완료본 없음/현재 무효(어느 하위 변경·cut 변경) → true. 있으면 현재 signature 비교.
  function isCurrentDesignChanged(proj) {
    proj = proj || project(); if (!proj) return false;
    var res = proj.working.designResult; if (!res) return true;
    var c = check(proj); if (!c.ok) return true;
    var cur = { bodiceHash: c._bodice.hash, sleeveHash: c._sleeve.hash, collarHash: c._collar.hash, structuralLines: { cut: c._cuts } };
    return hashStr(signatureOf(cur)) !== res.hash;
  }

  window.designResult = Object.freeze({ check: check, complete: complete, latest: latest, isCurrentDesignChanged: isCurrentDesignChanged, finalBodiceOf: finalBodiceOf });
})();
