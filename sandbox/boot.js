// ══════════════════════════════════════════════════════════════════════════════
// sandbox/boot.js — 실험을 시작할 상태까지 한 줄로 데려다 주는 부트스트랩
//
// 왜 있나: 뭘 하나 시험하려 해도 매번 «원형 생성 → 원형 완료 → 디자인 시작 → 몸판 완료 →
//   소매 적용·완료 → 카라 적용·완료» 를 손으로 다시 밟아야 했다. 그 체인을 `SB.*` 한 호출로
//   접는다. **새 계산을 만들지 않는다** — 전부 기존 공개 함수·버튼을 순서대로 부를 뿐이다.
//
// 규칙(docs/SANDBOX.md):
//   · js/ 를 **읽기만** 한다. 여기서 js/ 의 함수를 덮어쓰거나 patch 하지 않는다.
//   · 저장(save/import/autoSave)을 부르지 않는다. **격리 origin(127.0.0.1:8420)에서만** 띄운다.
//   · 골든·하네스 없음. 부서져도 sandbox 만 부서진다.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  const tick = (ms) => new Promise(r => setTimeout(r, ms || 130));
  const el = (id) => document.getElementById(id);
  function click(id) {
    const b = el(id);
    if (!b) throw new Error("sandbox: 버튼 없음 " + id);
    // 비활성 사유는 여럿이다(앞 단계 미완료 / 입력 무효 / 보류 슬롯) — 단정하지 않는다.
    if (b.disabled) throw new Error("sandbox: 버튼 비활성 " + id + " — 조건 미충족(앞 단계·입력·지원 여부 확인)");
    b.click();
  }
  function set(id, v) {
    const e = el(id);
    if (!e) throw new Error("sandbox: 입력 없음 " + id);
    e.value = String(v);
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const project = () => (window.designWorkflow ? window.designWorkflow.current() : null);

  // ── 단계별 부트 (각 단계는 앞 단계를 필요한 만큼만 다시 밟는다) ──

  async function toDraft() {
    if (typeof window.generatePattern !== "function") throw new Error("sandbox: generatePattern 없음");
    window.generatePattern();
    await tick();
    return "원형 생성";
  }
  async function toDesign() {
    if (project()) return "디자인(이미 시작됨)";
    await toDraft();
    click("btnCompleteDraft"); await tick();
    click("btnStartDesign");   await tick();
    return "디자인 시작";
  }
  // 몸판 완료까지. body 에 파라미터를 주면 적용한 뒤 완료한다.
  async function toBodice(body) {
    await toDesign();
    if (body) { await applyBody(body); }
    click("btnCompleteBodice"); await tick();
    return "몸판 완료";
  }
  async function toSleeve(body) {
    await toBodice(body);
    subtab("소매"); await tick();
    click("btnApplySleeve");    await tick();
    click("btnCompleteSleeve"); await tick();
    return "소매 완료";
  }
  async function toCollar(body) {
    await toSleeve(body);
    subtab("카라"); await tick();
    click("btnApplyCollar"); await tick();
    click("btnApplyCollarBody");  await tick();
    click("btnCompleteCollar");   await tick();
    return "카라 완료";
  }
  async function all(body) {
    await toCollar(body);
    click("btnCompleteDesign"); await tick();
    return "Design 형상 완료";
  }

  function subtab(name) {
    const b = Array.from(document.querySelectorAll(".subtab"))
      .find(x => x.textContent.indexOf(name) >= 0);
    if (!b) throw new Error("sandbox: 서브탭 없음 " + name);
    if (b.disabled) throw new Error("sandbox: 서브탭 잠김 " + name + " — 앞 단계 완료 필요");
    b.click();
  }

  // ── 몸판 파라미터를 입력칸에 채우고 적용 ──
  const BODY_INPUT = {
    bustEaseCm: "inpBodyBustEase",
    hemExtensionBelowWaistCm: "inpBodyHemExtension",
    waistSideOffsetCm: "inpBodyWaistOffset",
    hemSideOffsetCm: "inpBodyHemOffset",
    sideSeamCurve: "inpBodySideCurve",
    waistDartTotalCm: "inpBodyWaistDartTotal",
    targetFinishedWaistCm: "inpBodyWaistTarget"
  };
  async function applyBody(body) {
    Object.keys(body || {}).forEach(k => {
      const id = BODY_INPUT[k];
      if (!id) throw new Error("sandbox: 모르는 몸판 파라미터 " + k);
      set(id, body[k]);
    });
    click("btnApplyBodyLength"); await tick();
    return note();
  }
  // 몸판 라인 프리셋(P.14–35) 적용 — 예: SB.line("shaped-line","bunka-bodice-D")
  async function line(familyId, variantId) {
    await toDesign();
    set("selBodiceFamily", familyId); await tick();
    set("selBodicePreset", variantId); await tick();
    click("btnApplyBodicePreset"); await tick();
    return note();
  }

  // ── 읽기 헬퍼 ──
  const note = () => (el("designBodyNote") || {}).textContent || "";
  function girth() {
    const p = project(); if (!p || !window.bodiceCheckpoint) return null;
    const m = window.bodiceCheckpoint.girthMeasure(p);
    return m && { 가슴완성: m.bust.finishedCm, 가슴여유: m.bustEaseCm,
                  허리완성: m.waist.finishedCm, 허리여유: m.waistEaseCm };
  }
  function darts() {
    const p = project(); if (!p) return null;
    const out = {};
    ["front", "back"].forEach(k => {
      (p.working.geometry[k].construction || []).forEach(s => {
        const d = s && s.dart;
        if (!d || d.boundary !== "waist") return;
        (out[d.id] = out[d.id] || []).push(s);
      });
    });
    const mouth = s => (s.dart.apexAt === "to" ? s.from : s.to);
    const apex  = s => (s.dart.apexAt === "to" ? s.to : s.from);
    // ★ 접어재단(onFold)은 다리가 하나다 — 접힘선까지의 **가로 거리**가 반패턴 몫이고,
    //   다리 길이(대각 거리)가 아니다. 대각으로 재면 f 가 25.8 로 나온다(실제 0.4375).
    return Object.fromEntries(Object.entries(out).map(([id, segs]) => [id, +(
      segs.length === 2 ? Math.hypot(mouth(segs[0]).x - mouth(segs[1]).x, mouth(segs[0]).y - mouth(segs[1]).y)
                        : Math.abs(mouth(segs[0]).x - apex(segs[0]).x)
    ).toFixed(4)]));
  }
  // 이 실험이 저장을 건드렸는지 — 0 이어야 정상
  const storageKeys = () => Object.keys(localStorage).length;

  function help() {
    console.log([
      "SB — sandbox 부트스트랩",
      "  await SB.toDraft()   원형 생성",
      "  await SB.toDesign()  디자인 시작까지",
      "  await SB.toBodice({bustEaseCm:8})  몸판 적용+완료까지",
      "  await SB.toSleeve()  소매 완료까지",
      "  await SB.toCollar()  카라 완료까지",
      "  await SB.all()       Design 형상 완료까지",
      "  await SB.applyBody({...})  몸판 파라미터만 적용",
      "  await SB.line('shaped-line','bunka-bodice-D')  라인 프리셋",
      "  SB.girth() / SB.darts() / SB.project() / SB.storageKeys()",
      "  SB.p  = 현재 project (getter)"
    ].join("\n"));
  }

  const SB = { toDraft, toDesign, toBodice, toSleeve, toCollar, all,
               applyBody, line, girth, darts, project, storageKeys, click, set, tick, help };
  Object.defineProperty(SB, "p", { get: project });
  window.SB = SB;
  console.log("sandbox 준비됨 — SB.help()");
})();
