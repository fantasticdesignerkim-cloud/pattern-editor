// ── 진동선 데이터 저장/내보내기 ──────────────────
// 저장소 키는 두 개다(둘 다 곡선 JSON — 프로젝트 파일(js/projectFile.js)과 무관):
//   armhole_data    : 이력 배열(내보내기 형식)        armhole_data_kv : 치수키(B-W-BL)별 최신 1건
//
// 안전 계약(2026-11-12):
//   1. 읽기(readCurveStore)는 **절대 쓰지 않는다.** 손상된 원문은 그대로 둔다(자동 삭제·덮어쓰기 없음).
//   2. 쓰기는 검증(validateCurveEntry) → 기존 원문 읽기 가능 확인 → 두 키 기록(둘째 실패 시 첫째 원복) 순서.
//      검증이 끝나기 전에는 state·localStorage 를 건드리지 않는다.
//   3. 실패하면 사유를 돌려주고 화면에 표시한다 — 성공한 척하지 않는다.
const CURVE_STORE_KEY = 'armhole_data';
const CURVE_STORE_KV_KEY = 'armhole_data_kv';
const CURVE_COORD_MAX = 10000;        // cm. 이보다 큰 좌표는 곡선이 아니라 깨진 값이다.
const CURVE_MEASURE_MAX = 1000;       // cm
let curveStoreNotice = '';            // 마지막 저장 실패 사유(성공하면 비운다) — 저장 건수 줄에 표시
let curveAutoSaveWarned = '';         // 자동 저장 실패를 같은 사유로 반복 알리지 않기 위한 기억

function _curveIsObj(v){ return v !== null && typeof v === 'object' && !Array.isArray(v); }
function _curveNum(v, min, max){ return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max; }
function _curvePt(p){ return _curveIsObj(p) && _curveNum(p.x, -CURVE_COORD_MAX, CURVE_COORD_MAX) && _curveNum(p.y, -CURVE_COORD_MAX, CURVE_COORD_MAX); }
// 전체 순회: 위험 키·비유한 수·과도한 깊이. 문제 경로를 돌려주고, 없으면 ''.
function _curveScan(v, path, depth){
  if(typeof v === 'number') return Number.isFinite(v) ? '' : (path || '값') + ': 유한한 수가 아님';
  if(v === null || typeof v !== 'object') return '';
  if(depth > 12) return (path || '값') + ': 구조가 너무 깊음';
  if(Array.isArray(v)){
    for(let i=0;i<v.length;i++){ const r = _curveScan(v[i], path + '[' + i + ']', depth+1); if(r) return r; }
    return '';
  }
  for(const k of Object.keys(v)){
    if(k === '__proto__' || k === 'constructor' || k === 'prototype') return (path ? path + '.' : '') + k + ': 허용되지 않는 키';
    const r = _curveScan(v[k], (path ? path + '.' : '') + k, depth+1); if(r) return r;
  }
  return '';
}
const CURVE_POINT_GROUPS = {
  anchors:   ['a1','a2','a3'],
  handles:   ['h0','h1a','h1b','h2a','h2b','h3a','h3b','h4'],
  fArmhole:  ['hGa','hGb','hFa','hFb'],
  bNeckline: ['h0','h1'],
  fNeckline: ['h0','h1'],
};
// 곡선 항목 1건의 구조·수치 검증. 순수 함수(읽기만). { ok:true } 또는 { ok:false, reason }.
// 구버전 항목(SL·Hem·capFormula·sleevePattern·anchorOffsets 없음)은 정상으로 받는다.
function validateCurveEntry(e){
  const bad = reason => ({ ok:false, reason });
  if(!_curveIsObj(e)) return bad('항목이 객체가 아님');
  const scan = _curveScan(e, '', 0);
  if(scan) return bad(scan);
  const m = e.measurements;
  if(!_curveIsObj(m)) return bad('measurements 없음');
  for(const k of ['B','W','BL']){
    if(!(_curveNum(m[k], 0, CURVE_MEASURE_MAX) && m[k] > 0)) return bad('measurements.' + k + ': 올바른 치수가 아님');
  }
  for(const k of ['SL','Hem']){
    if(m[k] != null && !_curveNum(m[k], 0, CURVE_MEASURE_MAX)) return bad('measurements.' + k + ': 올바른 치수가 아님');
  }
  if(e.capFormula != null && !(typeof e.capFormula === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(e.capFormula))) return bad('capFormula: 올바른 값이 아님');
  if(e.timestamp != null && typeof e.timestamp !== 'string') return bad('timestamp: 문자열이 아님');
  if(e.auto != null && typeof e.auto !== 'boolean') return bad('auto: 참/거짓이 아님');
  let curves = 0;
  for(const g of Object.keys(CURVE_POINT_GROUPS)){
    const v = e[g];
    if(v == null) continue;
    if(!_curveIsObj(v)) return bad(g + ': 객체가 아님');
    for(const k of CURVE_POINT_GROUPS[g]){
      if(!_curvePt(v[k])) return bad(g + '.' + k + ': 좌표가 없거나 올바르지 않음');
    }
    curves++;
  }
  if((e.anchors == null) !== (e.handles == null)) return bad('anchors 와 handles 는 함께 있어야 함');
  const sp = e.sleevePattern;
  if(sp != null){
    if(!_curveIsObj(sp)) return bad('sleevePattern: 객체가 아님');
    const cnt = sp.anchorCount;
    if(!(Number.isInteger(cnt) && cnt >= 2 && cnt <= 64)) return bad('sleevePattern.anchorCount: 올바른 개수가 아님');
    if(!Array.isArray(sp.segments) || sp.segments.length !== cnt-1) return bad('sleevePattern.segments: 개수가 anchorCount 와 맞지 않음');
    for(let i=0;i<sp.segments.length;i++){
      const seg = sp.segments[i];
      if(!_curveIsObj(seg) || !_curvePt(seg.c1) || !_curvePt(seg.c2)) return bad('sleevePattern.segments[' + i + ']: 좌표가 없거나 올바르지 않음');
    }
    if(sp.anchorOffsets != null){
      if(!Array.isArray(sp.anchorOffsets) || (sp.anchorOffsets.length !== cnt && sp.anchorOffsets.length !== 0)) return bad('sleevePattern.anchorOffsets: 개수가 anchorCount 와 맞지 않음');
      for(let i=0;i<sp.anchorOffsets.length;i++){
        const o = sp.anchorOffsets[i];
        if(!_curveIsObj(o) || !_curveNum(o.dx, -CURVE_COORD_MAX, CURVE_COORD_MAX) || !_curveNum(o.dy, -CURVE_COORD_MAX, CURVE_COORD_MAX)) return bad('sleevePattern.anchorOffsets[' + i + ']: 올바르지 않음');
      }
    }
    curves++;
  }
  if(curves === 0) return bad('곡선 데이터가 없음');
  return { ok:true };
}

// 저장소 읽기(쓰기 없음). 복원·건수 판정이 **같은 목록**(entries)을 쓴다.
//   entries = kv 의 유효 항목 + (kv 에 유효 항목이 없는 치수에 한해) 이력 배열의 치수별 마지막 유효 항목.
//   순서는 [배열 유래…, kv 유래…] — findLast 류가 뒤에서부터 찾으므로 kv 가 이긴다.
function readCurveStore(){
  const out = { arr:null, kv:null, arrRaw:null, kvRaw:null, arrBad:false, kvBad:false, blocked:false,
                problems:[], entries:[], invalid:0 };
  try{
    out.arrRaw = localStorage.getItem(CURVE_STORE_KEY);
    out.kvRaw  = localStorage.getItem(CURVE_STORE_KV_KEY);
  } catch(e){
    out.blocked = true;
    out.problems.push('브라우저 저장소에 접근할 수 없습니다 (' + ((e && e.name) || '오류') + ')');
    return out;
  }
  if(out.arrRaw != null){
    try{ const v = JSON.parse(out.arrRaw); if(!Array.isArray(v)) throw new Error('not array'); out.arr = v; }
    catch(e){ out.arrBad = true; out.problems.push('저장 이력(armhole_data)이 손상되어 읽을 수 없음 — 원문은 그대로 둠'); }
  }
  if(out.kvRaw != null){
    try{ const v = JSON.parse(out.kvRaw); if(!_curveIsObj(v)) throw new Error('not object'); out.kv = v; }
    catch(e){ out.kvBad = true; out.problems.push('치수별 저장(armhole_data_kv)이 손상되어 읽을 수 없음 — 원문은 그대로 둠'); }
  }
  const kvValid = [], have = new Set();
  if(out.kv){
    for(const k of Object.keys(out.kv)){
      const e = out.kv[k];
      if(validateCurveEntry(e).ok){ kvValid.push(e); have.add(getBodySaveKey(e.measurements.B, e.measurements.W, e.measurements.BL)); }
      else out.invalid++;
    }
  }
  const fromArr = new Map();
  if(out.arr){
    for(const e of out.arr){
      if(!validateCurveEntry(e).ok){ out.invalid++; continue; }
      const key = getBodySaveKey(e.measurements.B, e.measurements.W, e.measurements.BL);
      if(have.has(key)) continue;
      fromArr.delete(key);            // 같은 치수는 뒤 항목이 이긴다(삽입 순서 갱신)
      fromArr.set(key, e);
    }
  }
  out.entries = Array.from(fromArr.values()).concat(kvValid);
  return out;
}
function _curveStoreError(e){
  const quota = e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  return quota ? '브라우저 저장 공간이 가득 찼습니다(용량 초과).'
               : '브라우저 저장소에 쓸 수 없습니다 (' + ((e && e.name) || '오류') + ').';
}
// 쓰기 준비: 기존 원문을 읽을 수 없으면 **덮어쓰지 않고** 거부한다.
function openCurveStoreForWrite(){
  const st = readCurveStore();
  if(st.blocked) throw new Error(st.problems[0]);
  if(st.arrBad) throw new Error('기존 저장 이력(armhole_data)이 손상되어 있습니다. 원문을 지키기 위해 덮어쓰지 않았습니다.');
  if(st.kvBad)  throw new Error('기존 치수별 저장(armhole_data_kv)이 손상되어 있습니다. 원문을 지키기 위해 덮어쓰지 않았습니다.');
  return { arr: st.arr || [], kv: st.kv || {}, arrRaw: st.arrRaw, kvRaw: st.kvRaw };
}
function putCurveEntryInKv(w, entry){
  const key = getBodySaveKey(entry.measurements.B, entry.measurements.W, entry.measurements.BL);
  if(Object.prototype.hasOwnProperty.call(w.kv, key) && !validateCurveEntry(w.kv[key]).ok){
    throw new Error('이 치수(' + key + ')의 기존 저장 항목을 읽을 수 없습니다. 원문을 지키기 위해 덮어쓰지 않았습니다.');
  }
  w.kv[key] = entry;
}
// 두 키 기록. 둘째가 실패하면 첫째를 원래 원문으로 되돌린다(반쪽 저장 금지).
function commitCurveStore(w){
  const arrText = JSON.stringify(w.arr), kvText = JSON.stringify(w.kv);
  try{ localStorage.setItem(CURVE_STORE_KEY, arrText); }
  catch(e){ throw new Error(_curveStoreError(e)); }
  try{ localStorage.setItem(CURVE_STORE_KV_KEY, kvText); }
  catch(e){
    try{ if(w.arrRaw == null) localStorage.removeItem(CURVE_STORE_KEY); else localStorage.setItem(CURVE_STORE_KEY, w.arrRaw); } catch(_){}
    throw new Error(_curveStoreError(e));
  }
}
// 항목 1건 저장(수동·자동 공용). { ok:true } 또는 { ok:false, reason }.
function storeCurveEntry(entry, replaceAuto){
  try{
    const v = validateCurveEntry(entry);
    if(!v.ok) throw new Error('현재 곡선에 저장할 수 없는 값이 있습니다 (' + v.reason + ').');
    const w = openCurveStoreForWrite();
    putCurveEntryInKv(w, entry);
    let replaced = false;
    if(replaceAuto){
      for(let i=w.arr.length-1;i>=0;i--){
        const d = w.arr[i];
        if(d && d.auto && measurementMatches(d) && sleeveMeasurementMatches(d)){ w.arr[i] = entry; replaced = true; break; }
      }
    }
    if(!replaced) w.arr.push(entry);
    commitCurveStore(w);
    curveStoreNotice = '';
    updateSaveCount();
    return { ok:true };
  } catch(e){
    curveStoreNotice = '저장 실패: ' + e.message;
    updateSaveCount();
    return { ok:false, reason: e.message };
  }
}

function saveCurveData(){
  if(!state.armH && !state.sleeveH){ alert('저장할 곡선 데이터가 없습니다.'); return false; }
  const B  = +document.getElementById('inpB').value;
  const W  = +document.getElementById('inpW').value;
  const BL = +document.getElementById('inpBL').value;
  const H = state.armH; // null일 수 있음
  let entry;
  try{
  entry = {
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
  } catch(e){
    alert('저장하지 못했습니다.\n현재 곡선에 빠진 점이 있습니다 (' + e.message + ').');
    return false;
  }
  const r = storeCurveEntry(entry, false);
  if(!r.ok){ alert('저장하지 못했습니다.\n' + r.reason); return false; }
  alert('저장 완료! B=' + B + ' W=' + W + ' BL=' + BL);
  return true;
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
  // 치수별 최신 1건(kv) + 이력 배열(같은 치수의 자동 저장 항목은 교체) — 두 키를 한 번에 기록한다.
  const r = storeCurveEntry(entry, true);
  if(!r.ok){
    // 자동 저장은 마우스를 놓을 때마다 돈다 — 같은 사유는 한 번만 알리고, 저장 건수 줄에는 계속 표시한다.
    if(curveAutoSaveWarned !== r.reason){
      curveAutoSaveWarned = r.reason;
      alert('자동 저장하지 못했습니다.\n' + r.reason + '\n(같은 이유로는 다시 알리지 않습니다 — 파일 메뉴의 저장 건수 줄에 계속 표시됩니다.)');
    }
    return false;
  }
  curveAutoSaveWarned = '';
  return true;
}
function exportData(){
  const st = readCurveStore();
  if(st.blocked || st.arrBad){ alert('내보내지 못했습니다.\n' + st.problems.join('\n')); return; }
  const data = st.arr || [];
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
//   - `armhole_data_kv` : 치수키(B-W-BL)별 최신 1건.
//   kv는 새로 들어온 항목으로 갱신한다(같은 치수는 뒤 항목이 이김).
//
// 병합 방식(덮어쓰지 않는다): 기존 항목을 지우지 않고 뒤에 붙인다. 같은 치수가 있으면
// kv에서 가져온 쪽이 최신이 된다. 되돌릴 수 없는 삭제를 하지 않는 쪽이 안전하다.
//
// 멱등성: 같은 파일을 두 번 가져와도 결과가 같아야 한다. 예전엔 무조건 뒤에 붙여서
// 'JSON 불러오기'를 두 번 누르면 이력이 조용히 2배가 됐다 — kv는 치수키로 덮어쓰니
// UI 카운트는 그대로라 눈치채기 어려웠다. 회사↔맥을 오갈수록 계속 불어난다.
//
// 전부-아니면-전무(2026-11-12): 항목이 하나라도 올바르지 않으면 **파일 전체를 거부**하고
// 아무것도 쓰지 않는다(예전엔 measurements 만 보고 통과시켜 깨진 좌표가 저장·적용됐다).
function importCurveEntries(entries){
  if(_curveIsObj(entries) && typeof entries.format === 'string' && entries.format.indexOf('.project') >= 0){
    throw new Error('이 파일은 프로젝트 파일입니다. 곡선 데이터가 아니므로 파일 메뉴의 «프로젝트 열기»로 여세요.');
  }
  if(!Array.isArray(entries)) throw new Error('곡선 데이터 형식이 아닙니다 (내보낸 JSON 이 맞는지 확인하세요).');
  if(entries.length === 0) throw new Error('가져올 항목이 없습니다 (빈 파일).');
  const badList = [];
  for(let i=0;i<entries.length;i++){
    const v = validateCurveEntry(entries[i]);
    if(!v.ok) badList.push((i+1) + '번째 항목 — ' + v.reason);
  }
  if(badList.length){
    throw new Error('올바르지 않은 항목이 ' + badList.length + '건 있어 아무것도 가져오지 않았습니다.\n'
      + badList.slice(0,3).join('\n') + (badList.length > 3 ? '\n…' : ''));
  }

  const w = openCurveStoreForWrite();     // 기존 원문이 손상돼 있으면 여기서 거부(덮어쓰지 않음)

  // 이미 있는 항목은 건너뛴다. 같은 치수·같은 순간이라도 내용이 다르면 남긴다
  // (자동저장 auto:true와 수동저장은 초 단위로 붙어 나오는 별개 항목이다).
  const seen = new Set(w.arr.map(curveEntryFingerprint));
  const fresh = [];
  for(const e of entries){
    const fp = curveEntryFingerprint(e);
    if(seen.has(fp)) continue;
    seen.add(fp);
    fresh.push(e);
  }
  // kv는 **새로 들어온 항목으로만** 갱신한다. 전부 중복이면 건드리지 않는다 —
  // 가져온 뒤 편집해서 자동저장된 최신 곡선이 있는데 같은 파일을 다시 가져오면,
  // 전체로 덮어쓸 경우 그 최신 작업이 파일의 옛 항목으로 되돌아가 버린다.
  if(fresh.length){
    for(const e of fresh){ putCurveEntryInKv(w, e); w.arr.push(e); }
    commitCurveStore(w);
  }
  curveStoreNotice = '';
  updateSaveCount();
  return {
    imported: fresh.length,
    duplicates: entries.length - fresh.length,
    skipped: 0,
    total: w.arr.length
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
      let parsed;
      try{ parsed = JSON.parse(reader.result); }
      catch(e){ throw new Error('JSON 파일이 아니거나 내용이 깨져 있습니다.'); }
      const before = countSavedCurveKeys();
      const r = importCurveEntries(parsed);
      let msg = '가져오기 완료!\n' + r.imported + '건 가져옴 (치수별 ' + before + '건 → ' + countSavedCurveKeys() + '건)';
      if(r.duplicates > 0) msg += '\n' + r.duplicates + '건은 이미 있는 항목이라 건너뜀';
      // 현재 치수에 해당하는 곡선이 들어왔으면 바로 화면에 반영한다.
      const applied = loadSavedCurveForCurrentMeasurements(false);
      msg += applied ? '\n현재 치수의 곡선을 불러왔습니다.' : '\n현재 치수와 일치하는 곡선은 없습니다.';
      alert(msg);
      if(typeof render === 'function') render();
    } catch(e){
      alert('가져오기 실패 — 현재 작업과 저장 데이터는 그대로입니다.\n' + e.message);
    }
    input.value = '';   // 같은 파일을 다시 고를 수 있게 초기화
  };
  reader.onerror = () => { alert('파일을 읽지 못했습니다.'); input.value = ''; };
  reader.readAsText(file);
}

// 저장 건수 = 복원 가능한 치수 수(getSavedCurveEntries 와 같은 목록에서 센다).
function countSavedCurveKeys(st){
  const s = st || readCurveStore();
  return new Set(s.entries.map(e => getBodySaveKey(e.measurements.B, e.measurements.W, e.measurements.BL))).size;
}
function updateSaveCount(){
  const st = readCurveStore();
  let text = '저장 ' + countSavedCurveKeys(st) + '건 (치수별)';
  if(st.invalid) text += ' · 읽을 수 없는 항목 ' + st.invalid + '건(원문 보존)';
  if(st.problems.length) text += ' · ⚠ ' + st.problems.join(' / ');
  if(curveStoreNotice) text += ' · ⚠ ' + curveStoreNotice;
  const el = document.getElementById('saveCount');
  if(el) el.textContent = text;
  return text;
}

// ── 저장 데이터 구조 ──────────
// 키: "B-W-BL" 형태로 치수별 최신 데이터만 유지(kv) + 구버전 이력 배열 호환.
// 검증을 통과한 항목만 돌려준다(깨진 항목은 저장소에 그대로 두고 복원에서만 제외).
function getSavedCurveEntries(){
  return readCurveStore().entries;
}

function getBodySaveKey(B, W, BL){ return `${B}-${W}-${BL}`; }
function getSleeveSaveKey(B, W, BL, SL, capFormula){ return `${B}-${W}-${BL}-${SL}-${capFormula}`; }

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
// 검증을 통과한 항목만 state 에 적용한다. 통과 전에는 state·화면 입력을 건드리지 않는다.
function applySavedCurveEntry(entry, includeSleeve=true){
  if(!entry || !validateCurveEntry(entry).ok) return false;
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
// 현재 치수의 저장 곡선을 state 에 복원한다.
// ★ 자동 경로(showAlert=false)는 **state 만 바꾸고 그리지 않는다** — 호출자가 그린다:
//    · 이 파일 맨 아래(페이지 로드): 뒤따르는 스크립트(dartMove.js 등)가 아직 없어 render 를 부를 수 없다
//      (부르면 ReferenceError 로 이 파일 실행이 끊겨 저장 건수도 갱신되지 않았다). 첫 그리기는 init.js.
//    · render() 의 치수 전환 분기: render 안에서 다시 render 를 부르면 무한 재귀(스택 초과)였다.
//    · importDataFromFile: 직후에 스스로 render 한다.
//   사용자가 «불러오기» 버튼을 누른 경로(showAlert=true)만 여기서 그린다.
function loadSavedCurveForCurrentMeasurements(showAlert=false){
  const entry = findLastSavedForCurrentMeasurements();
  if(!entry || !applySavedCurveEntry(entry, true)){
    if(showAlert) alert('현재 치수와 같은 저장 데이터가 없습니다.');
    return false;
  }
  if(showAlert){
    alert('현재 치수의 마지막 저장선을 불러왔습니다.');
    render();
  }
  return true;
}
// 페이지 로드: 저장 건수 표시 → 현재 치수와 같은 저장 곡선만 state 에 복원(그리기는 init.js).
updateSaveCount();
if(n("inpB") && n("inpW") && n("inpBL")) loadSavedCurveForCurrentMeasurements(false);


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
