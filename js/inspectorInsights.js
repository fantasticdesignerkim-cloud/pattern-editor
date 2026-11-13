// inspector 이세 배지 · 계산 노트 · 원형/디자인 비교(읽기 전용 · UI 전용 · 2026-11-12 apple-light-ui).
// ── 원칙: 새 제도 계산을 하지 않는다. 앱이 이미 계산해 화면에 쓴 글자만 읽어 다시 보여 준다.
//    · 소매 이세 = SVG 이세 카드(js/sleeve.js cardRows: 뒤/앞 암홀 · 이세 · 총 이세)
//    · 계산 노트 = 하단 상태줄 #sb(js/sleeve.js updateStatusBar 문자열)
//    · 원형/디자인 비교 = designSleeve.referenceSilhouette(원형 소매 기준값 — ui.js refSleeveVals 와 같은 호출) vs 입력칸 값
// ── 판정 기준(조정 가능한 기본값 — 아래 상수만 바꾸면 된다):
//    · 이세 < 0 = «부족»: js/sleeve.js 이세 카드가 음수를 빨강(warn: ease < 0)으로 표시하는 기존 규칙과 같다.
//    · 목표 이세 = AH × 5%, |총 이세 − 목표| ≥ 1cm = «확인»: js/designSleeveA.js(소매 Ⓐ) 의 «목표 이세 = (앞AH+뒤AH)×5%»와
//      ease-adjust-ge-1cm 경고(«책: 1cm 이상이면 치수 오측정 가능»)를 원형 화면에 **참고로** 빌려 쓴 것이다(원형 규칙으로 확정된 값 아님).
(function () {
  "use strict";
  const EASE_TARGET_RATIO = 0.05;   // designSleeveA.js 목표 이세 비율(소매 Ⓐ)
  const EASE_DELTA_WARN = 1;        // designSleeveA.js ease-adjust-ge-1cm
  const $ = id => document.getElementById(id);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = t => { const m = String(t || "").match(/[-+]?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  const sg = v => (v >= 0 ? "+" : "") + v.toFixed(2);

  function stage() { return document.documentElement.dataset.workspaceStage || "draft"; }

  // SVG 이세 카드 읽기: 라벨 → {값, 이세}
  function readEaseCard() {
    const card = document.querySelector("#cv .ease-card"); if (!card) return null;
    const out = {};
    card.querySelectorAll(".ease-card-label").forEach(l => {
      const y = l.getAttribute("y"), row = { val: null, ease: null };
      card.querySelectorAll('text[y="' + y + '"]').forEach(t => {
        if (t.classList.contains("ease-card-val")) row.val = t.textContent;
        if (t.classList.contains("ease-card-ease")) row.ease = t.textContent;
      });
      out[l.textContent.trim()] = row;
    });
    return out;
  }
  // 상태줄 읽기(문자열 그대로 · 실패한 항목은 생략)
  function readStatus() {
    const t = ($("sb") || {}).textContent || "", r = {};
    let m;
    if ((m = t.match(/뒤진동=([\d.]+)cm 앞진동=([\d.]+)cm 합계=([\d.]+)cm/))) r.ah = { back: m[1], front: m[2], sum: m[3] };
    if ((m = t.match(/앞어깨=([\d.]+)cm 뒤어깨=([\d.]+)cm/))) r.sh = { front: m[1], back: m[2] };
    if ((m = t.match(/뒤소매\S*=뒤진동\+1\+α\(([-\d.]+)\)=([-\d.]+)cm/))) r.backT = { alpha: m[1], val: m[2] };
    if ((m = t.match(/소매산 문화식=([\d.]+) 추천식=([\d.]+) 적용\(([^)]+)\)=([\d.]+)([+-][\d.]+)=([\d.]+)cm/))) r.cap = { cul: m[1], rec: m[2], mode: m[3], base: m[4], adj: m[5], fin: m[6] };
    if ((m = t.match(/다트총량=([\d.]+) a=([\d.]+) b=([\d.]+) c=([\d.]+) d=([\d.]+) e=([\d.]+) f=([\d.]+)/))) r.dart = { total: m[1], a: m[2], b: m[3], c: m[4], d: m[5], e: m[6], f: m[7] };
    return r;
  }

  function badge(kind, text) { return '<span class="ax-badge ax-badge-' + kind + '">' + esc(text) + "</span>"; }

  function renderDraft() {
    const box = $("axInsightsDraft"); if (!box) return;
    if (stage() !== "draft") { box.hidden = true; const c = $("axEaseChip"); if (c) c.hidden = true; return; }
    const card = readEaseCard(), st = readStatus();
    let h = "";
    // ── 이세 묶음
    h += '<div class="ax-sec-label">소매산 이세</div><div class="ax-group">';
    const tot = card && card["총 이세"] ? num(card["총 이세"].val) : null;
    if (tot == null) {
      h += '<div class="ax-cell ax-muted">소매가 그려지면(모드 «전체»·«소매») 이세가 표시됩니다</div>';
    } else {
      const back = card["뒤 암홀"] || {}, front = card["앞 암홀"] || {};
      const bE = num(back.ease), fE = num(front.ease);
      const ah = st.ah ? parseFloat(st.ah.sum) : null;
      const target = ah != null ? ah * EASE_TARGET_RATIO : null, delta = target != null ? tot - target : null;
      let kind = "ok", label = "양호";
      if (tot < 0 || (bE != null && bE < 0) || (fE != null && fE < 0)) { kind = "bad"; label = "부족"; }
      else if (delta != null && Math.abs(delta) >= EASE_DELTA_WARN) { kind = "warn"; label = "확인"; }
      h += '<div class="ax-cell ax-row"><span>총 이세</span><span class="ax-val">' + esc(card["총 이세"].val) + " " + badge(kind, label) + "</span></div>";
      h += '<div class="ax-cell ax-row"><span>뒤 암홀 · 이세</span><span class="ax-val">' + esc(back.val || "—") + " · " + esc((back.ease || "").replace("이세 ", "")) + "</span></div>";
      h += '<div class="ax-cell ax-row"><span>앞 암홀 · 이세</span><span class="ax-val">' + esc(front.val || "—") + " · " + esc((front.ease || "").replace("이세 ", "")) + "</span></div>";
      if (target != null) h += '<div class="ax-cell ax-row"><span>참고 목표 (AH × ' + (EASE_TARGET_RATIO * 100) + '%)</span><span class="ax-val">' + target.toFixed(2) + " cm · 차이 " + sg(delta) + "</span></div>";
    }
    h += '</div><div class="ax-foot">판정 기준(조정 가능 기본값): 이세 음수 = 부족(이세 카드 빨강 표시와 같은 규칙) · 총 이세가 AH×' + (EASE_TARGET_RATIO * 100) + "% 에서 " + EASE_DELTA_WARN + "cm 이상 벗어나면 확인(소매 Ⓐ 규칙을 참고로 적용 — 원형 규칙 아님)</div>";
    // ── 계산 노트(상태줄 문자열 그대로)
    if (st.ah || st.cap || st.dart) {
      h += '<div class="ax-sec-label">계산 노트</div><div class="ax-group">';
      if (st.ah) h += '<div class="ax-cell"><div class="ax-k">진동둘레 AH</div><div class="ax-v">뒤 ' + st.ah.back + " + 앞 " + st.ah.front + " = <b>" + st.ah.sum + " cm</b></div></div>";
      if (st.cap) h += '<div class="ax-cell"><div class="ax-k">소매산 높이</div><div class="ax-v">문화식 ' + st.cap.cul + " · 추천식 " + st.cap.rec + "<br>적용(" + esc(st.cap.mode) + ") " + st.cap.base + " " + st.cap.adj + " (보정) = <b>" + st.cap.fin + " cm</b></div></div>";
      if (st.backT) h += '<div class="ax-cell"><div class="ax-k">뒤 소매 목표</div><div class="ax-v">뒤진동 + 1 + α(' + st.backT.alpha + ") = <b>" + st.backT.val + " cm</b></div></div>";
      if (st.sh) h += '<div class="ax-cell"><div class="ax-k">어깨 길이</div><div class="ax-v">앞 ' + st.sh.front + " · 뒤 " + st.sh.back + " cm</div></div>";
      if (st.dart) {
        const d = st.dart;
        h += '<div class="ax-cell"><div class="ax-k">허리 다트 총량 ' + d.total + ' cm 배분</div><div class="ax-dart">' +
          ["a", "b", "c", "d", "e", "f"].map(k => '<div><span>' + k + "</span><b>" + d[k] + "</b></div>").join("") + "</div></div>";
      }
      h += '</div><div class="ax-foot">하단 상태줄에 이미 계산된 값을 그대로 옮겨 적었습니다(새 계산 없음).</div>';
    }
    if (box.innerHTML !== h) box.innerHTML = h;
    box.hidden = false;
    renderChip(card, st);
  }

  // 좁은 화면 시트 머리줄 요약(같은 판정 · 같은 값). 표시 여부는 CSS(≤615px)가 정한다.
  function renderChip(card, st) {
    const chip = $("axEaseChip"); if (!chip) return;
    const tot = card && card["총 이세"] ? num(card["총 이세"].val) : null;
    if (stage() !== "draft" || tot == null) { chip.hidden = true; return; }
    const bE = num((card["뒤 암홀"] || {}).ease), fE = num((card["앞 암홀"] || {}).ease);
    const ah = st.ah ? parseFloat(st.ah.sum) : null, delta = ah != null ? tot - ah * EASE_TARGET_RATIO : null;
    let kind = "ok", label = "양호";
    if (tot < 0 || (bE != null && bE < 0) || (fE != null && fE < 0)) { kind = "bad"; label = "부족"; }
    else if (delta != null && Math.abs(delta) >= EASE_DELTA_WARN) { kind = "warn"; label = "확인"; }
    const h = "이세 " + esc(card["총 이세"].val) + " " + badge(kind, label);
    if (chip.innerHTML !== h) chip.innerHTML = h;
    chip.hidden = false;
  }

  function renderSleeveCompare() {
    const box = $("axSleeveCompare"); if (!box) return;
    const dw = window.designWorkflow, ds = window.designSleeve;
    const project = stage() === "design" && dw && dw.current ? dw.current() : null;
    const ref = project && ds && ds.referenceSilhouette ? ds.referenceSilhouette(project.referenceGeometry && project.referenceGeometry.sleeve) : null;
    if (!ref) { box.hidden = true; return; }
    const rows = [["소매길이", ref.sleeveLengthCm, "inpSleeveLength"], ["소매부리 둘레", ref.cuffCircumferenceCm, "inpSleeveCuff"],
                  ["위팔 둘레", ref.bicepCm, "inpSleeveBicep"], ["소매산 높이", ref.capHeightCm, "inpSleeveCapHeight"]];
    let h = '<div class="ax-sec-label">원형 vs 디자인</div><div class="ax-group"><div class="ax-cell ax-tri ax-head"><span></span><span>원형</span><span>디자인</span></div>';
    rows.forEach(([l, b, id]) => {
      const el = $(id), raw = el ? String(el.value).trim() : "", d = raw === "" ? null : Number(raw);
      // 입력칸은 ui.js fmtL 로 0.1cm 반올림해 채워지므로 같은 자릿수로 비교(반올림 차이를 «다름»으로 보이지 않게)
      const diff = d != null && isFinite(d) && b != null && Math.abs(d - Math.round(b * 10) / 10) > 1e-9;
      h += '<div class="ax-cell ax-tri"><span>' + l + "</span><span>" + (b != null ? b.toFixed(2) : "—") + "</span><span>" +
        (d != null && isFinite(d) ? d.toFixed(2) : "—") + (diff ? " " + badge("warn", "다름") : "") + "</span></div>";
    });
    h += '</div><div class="ax-foot">원형 = 완료 원형 소매에서 파생한 기준값(«원형 소매로» 버튼과 같은 값) · 디자인 = 위 입력칸 값(적용 전 입력 포함) · 입력칸이 0.1cm 단위라 0.1cm 반올림으로 비교</div>';
    if (box.innerHTML !== h) box.innerHTML = h;
    box.hidden = false;
  }

  // ── 입력칸 범위 안내(읽기 전용): 코드에 이미 있는 범위만 보여 준다(새 수치 없음).
  //    · 입력칸의 min·max 속성(index.html)이 **둘 다** 있을 때만 «입력 범위 a–b»
  //    · B 가슴둘레: js/sleeve.js getSleeveAlpha 주석의 «문화식 표 기준 77~84 … 100~104» = 뒤소매 α 표가 다루는 범위(권장 범위가 아님)
  //    · 그 밖(W·BL·소매길이·소매단둘레·다트 총량 등 범위가 코드에 없는 칸)은 아무것도 쓰지 않는다.
  const RANGE_FROM_CODE = { inpB: "뒤소매 α 표 77–104" };
  function addRangeHints() {
    document.querySelectorAll(".inspector .row input[type=number], .inspector .row input[type=range]").forEach(inp => {
      const lab = inp.parentElement && inp.parentElement.querySelector(":scope > label");
      if (!lab || lab.querySelector(".ax-range")) return;
      let t = RANGE_FROM_CODE[inp.id] || null;
      if (!t && inp.hasAttribute("min") && inp.hasAttribute("max")) {
        const fmt = v => String(v).replace("-", "−");
        t = "입력 범위 " + fmt(inp.getAttribute("min")) + " ~ " + fmt(inp.getAttribute("max"));
      }
      if (!t) return;
      const sp = document.createElement("span"); sp.className = "ax-range"; sp.textContent = t;
      lab.appendChild(sp);
    });
  }
  addRangeHints();

  let queued = false;
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; try { renderDraft(); renderSleeveCompare(); } catch (_) {} }); }
  const sb = $("sb");
  if (sb && window.MutationObserver) new MutationObserver(schedule).observe(sb, { childList: true, characterData: true, subtree: true });
  if (window.MutationObserver) new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ["data-workspace-stage"] });
  document.addEventListener("input", e => { if (e.target && /^inpSleeve/.test(e.target.id || "")) schedule(); });
  document.addEventListener("click", schedule, true);
  schedule();
})();
