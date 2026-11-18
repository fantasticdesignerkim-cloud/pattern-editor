#!/usr/bin/env node
// 브라우저 검증 준비 확인 — 조작 전에 서버·버전·스크립트 로드를 한 번에 본다. 앱 코드는 읽기만 한다.
// 사용: node test/tools/browserReady.js [기본주소=http://127.0.0.1:8420] [--need js/a.js,js/b.js] [--expect js/a.js=VERSION]
// --tab [전역,…] : (서버 검사 대신) 현재 탭에서 돌릴 JS 식을 출력한다. 브라우저 도구(javascript_tool)에 그대로 넣으면
//   탭에 실제로 로드된 스크립트 버전이 디스크와 같은지 + 전역 존재(기본 blockWorkflow,designWorkflow,canvasPan)를 한 줄로 돌려준다.
// 종료 코드 0 = 준비됨, 1 = 사유 한 줄 출력(서버 꺼짐 / 오래된 빌드 / 스크립트 로드 실패 / 기대 버전 불일치).
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const base = new URL(args.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8420');
const need = (opt('--need') || '').split(',').filter(Boolean);
const expect = (opt('--expect') || '').split(',').filter(Boolean).map(s => s.split('='));
const fail = (kind, why) => { console.log(`NOT READY [${kind}] ${why}`); process.exit(1); };
const get = p => new Promise((res, rej) => {
  const r = http.get(new URL(p, base), { timeout: 4000 }, x => {
    const c = []; x.on('data', d => c.push(d)); x.on('end', () => res({ s: x.statusCode, b: Buffer.concat(c) }));
  });
  r.on('timeout', () => r.destroy(new Error('timeout'))); r.on('error', rej);
});
const scripts = h => [...h.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
if (args.includes('--tab')) {
  const gi = args.indexOf('--tab'), g = args[gi + 1] && !args[gi + 1].startsWith('-') && !/^https?:/.test(args[gi + 1]) ? args[gi + 1] : 'blockWorkflow,designWorkflow,canvasPan';
  // 탭이 실제로 쓰는 script 목록 ↔ 지금 서버가 주는 index.html(no-store) 비교. 서버↔디스크는 위 HTTP 검사가 맡는다.
  console.log(`(async()=>{const q=s=>[...s].map(x=>x.getAttribute('src')).filter(x=>x&&!/^https?:/.test(x)),` +
    `d=new DOMParser().parseFromString(await (await fetch('/index.html',{cache:'no-store'})).text(),'text/html'),` +
    `w=q(d.scripts),h=q(document.scripts),df=w.filter(x=>!h.includes(x)).concat(h.filter(x=>!w.includes(x))),` +
    `mg=${JSON.stringify(g.split(','))}.filter(n=>!window[n]);` +
    `return df.length?'NOT READY [오래된 빌드] 탭 script ≠ 서버: '+df[0]:` +
    `mg.length?'NOT READY [스크립트 로드 실패] 탭에 전역 없음: '+mg.join(','):'READY tab · script '+h.length+'개 일치 · 전역 OK'})()`);
  process.exit(0);
}
(async () => {
  let page;
  try { page = await get('/index.html'); } catch (e) { fail('서버 꺼짐', `${base.origin} 응답 없음 (${e.code || e.message})`); }
  if (page.s !== 200) fail('서버 꺼짐', `${base.origin}/index.html → HTTP ${page.s} (다른 서버/폴더일 수 있음)`);
  const html = page.b.toString('utf8'), disk = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const served = scripts(html), local = scripts(disk);
  if (!served.length) fail('서버 꺼짐', '응답이 앱 index.html 이 아님(script 0개)');
  const diff = local.filter(s => !served.includes(s));
  if (diff.length) fail('오래된 빌드', `서버 index.html 이 디스크와 다름 — 서버 쪽 버전 불일치 ${diff.length}건, 예: ${diff[0]}`);
  const bad = [];
  for (const s of served) {
    const clean = s.split('?')[0];
    if (/^https?:/.test(s)) continue;
    let r; try { r = await get(s); } catch (e) { bad.push(`${clean} (${e.code || e.message})`); continue; }
    if (r.s !== 200 || !r.b.length) { bad.push(`${clean} (HTTP ${r.s}${r.b.length ? '' : ', 빈 응답'})`); continue; }
    const f = path.join(root, clean);
    if (fs.existsSync(f) && !fs.readFileSync(f).equals(r.b)) fail('오래된 빌드', `${clean} 서버 본문이 디스크와 다름`);
  }
  if (bad.length) fail('스크립트 로드 실패', `${bad.length}건: ${bad.slice(0, 3).join(', ')}`);
  const names = served.map(s => s.split('?')[0]);
  const miss = need.filter(n => !names.includes(n));
  if (miss.length) fail('스크립트 로드 실패', `index.html 에 없음: ${miss.join(', ')}`);
  for (const [n, v] of expect) {
    const s = served.find(x => x.split('?')[0] === n);
    if (!s) fail('스크립트 로드 실패', `${n} 가 index.html 에 없음`);
    if ((s.split('?v=')[1] || '') !== v) fail('오래된 빌드', `${n} 버전 ${s.split('?v=')[1]} ≠ 기대 ${v}`);
  }
  console.log(`READY ${base.origin} · script ${names.length}개 로드 가능 · 디스크와 일치`);
})();
