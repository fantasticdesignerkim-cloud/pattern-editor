// ══════════════════════════════════════════════
// 골든 스냅샷 — 다트이동 결과 "형상"을 ε 기반 동등성으로 고정한다.
//
// 왜: 구조 불변식(selfX/breaks/closed=0)만으로는 "물리적으로 안 깨졌다"만 보장하고
// "동작이 안 바뀌었다"는 못 잡는다. 리팩터가 불변식을 지키면서 각도/좌표를 미묘하게
// 바꾸면 불변식 검사는 통과한다. 회귀 고정의 목적은 후자이므로, 각 시나리오의 결과
// 형상을 골든 JSON으로 커밋하고 이후 실행이 ε을 넘게 벗어나면 실패시킨다.
//
// bit-for-bit이 아니라 ε 기반 동등성이다(사용자 확정). dartId/timestamp/난수·임시
// 디버그 필드는 골든에서 제외한다 — 매 실행 달라지는 값이라 회귀 신호가 아니다.
// ══════════════════════════════════════════════
const fs = require("fs");
const path = require("path");

const EPS_COORD = 1e-4; // cm
const EPS_DEG = 0.01;    // 도

// 골든에 담을 세그먼트 필드만 남긴다(dartId/role/pair/timestamp/디버그 필드 제거).
// type/from/to/disabled만 보존(사용자 확정 규칙).
function roundCoord(v) {
  // 1e-4 cm 격자로 반올림. -0을 0으로 정규화(JSON 비교 안정성).
  const r = Math.round(v / EPS_COORD) * EPS_COORD;
  return Object.is(r, -0) ? 0 : +r.toFixed(4);
}
function roundDeg(v) {
  const r = Math.round(v / EPS_DEG) * EPS_DEG;
  return Object.is(r, -0) ? 0 : +r.toFixed(2);
}

function cleanSeg(seg) {
  return {
    type: seg.type,
    from: { x: roundCoord(seg.from.x), y: roundCoord(seg.from.y) },
    to:   { x: roundCoord(seg.to.x),   y: roundCoord(seg.to.y)   },
    disabled: !!seg.disabled,
  };
}

// 폐곡선 시작 인덱스 정규화: 배열이 루프 어디서 시작하든 동일한 정규형을 얻도록,
// "from 좌표가 사전순 최소"인 세그먼트를 시작점으로 회전한다. 순서·방향은 유지
// (역전하지 않음 — 사용자 확정 규칙). 동률이면 to 좌표로, 그래도 동률이면 원래
// 상대순서로 tie-break(퇴화 중복 세그먼트는 애초에 normalize 실패 대상).
function canonicalStartIndex(cleaned) {
  let best = 0;
  const key = (s) => [s.from.x, s.from.y, s.to.x, s.to.y];
  const less = (a, b) => {
    for (let i = 0; i < 4; i++) { if (a[i] !== b[i]) return a[i] < b[i]; }
    return false;
  };
  for (let i = 1; i < cleaned.length; i++) {
    if (less(key(cleaned[i]), key(cleaned[best]))) best = i;
  }
  return best;
}

function canonicalizeSegments(segments) {
  const cleaned = segments.filter(s => s?.from && s?.to).map(cleanSeg);
  if (cleaned.length === 0) return [];
  const start = canonicalStartIndex(cleaned);
  return cleaned.slice(start).concat(cleaned.slice(0, start));
}

// notch를 mouth의 BP(pivot) 극각순으로 정렬(사용자 확정 규칙). notch 하나의 대표
// 극각은 두 mouth 중점의 pivot 기준 atan2. 개수·각도·총합을 별도 필드로 저장한다.
function canonicalizeNotches(notches, pivot) {
  const polar = (n) => {
    const mx = (n.mouthA.x + n.mouthB.x) / 2, my = (n.mouthA.y + n.mouthB.y) / 2;
    return Math.atan2(my - pivot.y, mx - pivot.x);
  };
  const apertureRad = (n) => {
    const v1x = n.mouthA.x - pivot.x, v1y = n.mouthA.y - pivot.y;
    const v2x = n.mouthB.x - pivot.x, v2y = n.mouthB.y - pivot.y;
    return Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
  };
  const sorted = [...notches].sort((a, b) => polar(a) - polar(b));
  const apertureDeg = sorted.map(n => roundDeg(apertureRad(n) * 180 / Math.PI));
  const sumDeg = roundDeg(sorted.reduce((s, n) => s + apertureRad(n), 0) * 180 / Math.PI);
  return { count: sorted.length, apertureDeg, sumDeg };
}

// 하나의 형상 → 골든 스냅샷. budgetRad는 이 옷 전체의 기본 다트각(비교 안정성 위해
// 도 단위 반올림). notches는 {mouthA, mouthB} 배열(dartDriver.listOpenNotches 형식).
function makeSnapshot({ segments, notches, pivot, budgetRad }) {
  return {
    segments: canonicalizeSegments(segments),
    notches: canonicalizeNotches(notches || [], pivot),
    budgetDeg: budgetRad != null ? roundDeg(budgetRad * 180 / Math.PI) : null,
  };
}

// ── ε 기반 비교 ────────────────────────────────
function ptDiff(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }

function diffSnapshot(golden, current) {
  const diffs = [];
  if (!golden) { diffs.push({ kind: "no-golden" }); return diffs; }

  // 세그먼트 수
  if (golden.segments.length !== current.segments.length) {
    diffs.push({ kind: "seg-count", golden: golden.segments.length, current: current.segments.length });
  } else {
    for (let i = 0; i < golden.segments.length; i++) {
      const g = golden.segments[i], c = current.segments[i];
      if (g.type !== c.type) diffs.push({ kind: "seg-type", index: i, golden: g.type, current: c.type });
      if (g.disabled !== c.disabled) diffs.push({ kind: "seg-disabled", index: i, golden: g.disabled, current: c.disabled });
      const df = ptDiff(g.from, c.from), dt = ptDiff(g.to, c.to);
      if (df > EPS_COORD * 1.5 || dt > EPS_COORD * 1.5) {
        diffs.push({ kind: "seg-coord", index: i, type: g.type, fromDelta: +df.toFixed(5), toDelta: +dt.toFixed(5) });
      }
    }
  }

  // notch
  if (golden.notches.count !== current.notches.count) {
    diffs.push({ kind: "notch-count", golden: golden.notches.count, current: current.notches.count });
  } else {
    for (let i = 0; i < golden.notches.apertureDeg.length; i++) {
      const d = Math.abs(golden.notches.apertureDeg[i] - current.notches.apertureDeg[i]);
      if (d > EPS_DEG * 1.5) diffs.push({ kind: "notch-aperture", index: i, golden: golden.notches.apertureDeg[i], current: current.notches.apertureDeg[i] });
    }
  }
  if (Math.abs((golden.notches.sumDeg ?? 0) - (current.notches.sumDeg ?? 0)) > EPS_DEG * 1.5) {
    diffs.push({ kind: "notch-sum", golden: golden.notches.sumDeg, current: current.notches.sumDeg });
  }
  if (golden.budgetDeg != null && current.budgetDeg != null &&
      Math.abs(golden.budgetDeg - current.budgetDeg) > EPS_DEG * 1.5) {
    diffs.push({ kind: "budget", golden: golden.budgetDeg, current: current.budgetDeg });
  }
  return diffs;
}

// ── 골든 파일 세션 ─────────────────────────────
// UPDATE 모드: 스냅샷을 모아 파일에 쓴다. 비교 모드: 로드해서 diff.
// UPDATE는 `--update` 인자 또는 GOLDEN_UPDATE=1 로 켠다.
class GoldenFile {
  constructor(filePath) {
    this.filePath = filePath;
    this.update = process.argv.includes("--update") || process.env.GOLDEN_UPDATE === "1";
    this.data = {};
    if (!this.update && fs.existsSync(filePath)) {
      this.data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } else if (!this.update && !fs.existsSync(filePath)) {
      this.missing = true;
    }
    this._collected = {};
  }
  // name 시나리오의 현재 스냅샷을 골든과 비교(또는 UPDATE면 수집). diff 배열 반환.
  check(name, snapshot) {
    if (this.update) { this._collected[name] = snapshot; return []; }
    if (this.missing) return [{ kind: "no-golden-file", file: this.filePath }];
    return diffSnapshot(this.data[name], snapshot);
  }
  // UPDATE 모드에서만 실제로 파일을 쓴다. 사유(reason)를 함께 헤더로 남긴다.
  save(reason) {
    if (!this.update) return false;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const out = { _meta: { updatedAt: new Date().toISOString(), reason: reason || "(no reason given)" }, ...this._collected };
    fs.writeFileSync(this.filePath, JSON.stringify(out, null, 2) + "\n", "utf8");
    return true;
  }
}

module.exports = {
  EPS_COORD, EPS_DEG,
  makeSnapshot, diffSnapshot, canonicalizeSegments, canonicalizeNotches,
  GoldenFile,
};
