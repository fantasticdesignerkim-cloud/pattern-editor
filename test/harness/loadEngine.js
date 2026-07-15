// ══════════════════════════════════════════════
// 헤드리스 엔진 로더 — js/draft.js, js/state.js, js/dartMove.js를
// 브라우저 없이 Node vm 컨텍스트에서 그대로 실행해 내부 함수를 직접 호출한다.
//
// 목적: 코드를 재구현(reimplement)하지 않고 실제 프로덕션 함수를 그대로 구동해
// 회귀 테스트한다. DOM은 이 세 파일이 로드/호출 시 건드리는 최소한만 스텁한다.
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const JS_DIR = path.join(__dirname, "..", "..", "js");

function makeEl(overrides = {}) {
  return Object.assign(
    {
      value: "",
      textContent: "",
      style: {},
      disabled: false,
      classList: { toggle() {}, add() {}, remove() {} },
      closest() { return null; },
      addEventListener() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; },
      appendChild() {},
      setAttribute() {},
    },
    overrides
  );
}

// inpB/inpW/inpBL/inpDart 기본값: 프로젝트 참조 치수(B=83, W=64, BL=38) — CLAUDE.md 기준.
function createDomStub(inputValues) {
  const elements = {};
  function getElementById(id) {
    if (id === "cv") {
      if (!elements.cv) elements.cv = makeEl();
      return elements.cv;
    }
    if (Object.prototype.hasOwnProperty.call(inputValues, id)) {
      if (!elements[id]) elements[id] = makeEl({ value: String(inputValues[id]) });
      return elements[id];
    }
    // 버튼/힌트 등 UI 전용 요소: 실제 코드가 전부 `if (el)`로 가드하므로 undefined로 충분.
    return undefined;
  }
  return {
    getElementById,
    createElementNS(_ns, tag) { return makeEl({ tagName: tag }); },
    createElement(tag) { return makeEl({ tagName: tag }); },
  };
}

/**
 * 새 헤드리스 엔진 인스턴스를 만든다. 인스턴스마다 독립된 vm 컨텍스트를 가지므로
 * 여러 스트레스 런을 병렬 개념으로(실제로는 순차) 서로 오염 없이 돌릴 수 있다.
 *
 * @param {{B?:number, W?:number, BL?:number, dart?:number, debug?:boolean}} opts
 */
function createEngine(opts = {}) {
  const B = opts.B ?? 83, W = opts.W ?? 64, BL = opts.BL ?? 38;
  const inputValues = { inpB: B, inpW: W, inpBL: BL, inpDart: opts.dart ?? 12.5 };

  const consoleCapture = { logs: [], warnings: [] };
  const sandbox = {
    document: createDomStub(inputValues),
    window: {},
    console: {
      log(...a) { consoleCapture.logs.push(a); },
      warn(...a) { consoleCapture.warnings.push(a); },
      error(...a) { consoleCapture.warnings.push(a); },
    },
    DEBUG_DART_MOVE: !!opts.debug,
    DEBUG_COLORS: false,
    setTimeout, clearTimeout,
    Math, JSON, Object, Array, Infinity, NaN,
    // dartMove.js가 UI 갱신 시 호출하는 전역 render() — 헤드리스에서는 no-op.
    render() {},
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);

  for (const file of ["draft.js", "state.js", "dartMove.js"]) {
    const code = fs.readFileSync(path.join(JS_DIR, file), "utf8");
    new vm.Script(code, { filename: file }).runInContext(context);
  }

  // 컨텍스트 안의 함수/상수를 밖으로 꺼낸다 (재구현 없이 실제 바인딩 참조만 전달).
  const exportScript = `
    globalThis.__ENGINE__ = {
      dartMoveState, MIN_DART_ANGLE_RAD, DART_BUDGET_TOL, EPS_CLOSED_DART,
      createDraft,
      buildFrontOutline, buildBackOutline,
      getFrontTargetOutline, getBackTargetOutline,
      splitFrontOutline, splitBackOutline, splitBakedOutline,
      findCutPoint, findCutPointBack,
      isClickableSeg, isBakedBoundarySeg, isDartLegType,
      choosePhysicalCloseAngle, chooseSignedBaseAngle, prepareDartMoveCandidate,
      evaluateEndpoint,
      findMaxSafeAngle, budgetMaxAngle, applyTimeSafeAngle,
      bakeFromSplitPieces, normalizeBakedSegments,
      findRotationCollisions, findSelfIntersections, sumOpenDartAngle,
      calcFrontBaseDartAngle, calcBackBaseDartAngle, buildBackShoulderDartInfo,
      applyDartMove, resetDartMove,
      polygonArea,
    };
  `;
  new vm.Script(exportScript, { filename: "export.js" }).runInContext(context);

  const engine = sandbox.__ENGINE__;
  return { engine, B, W, BL, consoleCapture, context };
}

module.exports = { createEngine };
