// ── 진동선 데이터 저장/내보내기 ──────────────────
function saveCurveData(){
  if(!state.armH && !state.sleeveH){ alert('저장할 곡선 데이터가 없습니다.'); return; }
  const B  = +document.getElementById('inpB').value;
  const W  = +document.getElementById('inpW').value;
  const BL = +document.getElementById('inpBL').value;
  const H = state.armH; // null일 수 있음
  const entry = {
    timestamp: new Date().toISOString(),
    measurements: { B, W, BL, SL: n("inpSL"), Hem: n("inpHem") },
    capFormula: document.getElementById("selCapFormula")?.value || "culture",
    // armH 없으면 null로 저장
    anchors: H ? {
      a1: { x: +H.a1.x.toFixed(3), y: +H.a1.y.toFixed(3) },
      a2: { x: +H.a2.x.toFixed(3), y: +H.a2.y.toFixed(3) },
      a3: { x: +H.a3.x.toFixed(3), y: +H.a3.y.toFixed(3) },
    } : null,
    handles: H ? {
      h0:  { x: +H.h0.x.toFixed(3),  y: +H.h0.y.toFixed(3)  },
      h1a: { x: +H.h1a.x.toFixed(3), y: +H.h1a.y.toFixed(3) },
      h1b: { x: +H.h1b.x.toFixed(3), y: +H.h1b.y.toFixed(3) },
      h2a: { x: +H.h2a.x.toFixed(3), y: +H.h2a.y.toFixed(3) },
      h2b: { x: +H.h2b.x.toFixed(3), y: +H.h2b.y.toFixed(3) },
      h3a: { x: +H.h3a.x.toFixed(3), y: +H.h3a.y.toFixed(3) },
      h3b: { x: +H.h3b.x.toFixed(3), y: +H.h3b.y.toFixed(3) },
      h4:  { x: +H.h4.x.toFixed(3),  y: +H.h4.y.toFixed(3)  },
    } : null,
    fArmhole: state.fArmH ? {
      hGa: { x: +state.fArmH.hGa.x.toFixed(3), y: +state.fArmH.hGa.y.toFixed(3) },
      hGb: { x: +state.fArmH.hGb.x.toFixed(3), y: +state.fArmH.hGb.y.toFixed(3) },
      hFa: { x: +state.fArmH.hFa.x.toFixed(3), y: +state.fArmH.hFa.y.toFixed(3) },
      hFb: { x: +state.fArmH.hFb.x.toFixed(3), y: +state.fArmH.hFb.y.toFixed(3) },
    } : null,
    bNeckline: state.bNeckH ? {
      h0: { x: +state.bNeckH.h0.x.toFixed(3), y: +state.bNeckH.h0.y.toFixed(3) },
      h1: { x: +state.bNeckH.h1.x.toFixed(3), y: +state.bNeckH.h1.y.toFixed(3) },
    } : null,
    fNeckline: state.fNeckH ? {
      h0: { x: +state.fNeckH.h0.x.toFixed(3), y: +state.fNeckH.h0.y.toFixed(3) },
      h1: { x: +state.fNeckH.h1.x.toFixed(3), y: +state.fNeckH.h1.y.toFixed(3) },
    } : null,
    sleevePattern: state.sleeveH ? {
      anchorCount: state.sleeveH.anchorCount,
      segments: state.sleeveH.segments.map(seg => ({
        c1: { x: +seg.c1.x.toFixed(3), y: +seg.c1.y.toFixed(3) },
        c2: { x: +seg.c2.x.toFixed(3), y: +seg.c2.y.toFixed(3) },
      })),
      anchorOffsets: (state.sleeveH.anchorOffsets || []).map(o => ({
        dx: +o.dx.toFixed(4), dy: +o.dy.toFixed(4)
      }))
    } : null,
  };
  const key = 'armhole_data';
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  existing.push(entry);
  localStorage.setItem(key, JSON.stringify(existing));
  // 새 키-값 구조에도 저장
  setSavedCurveEntry(entry);
  updateSaveCount();
  alert('저장 완료! B=' + B + ' W=' + W + ' BL=' + BL);
}


function autoSaveCurveData(){
  if(!state.armH && !state.sleeveH) return false;
  const B=n('inpB'), W=n('inpW'), BL=n('inpBL');
  const H = state.armH || {};
  const safePt = p => p ? {x:+p.x.toFixed(3), y:+p.y.toFixed(3)} : null;
  const entry = {
    timestamp: new Date().toISOString(), auto:true,
    measurements: { B, W, BL, SL:n('inpSL'), Hem:n('inpHem') },
    capFormula: document.getElementById('selCapFormula')?.value || 'culture',
    anchors: state.armH ? { a1:safePt(H.a1), a2:safePt(H.a2), a3:safePt(H.a3) } : null,
    handles: state.armH ? { h0:safePt(H.h0), h1a:safePt(H.h1a), h1b:safePt(H.h1b), h2a:safePt(H.h2a), h2b:safePt(H.h2b), h3a:safePt(H.h3a), h3b:safePt(H.h3b), h4:safePt(H.h4) } : null,
    fArmhole: state.fArmH ? { hGa:safePt(state.fArmH.hGa), hGb:safePt(state.fArmH.hGb), hFa:safePt(state.fArmH.hFa), hFb:safePt(state.fArmH.hFb) } : null,
    bNeckline: state.bNeckH ? { h0:safePt(state.bNeckH.h0), h1:safePt(state.bNeckH.h1) } : null,
    fNeckline: state.fNeckH ? { h0:safePt(state.fNeckH.h0), h1:safePt(state.fNeckH.h1) } : null,
    sleevePattern: state.sleeveH ? { anchorCount: state.sleeveH.anchorCount, segments: state.sleeveH.segments.map(seg=>({ c1:safePt(seg.c1), c2:safePt(seg.c2) })), anchorOffsets: (state.sleeveH.anchorOffsets || []).map(o=>({dx:+o.dx.toFixed(4),dy:+o.dy.toFixed(4)})) } : null
  };
  // 키-값 구조에 저장 (치수별 최신 1건만 유지)
  setSavedCurveEntry(entry);
  // 구버전 배열에도 호환성 유지
  const key='armhole_data';
  const data = JSON.parse(localStorage.getItem(key) || '[]');
  for(let i=data.length-1;i>=0;i--){
    if(data[i].auto && measurementMatches(data[i]) && sleeveMeasurementMatches(data[i])){ data[i]=entry; localStorage.setItem(key, JSON.stringify(data)); return true; }
  }
  data.push(entry);
  localStorage.setItem(key, JSON.stringify(data));
  return true;
}
function exportData(){
  const key = 'armhole_data';
  const data = JSON.parse(localStorage.getItem(key) || '[]');
  if(data.length === 0){ alert('저장된 데이터가 없습니다.'); return; }
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'armhole_data_' + new Date().toISOString().slice(0,10) + '.json';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// ── 데이터 가져오기 (exportData()의 역방향) ─────────
// 왜 필요한가: 진동선 앵커/핸들은 **localStorage에만** 있고 git에는 없다. 그래서 PC를
// 옮기면(회사↔집) 같은 치수여도 곡선이 달라져 도안 자체가 달라진다 — CLAUDE.md
// 2026-07-03 #7의 "어쩔 때는 맞고 어쩔 때는 틀리다"가 정확히 이 데이터 차이였다.
// 내보내기만 있고 가져오기가 없어서 그동안 이전 수단이 없었다.
//
// ★ **두 키를 모두 복원한다** — saveCurveData/autoSaveCurveData가 항상 양쪽에 쓰기 때문:
//   - `armhole_data`    : append-only 배열(내보내기 형식). 이력 전체.
//   - `armhole_data_kv` : 치수키(B-W-BL)별 최신 1건. getSavedCurveEntries가 **먼저** 읽고
//                         updateSaveCount가 세는 곳. 여기를 안 채우면 "저장 0건"으로 보인다.
//   kv는 배열에서 재구성한다(같은 치수는 뒤 항목이 이김 — setSavedCurveEntry와 같은 규칙).
//
// 병합 방식(덮어쓰지 않는다): 기존 항목을 지우지 않고 뒤에 붙인다. 같은 치수가 있으면
// kv에서 가져온 쪽이 최신이 된다. 되돌릴 수 없는 삭제를 하지 않는 쪽이 안전하다.
//
// 멱등성: 같은 파일을 두 번 가져와도 결과가 같아야 한다. 예전엔 무조건 뒤에 붙여서
// 'JSON 불러오기'를 두 번 누르면 이력이 조용히 2배가 됐다 — kv는 치수키로 덮어쓰니
// UI 카운트는 그대로라 눈치채기 어려웠다. 회사↔맥을 오갈수록 계속 불어난다.
function importCurveEntries(entries){
  if(!Array.isArray(entries)) throw new Error('배열이 아닙니다 (내보낸 JSON이 맞는지 확인하세요)');
  const valid = entries.filter(e => e && e.measurements &&
    e.measurements.B != null && e.measurements.W != null && e.measurements.BL != null);
  if(valid.length === 0) throw new Error('가져올 항목이 없습니다 (measurements가 있는 항목이 하나도 없음)');

  const key = 'armhole_data';
  const existing = JSON.parse(localStorage.getItem(key) || '[]');

  // 이미 있는 항목은 건너뛴다. 같은 치수·같은 순간이라도 내용이 다르면 남긴다
  // (자동저장 auto:true와 수동저장은 초 단위로 붙어 나오는 별개 항목이다).
  const seen = new Set(existing.map(curveEntryFingerprint));
  const fresh = [];
  for(const e of valid){
    const fp = curveEntryFingerprint(e);
    if(seen.has(fp)) continue;
    seen.add(fp);
    fresh.push(e);
  }
  const merged = existing.concat(fresh);
  localStorage.setItem(key, JSON.stringify(merged));

  // kv는 **새로 들어온 항목으로만** 갱신한다. 전부 중복이면 건드리지 않는다 —
  // 가져온 뒤 편집해서 자동저장된 최신 곡선이 있는데 같은 파일을 다시 가져오면,
  // valid 전체로 덮어쓸 경우 그 최신 작업이 파일의 옛 항목으로 되돌아가 버린다.
  if(fresh.length){
    const kv = JSON.parse(localStorage.getItem('armhole_data_kv') || '{}');
    for(const e of fresh){
      kv[getBodySaveKey(e.measurements.B, e.measurements.W, e.measurements.BL)] = e;
    }
    localStorage.setItem('armhole_data_kv', JSON.stringify(kv));
  }

  updateSaveCount();
  return {
    imported: fresh.length,
    duplicates: valid.length - fresh.length,
    skipped: entries.length - valid.length,
    total: merged.length
  };
}

// 항목 동일성 판정: 키 순서에 무관하게 내용이 **완전히** 같은 항목만 같다고 본다.
// timestamp+measurements로 묶지 않는 이유: 자동저장과 수동저장이 같은 순간에 겹치면
// 서로 다른 항목이 조용히 하나로 합쳐져 데이터가 사라진다. 완전 일치만 거르면
// 걸러지는 항목은 정보량이 0이므로 무엇도 잃지 않는다.
function curveEntryFingerprint(v){
  if(v === null || typeof v !== 'object') return JSON.stringify(v);
  if(Array.isArray(v)) return '[' + v.map(curveEntryFingerprint).join(',') + ']';
  return '{' + Object.keys(v).sort()
    .map(k => JSON.stringify(k) + ':' + curveEntryFingerprint(v[k])).join(',') + '}';
}

function importDataFromFile(input){
  const file = input && input.files && input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      const before = getSavedCurveEntries().length;
      const r = importCurveEntries(parsed);
      let msg = '가져오기 완료!\n' + r.imported + '건 가져옴 (기존 ' + before + '건 → 치수별 '
        + Object.keys(JSON.parse(localStorage.getItem('armhole_data_kv') || '{}')).length + '건)';
      if(r.duplicates > 0) msg += '\n' + r.duplicates + '건은 이미 있는 항목이라 건너뜀';
      if(r.skipped > 0) msg += '\n' + r.skipped + '건은 형식이 맞지 않아 건너뜀';
      // 현재 치수에 해당하는 곡선이 들어왔으면 바로 화면에 반영한다.
      const applied = loadSavedCurveForCurrentMeasurements(false);
      msg += applied ? '\n현재 치수의 곡선을 불러왔습니다.' : '\n현재 치수와 일치하는 곡선은 없습니다.';
      alert(msg);
      if(typeof render === 'function') render();
    } catch(e){
      alert('가져오기 실패: ' + e.message);
    }
    input.value = '';   // 같은 파일을 다시 고를 수 있게 초기화
  };
  reader.onerror = () => { alert('파일을 읽지 못했습니다.'); input.value = ''; };
  reader.readAsText(file);
}

function updateSaveCount(){
  try{
    const kvData = localStorage.getItem('armhole_data_kv');
    const count = kvData ? Object.keys(JSON.parse(kvData)).length : 0;
    const el = document.getElementById('saveCount');
    if(el) el.textContent = '저장 ' + count + '건 (치수별)';
  } catch(e){}
}

// ── 저장 데이터 구조 (키-값 방식으로 개선) ──────────
// 키: "B-W-BL" 형태로 치수별 최신 데이터만 유지
// 기존 배열 방식과 호환성 유지
function getSavedCurveEntries(){
  try{
    // 새 키-값 구조 먼저 확인
    const kvData = localStorage.getItem('armhole_data_kv');
    if(kvData){
      const kv = JSON.parse(kvData);
      return Object.values(kv);
    }
    // 구버전 배열 방식 fallback
    return JSON.parse(localStorage.getItem('armhole_data') || '[]');
  }
  catch(e){ return []; }
}

function getBodySaveKey(B, W, BL){ return `${B}-${W}-${BL}`; }
function getSleeveSaveKey(B, W, BL, SL, capFormula){ return `${B}-${W}-${BL}-${SL}-${capFormula}`; }

function setSavedCurveEntry(entry){
  try{
    const kvData = localStorage.getItem('armhole_data_kv');
    const kv = kvData ? JSON.parse(kvData) : {};
    const key = getBodySaveKey(entry.measurements.B, entry.measurements.W, entry.measurements.BL);
    kv[key] = entry;
    localStorage.setItem('armhole_data_kv', JSON.stringify(kv));
    updateSaveCount();
  } catch(e){}
}
function measurementMatches(entry){
  if(!entry || !entry.measurements) return false;
  const m = entry.measurements;
  const same = (a,b) => Math.abs((+a||0)-(+b||0)) < 0.001;
  // 몸판 암홀 저장값은 소매단둘레와 분리해서 불러온다.
  return same(m.B,n('inpB')) && same(m.W,n('inpW')) && same(m.BL,n('inpBL'));
}
function sleeveMeasurementMatches(entry){
  if(!measurementMatches(entry) || !entry.measurements) return false;
  const m = entry.measurements;
  const same = (a,b) => Math.abs((+a||0)-(+b||0)) < 0.001;
  const mode = document.getElementById("selCapFormula")?.value || "culture";
  return same(m.SL,n('inpSL')) && (!entry.capFormula || entry.capFormula === mode);
}
function applySavedCurveEntry(entry, includeSleeve=true){
  if(!entry) return false;
  if(entry.capFormula){
    const sel = document.getElementById("selCapFormula");
    if(sel) sel.value = entry.capFormula;
  }
  if(entry.handles && entry.anchors){
    state.armH = {
      h0:  entry.handles.h0,
      h1a: entry.handles.h1a, h1b: entry.handles.h1b,
      h2a: entry.handles.h2a, h2b: entry.handles.h2b,
      h3a: entry.handles.h3a, h3b: entry.handles.h3b,
      h4:  entry.handles.h4,
      a1:  entry.anchors.a1,
      a2:  entry.anchors.a2,
      a3:  entry.anchors.a3,
    };
  }
  if(entry.fArmhole)  state.fArmH  = entry.fArmhole;
  if(entry.bNeckline) state.bNeckH = entry.bNeckline;
  if(entry.fNeckline) state.fNeckH = entry.fNeckline;
  if(includeSleeve && entry.sleevePattern) {
    state.sleeveH = {
      anchorCount: entry.sleevePattern.anchorCount,
      segments: entry.sleevePattern.segments.map(seg => ({
        c1: {x:+seg.c1.x, y:+seg.c1.y},
        c2: {x:+seg.c2.x, y:+seg.c2.y},
      })),
      // anchorOffsets 복원 (없으면 0으로 초기화)
      anchorOffsets: entry.sleevePattern.anchorOffsets
        ? entry.sleevePattern.anchorOffsets.map(o => ({dx:+o.dx, dy:+o.dy}))
        : Array(entry.sleevePattern.anchorCount).fill(null).map(()=>({dx:0,dy:0}))
    };
  }
  return true;
}
function findLastSavedForCurrentMeasurements(){
  const data = getSavedCurveEntries();
  for(let i=data.length-1;i>=0;i--){
    if(measurementMatches(data[i])) return data[i];
  }
  return null;
}
function restoreSavedSleevePatternForAnchorCount(anchorCount){
  const data = getSavedCurveEntries();
  let entry = null;
  for(let i=data.length-1;i>=0;i--){
    if(sleeveMeasurementMatches(data[i]) && data[i].sleevePattern){ entry = data[i]; break; }
  }
  if(!entry || !entry.sleevePattern) return false;
  const sp = entry.sleevePattern;
  if(sp.anchorCount !== anchorCount || !sp.segments || sp.segments.length !== anchorCount-1) return false;
  state.sleeveH = {
    anchorCount: sp.anchorCount,
    segments: sp.segments.map(seg => ({
      c1: {x:+seg.c1.x, y:+seg.c1.y},
      c2: {x:+seg.c2.x, y:+seg.c2.y},
    })),
    anchorOffsets: sp.anchorOffsets
      ? sp.anchorOffsets.map(o => ({dx:+o.dx, dy:+o.dy}))
      : Array(sp.anchorCount).fill(null).map(()=>({dx:0,dy:0}))
  };
  return true;
}
function restoreSavedSleevePatternForCurrentSleeve(showAlert=false){
  const data = getSavedCurveEntries();
  for(let i=data.length-1;i>=0;i--){
    const entry = data[i];
    if(sleeveMeasurementMatches(entry) && entry.sleevePattern){
      state.sleeveH = {
        anchorCount: entry.sleevePattern.anchorCount,
        segments: entry.sleevePattern.segments.map(seg => ({
          c1: {x:+seg.c1.x, y:+seg.c1.y},
          c2: {x:+seg.c2.x, y:+seg.c2.y},
        })),
        anchorOffsets: entry.sleevePattern.anchorOffsets
          ? entry.sleevePattern.anchorOffsets.map(o => ({dx:+o.dx, dy:+o.dy}))
          : Array(entry.sleevePattern.anchorCount).fill(null).map(()=>({dx:0,dy:0}))
      };
      if(showAlert) alert('현재 소매 기준의 마지막 소매산선을 불러왔습니다.');
      return true;
    }
  }
  if(showAlert) alert('현재 소매 기준과 같은 저장 데이터가 없습니다.');
  return false;
}
function loadSavedCurveForCurrentMeasurements(showAlert=false){
  const entry = findLastSavedForCurrentMeasurements();
  if(!entry){
    if(showAlert) alert('현재 치수와 같은 저장 데이터가 없습니다.');
    return false;
  }
  applySavedCurveEntry(entry, true);
  if(showAlert) alert('현재 치수의 마지막 저장선을 불러왔습니다.');
  render();
  return true;
}
// 마지막 저장 데이터로 핸들 복원: 현재 치수와 같은 데이터만 자동 복원
if(n("inpB") && n("inpW") && n("inpBL")) loadSavedCurveForCurrentMeasurements(false);
updateSaveCount();


// ── DXF 내보내기 (SVG 패턴선 직접 읽기 방식) ──────────────
// 화면에 그려진 패턴선(path/line)을 그대로 읽어서 DXF로 변환한다.
// 재계산 없이 화면 = DXF 100% 일치. 패턴선만 출력하고 보조선/점/텍스트는 제외.
function exportDXF(){
  const B = n('inpB'), W = n('inpW'), BL = n('inpBL'), SL = n('inpSL');
  if(!B || !W || !BL){ alert('치수를 입력하고 패턴을 생성해주세요.'); return; }

  const scale = 10; // cm → mm

  // 화면 좌표(px) → 패턴 좌표(cm) 역변환
  // c2p: [MX + x*SC*viewZ + viewX, MY + y*SC*viewZ + viewY]
  // 역변환: x = (px - MX - viewX) / (SC*viewZ)
  function screenToPattern(px, py){
    return {
      x: (px - MX - viewX) / (SC * viewZ),
      y: (py - MY - viewY) / (SC * viewZ)
    };
  }

  // SVG path의 d 속성을 파싱해서 점 배열로 변환 (M, L, C 명령 지원)
  function parsePathToPoints(d, steps=60){
    const pts = [];
    // 명령어 토큰화
    const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/gi);
    if(!tokens) return pts;
    let i = 0, cur = null, cmd = null;
    function num(){ return parseFloat(tokens[i++]); }
    while(i < tokens.length){
      const t = tokens[i];
      if(/[MLCZ]/i.test(t)){ cmd = t.toUpperCase(); i++; }
      if(cmd === 'M'){
        cur = {x:num(), y:num()};
        pts.push(cur);
      } else if(cmd === 'L'){
        cur = {x:num(), y:num()};
        pts.push(cur);
      } else if(cmd === 'C'){
        const c1={x:num(),y:num()}, c2={x:num(),y:num()}, end={x:num(),y:num()};
        const p0 = cur;
        for(let s=1; s<=steps; s++){
          const tt=s/steps, mt=1-tt;
          pts.push({
            x: mt*mt*mt*p0.x + 3*mt*mt*tt*c1.x + 3*mt*tt*tt*c2.x + tt*tt*tt*end.x,
            y: mt*mt*mt*p0.y + 3*mt*mt*tt*c1.y + 3*mt*tt*tt*c2.y + tt*tt*tt*end.y
          });
        }
        cur = end;
      } else if(cmd === 'Z'){
        i++;
      } else {
        i++; // 알 수 없는 토큰 스킵
      }
    }
    return pts;
  }

  // DXF 생성
  const lines = [];
  lines.push('0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES');
  function addLine(x1,y1,x2,y2,layer){
    lines.push('0','LINE','8',layer,
      '10',(x1*scale).toFixed(3),'20',(-y1*scale).toFixed(3),'30','0.0',
      '11',(x2*scale).toFixed(3),'21',(-y2*scale).toFixed(3),'31','0.0');
  }
  function addPolyline(pts, layer){
    for(let k=0;k<pts.length-1;k++) addLine(pts[k].x,pts[k].y,pts[k+1].x,pts[k+1].y,layer);
  }
  function addText(x,y,txt,layer,h=3){
    lines.push('0','TEXT','8',layer,
      '10',(x*scale).toFixed(3),'20',(-y*scale).toFixed(3),'30','0.0',
      '40',(h*scale).toFixed(3),'1',txt);
  }

  // 패턴선만 수집: classifyVisualElement이 'pattern'으로 분류하는 요소
  // = class에 pattern / sleeve-pattern-line / sleeve-cap 포함
  let count = 0;
  const patternEls = svg.querySelectorAll('path, line');
  patternEls.forEach(el => {
    const cls = el.getAttribute('class') || '';
    const isPattern = /pattern|sleeve-pattern-line|sleeve-cap/.test(cls);
    if(!isPattern) return;
    // 편집 핸들선 제외
    if(/handle/.test(cls)) return;

    const tag = el.tagName.toLowerCase();
    if(tag === 'path'){
      const d = el.getAttribute('d');
      if(!d) return;
      const screenPts = parsePathToPoints(d);
      const patPts = screenPts.map(pt => screenToPattern(pt.x, pt.y));
      addPolyline(patPts, 'PATTERN');
      count++;
    } else if(tag === 'line'){
      const p1 = screenToPattern(+el.getAttribute('x1'), +el.getAttribute('y1'));
      const p2 = screenToPattern(+el.getAttribute('x2'), +el.getAttribute('y2'));
      addLine(p1.x, p1.y, p2.x, p2.y, 'PATTERN');
      count++;
    }
  });

  if(count === 0){
    alert('출력할 패턴선이 없습니다. 패턴을 먼저 생성하고 패턴선 표시를 켜주세요.');
    return;
  }

  // 치수 정보 텍스트
  addText(0, -2, `B=${B} W=${W} BL=${BL} SL=${SL}`, 'TEXT');

  lines.push('0','ENDSEC','0','EOF');

  const blob = new Blob([lines.join('\n')], {type:'application/dxf'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `pattern_B${B}_W${W}_BL${BL}_${new Date().toISOString().slice(0,10)}.dxf`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  alert(`DXF 다운로드 완료! (패턴선 ${count}개)`);
}
