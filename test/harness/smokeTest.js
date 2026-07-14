const { createEngine } = require("./loadEngine");

const { engine, B, W, BL } = createEngine();
const d = engine.createDraft(B, W, BL);
console.log("pts.E:", d.pts.E, "pts.BP:", d.pts.BP);

const back = engine.buildBackOutline(d.pts, d.formula, B);
console.log("buildBackOutline segs:", back.length, back.slice(0, 3).map(s => s.type));

const front = engine.buildFrontOutline(d.pts, d.formula, B);
console.log("buildFrontOutline segs:", front.length, front.slice(0, 3).map(s => s.type));

console.log("MIN_DART_ANGLE_RAD:", engine.MIN_DART_ANGLE_RAD, "DART_BUDGET_TOL:", engine.DART_BUDGET_TOL);
console.log("OK");
