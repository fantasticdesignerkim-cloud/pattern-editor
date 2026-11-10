// ══════════════════════════════════════════════
// designCuff.js — 소매 Ⓐ 커프스(한 장 접기) + 소맷부리 트임 ④ 덧단(뾰족단) 제도. 순수 함수 · DOM·storage·전역 상태 미접근.
//
// 근거: [패턴학교] P.91 «소맷부리 트임의 종류» ④ 덧단 + Point «커프스 다는 방법 2종»(방법 A) · P.8 참고 치수(손목 16).
// 김님 확정(2026-11-10, docs/SHIRT-ONE-GARMENT.md §6):
//   · 커프스 가로 = 손목 둘레 + 여밈량(2) + 여유량(2) — 세 값은 서로 독립 입력(각각 수정 가능).
//   · 잠근 둘레 = 손목 + 여유(여밈 제외) · 여밈 = 겹치는 부분(몸 둘레 여유가 아니다).
//   · 커프스 완성 폭 3 · 한 장 접기(펼친 폭 = 2 × 완성 폭 · 시접 별도 없음).
//   · 소매 달림 = 여밈까지 붙임(P.91 방법 A) → 달림선 = 커프스 가로 전체.
//   · 소맷부리 = 셔링(턱 아님). 셔링 분량 = 실제 소맷부리 봉제 길이 − 실제 커프스 달림 길이(고정값 재사용 없음).
//   · 입력 소매길이 = 커프스 포함 완성 길이 → 소매 본체 = 입력 − 커프스 완성 폭.
//   · 트임 = ④ 덧단, 길이 10 = 책 기본값(수정 가능) · 덧단 완성 폭 2 · 뾰족 끝 1(책 도해 값, 수정 가능).
//   · 트임 위치 = 소맷부리 위 «소매 중심선 → 뒤 옆선» 구간의 1/2.
// 해석(I, 책에 숫자 없음 — 표시에 그대로 밝힌다):
//   · 덧단은 트임 위치선에서 소매 중심 쪽으로 놓인다(④ 도해: 덧단이 트임선의 중심선 쪽).
//   · 가위집 끝(실제로 자르는 끝)은 책에 표기가 없다 — 그리지 않는다. 10 은 소맷부리 → 덧단 뾰족 끝.
//   · 가위집 트임이라 천이 빠지지 않으므로 소맷부리 봉제 길이는 Ⓐ 소맷부리 실측 그대로.
// 범위 밖: 덧단·바이어스 재단 조각(책에 재단 치수 없음 → 만들지 않음) · 시접 · 너치 · 단추 · 곡선 소맷부리(Ⓐ 직선만).
// 모순 입력은 자동으로 늘리거나 줄이지 않고 사유와 함께 거부한다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var SOURCE = Object.freeze({ book: "패턴학교", page: 91, method: "placket-pointed(④)", attachMethod: "A", wristReferencePage: 8 });
  var DEFAULTS = Object.freeze({
    wristCm: 16,            // P.8 참고 치수(사용자 실측 아님)
    overlapCm: 2, easeCm: 2, widthCm: 3,
    construction: "fold-one",          // 한 장 접기(확정)
    attach: "with-overlap",            // 여밈까지 소매를 붙임(P.91 방법 A, 확정)
    includeInSleeveLength: true,       // 입력 소매길이 = 커프스 포함(확정)
    vent: Object.freeze({ type: "placket-pointed", lengthCm: 10, placketWidthCm: 2, tipCm: 1, position: "back-half-mid" })
  });
  // 레이아웃: 커프스 조각을 소매 좌표에서 소맷부리 아래 이 거리(cm)에 둔다(표시 전용 — 조각 geometry 는 자체 좌표).
  var DISPLAY_GAP_CM = 12;
  var TEXT = {
    "invalid-wrist": "손목 둘레는 0보다 커야 합니다",
    "invalid-overlap": "여밈량은 0보다 커야 합니다",
    "invalid-ease": "여유량은 0 이상이어야 합니다",
    "invalid-width": "커프스 완성 폭은 0보다 커야 합니다",
    "invalid-vent-length": "트임 길이는 0보다 커야 합니다",
    "invalid-placket-width": "덧단 폭은 0보다 커야 합니다",
    "invalid-tip": "뾰족 끝 높이는 0 이상이고 트임 길이보다 작아야 합니다",
    "unsupported-construction": "커프스 구성은 한 장 접기만 지원합니다(확정 사양)",
    "unsupported-attach": "소매 달림은 여밈까지 붙이는 방식(P.91 방법 A)만 지원합니다(확정 사양)",
    "unsupported-length-mode": "소매길이는 커프스 포함 길이만 지원합니다(확정 사양)",
    "unsupported-vent": "트임은 ④ 덧단(소매 중심→뒤 옆선 1/2 위치)만 지원합니다(확정 사양)",
    "body-length-nonpositive": "소매길이가 커프스 완성 폭보다 커야 합니다",
    "hem-not-straight": "커프스는 소매 Ⓐ 의 직선 소맷부리에서만 제도합니다",
    "no-shirring": "소맷부리 봉제 길이가 커프스 달림 길이보다 길지 않아 셔링 분량이 없습니다",
    "vent-too-long": "트임 길이가 소맷부리에서 위팔선까지보다 깁니다",
    "placket-crosses-center": "덧단이 소매 중심선을 넘습니다(트임 위치·덧단 폭 확인)"
  };
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function P(x, y) { return { x: x, y: y }; }
  function L(a, b, role) { return { kind: "line", from: P(a.x, a.y), to: P(b.x, b.y), role: role }; }
  function fail(reason, detail) { return { ok: false, reason: reason, text: TEXT[reason] || reason, detail: detail == null ? null : detail }; }

  function defaults() { return clone(DEFAULTS); }

  // 입력 정규화 없이 검사만 한다(빈 값·범위 밖을 기본값으로 바꾸지 않는다).
  function validate(cuff) {
    if (!cuff || typeof cuff !== "object") return fail("invalid-wrist");
    if (!fin(cuff.wristCm) || !(cuff.wristCm > 0)) return fail("invalid-wrist", cuff.wristCm);
    if (!fin(cuff.overlapCm) || !(cuff.overlapCm > 0)) return fail("invalid-overlap", cuff.overlapCm);
    if (!fin(cuff.easeCm) || !(cuff.easeCm >= 0)) return fail("invalid-ease", cuff.easeCm);
    if (!fin(cuff.widthCm) || !(cuff.widthCm > 0)) return fail("invalid-width", cuff.widthCm);
    if (cuff.construction !== "fold-one") return fail("unsupported-construction", cuff.construction);
    if (cuff.attach !== "with-overlap") return fail("unsupported-attach", cuff.attach);
    if (cuff.includeInSleeveLength !== true) return fail("unsupported-length-mode", cuff.includeInSleeveLength);
    var v = cuff.vent;
    if (!v || v.type !== "placket-pointed" || v.position !== "back-half-mid") return fail("unsupported-vent", v && v.type);
    if (!fin(v.lengthCm) || !(v.lengthCm > 0)) return fail("invalid-vent-length", v.lengthCm);
    if (!fin(v.placketWidthCm) || !(v.placketWidthCm > 0)) return fail("invalid-placket-width", v.placketWidthCm);
    if (!fin(v.tipCm) || !(v.tipCm >= 0) || !(v.tipCm < v.lengthCm)) return fail("invalid-tip", v.tipCm);
    return { ok: true };
  }

  // 입력 소매길이(커프스 포함) → 소매 본체 제도 길이. 검사 실패면 null.
  function bodyLengthOf(sleeveLengthCm, cuff) {
    if (!fin(sleeveLengthCm) || !cuff || !fin(cuff.widthCm)) return null;
    var b = sleeveLengthCm - cuff.widthCm;
    return b > 0 ? b : null;
  }

  // 커프스 조각(자체 좌표, cm): x 0..가로 · y 0..펼친 폭. y=0 = 소매 달림 가장자리(겉 커프스) · y=완성 폭 = 접는선 · 위 끝 = 안 커프스.
  //   여밈 구간 = 오른쪽 끝 여밈량(P.91 도해의 여밈분 위치).
  function cuffPiece(cuff) {
    var len = cuff.wristCm + cuff.overlapCm + cuff.easeCm, w = cuff.widthCm, open = 2 * w, xo = len - cuff.overlapCm;
    var a = P(0, 0), b = P(len, 0), c = P(len, open), d = P(0, open);
    return {
      outline: [L(a, b, "attach-edge"), L(b, c, "end-overlap"), L(c, d, "outer-edge"), L(d, a, "end-plain")],
      construction: [L(P(0, w), P(len, w), "fold-line"), L(P(xo, 0), P(xo, open), "overlap-line")],
      size: { lengthCm: len, openWidthCm: open, finishedWidthCm: w, overlapStartCm: xo }
    };
  }

  // 소매 Ⓐ geometry(읽기 전용) + 커프스 입력 → { ok, piece, vent, lengths, source, inputs } | fail.
  //   sleeveGeom.outline = [cap, 뒤 옆선(Ub→뒤 소맷부리), 앞 옆선(Uf→앞 소맷부리), 소맷부리(뒤→앞)] — designSleeveA 구조.
  function draft(sleeveGeom, cuff) {
    var v0 = validate(cuff); if (!v0.ok) return v0;
    var o = sleeveGeom && sleeveGeom.outline;
    var hem = o && o[3], sb = o && o[1], sf = o && o[2];
    if (!hem || hem.kind !== "line" || !sb || sb.kind !== "line" || !sf || sf.kind !== "line" || Math.abs(hem.from.y - hem.to.y) > 1e-9) return fail("hem-not-straight");
    var hemY = hem.from.y, back = hem.from, front = hem.to;   // 뒤 → 앞
    var hemCm = Math.hypot(front.x - back.x, front.y - back.y);
    var piece = cuffPiece(cuff), cuffLen = piece.size.lengthCm;
    var closedCm = cuff.wristCm + cuff.easeCm;                 // 잠근 둘레(여밈 제외)
    var attachCm = cuffLen;                                    // 방법 A: 여밈까지 소매를 붙인다
    var shirringCm = hemCm - attachCm;
    if (!(shirringCm > 1e-9)) return fail("no-shirring", { hemCm: hemCm, attachCm: attachCm });
    // 트임: 소맷부리 위 «소매 중심선(x=0) → 뒤 옆선(뒤 소맷부리 점)» 의 1/2.
    var vent = cuff.vent, ventX = back.x / 2, toCenter = ventX < 0 ? 1 : -1;
    var underarmY = sb.from.y;   // 위팔선(뒤 아랫점) 높이
    if (!(vent.lengthCm < hemY - underarmY)) return fail("vent-too-long", { lengthCm: vent.lengthCm, availableCm: hemY - underarmY });
    if (!(vent.placketWidthCm < Math.abs(ventX))) return fail("placket-crosses-center", { placketWidthCm: vent.placketWidthCm, toCenterCm: Math.abs(ventX) });
    var xw = ventX + toCenter * vent.placketWidthCm, xm = ventX + toCenter * vent.placketWidthCm / 2;
    var top = hemY - vent.lengthCm, shoulder = top + vent.tipCm;
    var placket = [L(P(ventX, hemY), P(ventX, shoulder), "placket-edge-vent"), L(P(ventX, shoulder), P(xm, top), "placket-tip"),
      L(P(xm, top), P(xw, shoulder), "placket-tip"), L(P(xw, shoulder), P(xw, hemY), "placket-edge-center")];
    return {
      ok: true,
      source: clone(SOURCE),
      inputs: clone(cuff),
      piece: { outline: piece.outline, construction: piece.construction, size: piece.size },
      vent: {
        at: P(ventX, hemY), toCenter: toCenter, placket: placket,
        lengthCm: vent.lengthCm, placketWidthCm: vent.placketWidthCm, tipCm: vent.tipCm,
        position: { fromCenterCm: Math.abs(ventX), backHalfCm: Math.abs(back.x), ratio: 0.5 },
        slitEnd: null   // 가위집 끝: 책 표기 없음
      },
      lengths: {
        cuffLengthCm: cuffLen, closedCircumferenceCm: closedCm, overlapCm: cuff.overlapCm, easeCm: cuff.easeCm,
        attachLengthCm: attachCm, sleeveHemCm: hemCm, shirringCm: shirringCm,
        finishedWidthCm: cuff.widthCm, openWidthCm: piece.size.openWidthCm
      }
    };
  }

  // 표시 배치(소매 좌표): 커프스를 소맷부리 아래 가운데에. 표시 전용.
  //   gapCm(선택): 소매 제작 정보 글자가 소맷부리 아래로 내려오는 만큼(화면 배율에 따라 달라짐) 더 띄울 때 — 최소 DISPLAY_GAP_CM.
  function displayOffset(sleeveGeom, result, gapCm) {
    var hem = sleeveGeom && sleeveGeom.outline && sleeveGeom.outline[3];
    if (!hem || !result || !result.ok) return null;
    var gap = fin(gapCm) && gapCm > DISPLAY_GAP_CM ? gapCm : DISPLAY_GAP_CM;
    return { dx: -result.lengths.cuffLengthCm / 2, dy: hem.from.y + gap };
  }
  function displayBBox(sleeveGeom, result) {
    var off = displayOffset(sleeveGeom, result); if (!off) return null;
    return { minX: off.dx, minY: off.dy, maxX: off.dx + result.lengths.cuffLengthCm, maxY: off.dy + result.lengths.openWidthCm };
  }

  window.designCuff = Object.freeze({ SOURCE: SOURCE, DEFAULTS: DEFAULTS, DISPLAY_GAP_CM: DISPLAY_GAP_CM, TEXT: TEXT,
    defaults: defaults, validate: validate, bodyLengthOf: bodyLengthOf, cuffPiece: cuffPiece, draft: draft,
    displayOffset: displayOffset, displayBBox: displayBBox });
})();
