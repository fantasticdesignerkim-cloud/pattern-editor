#!/usr/bin/env node
// docLint — 추적 Markdown 문서 읽기 전용 점검기 (보고 전용, 자동 수정 없음).
//
// 사용:  node tools/docLint.js [--root <저장소>] [--max N] [--strict]
//   --root    점검할 git 저장소 루트(기본: 현재 디렉터리의 git 최상위)
//   --max     분류별 표시 건수 상한(기본 15). 전체 건수는 항상 따로 출력
//   --strict  error 등급이 1건 이상이면 exit 1 (기본은 보고 전용 → 경고·오류가 있어도 exit 0)
// exit 코드: 0 = 점검 완료(발견 여부 무관) · 1 = --strict 이고 error 발견 · 2 = 치명 실행 오류(저장소 아님·인자 오류 등)
//
// 하는 일 (전부 읽기): git ls-files / git show HEAD:<경로> / 저장소 안 파일 lstat·읽기.
// 하지 않는 일: 파일 생성·수정·삭제, git 상태 변경, 네트워크, 저장소 밖 경로 접근, 심볼릭 링크 따라가기, 문서 내 코드 실행.
// 제외(스캔·대상 확인 모두): PROTECTED 접두어. 저장소 밖 경로(사용자 전역 메모리 등)는 경로 해석만 하고 접근하지 않는다.
//
// 지원하는 링크 구문: 인라인 [t](dest "title") · 이미지 ![a](dest) · <공백 경로> · 참조형 [t][label] / [t][] 와 정의 [label]: dest.
// 지원하지 않음(명시): 단축 참조 [label] · 들여쓰기 코드 블록 · HTML <a href> · 줄 넘김 링크 텍스트 · 각주.
// 등급: error = 구조 오류(대상 파일 없음 등) · warn = 확인 권장 · review = 판별 불확실(수동 검토) · info = 기록.
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");

const PROTECTED = ["AGENTS.md", "books/", "260923/", ".claude/", "armhole_data_"];
const INDEX_ROOTS = ["CLAUDE.md", "docs/INDEX.md", "docs/book/INDEX.md", "memory/README.md"];
// 현재형 계약 문서의 코드 식별자 점검(경고 수준, 작게 시작). history·spec 의 옛 이름은 대상이 아니다.
const CONTRACTS = [{ doc: "memory/dart-engine.md", code: "js/dartMove.js", absentSection: /^#+\s*부재 목록/ }];
const GROWTH = { ratio: 2, minLines: 200, minBytes: 20000 };

function parseArgs(argv) {
  const o = { root: null, max: 15, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") o.root = argv[++i];
    else if (a === "--max") o.max = parseInt(argv[++i], 10);
    else if (a === "--strict") o.strict = true;
    else throw new Error("알 수 없는 인자: " + a);
  }
  if (!(o.max >= 0)) throw new Error("--max 는 0 이상 정수");
  return o;
}

const git = (root, args, opts) => cp.execFileSync("git", ["-C", root].concat(args),
  Object.assign({ encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] }, opts || {}));
const isProtected = rel => PROTECTED.some(p => rel === p || rel.startsWith(p));
const posix = p => p.split(path.sep).join("/");

// ── Markdown 전처리: 코드 펜스·인라인 코드 제거(열 위치 보존) ──
function scanLines(text) {
  const lines = text.split(/\r?\n/), out = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i], m = /^ {0,3}(`{3,}|~{3,})/.exec(L);
    if (fence) { if (m && m[1][0] === fence[0] && m[1].length >= fence.length && /^ {0,3}[`~]+\s*$/.test(L)) fence = null; out.push({ n: i + 1, text: "", code: true }); continue; }
    if (m) { fence = m[1]; out.push({ n: i + 1, text: "", code: true }); continue; }
    out.push({ n: i + 1, text: stripInlineCode(L), raw: L, code: false });
  }
  return out;
}
function stripInlineCode(L) {
  return L.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, s => " ".repeat(s.length));
}

// ── 헤딩 → GitHub 식 앵커 ──
function headingText(h) {
  return h.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "").replace(/[*`~]/g, "").replace(/\s+#+\s*$/, "").trim();
}
const slug = t => t.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "").replace(/ /g, "-");
const loose = t => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
function headingsOf(text) {
  const raw = text.split(/\r?\n/), ls = scanLines(text), hs = [], seen = {}, ids = new Set();
  for (let i = 0; i < ls.length; i++) {
    if (ls[i].code) continue;
    let t = null; const m = /^ {0,3}#{1,6}\s+(.*)$/.exec(raw[i]);
    if (m) t = m[1];
    else if (i + 1 < ls.length && !ls[i + 1].code && /^ {0,3}(=+|-+)\s*$/.test(raw[i + 1]) && raw[i].trim() && !/^\s*[-*+>|]/.test(raw[i])) t = raw[i];
    (raw[i].match(/<a\s+(?:id|name)="([^"]+)"/g) || []).forEach(a => ids.add(/"([^"]+)"/.exec(a)[1]));
    if (t == null) continue;
    const text2 = headingText(t); let s = slug(text2);
    if (seen[s] != null) { seen[s]++; s = s + "-" + seen[s]; } else seen[s] = 0;
    hs.push({ text: text2, slug: s, line: i + 1 });
  }
  return { hs, ids };
}

// ── 링크 추출 ──
function readDest(s, i) {          // s[i] 는 '(' 다음 위치. 반환 {dest, end} 또는 null
  while (s[i] === " ") i++;
  let dest = "";
  if (s[i] === "<") { const j = s.indexOf(">", i + 1); if (j < 0) return null; dest = s.slice(i + 1, j); i = j + 1; }
  else { let depth = 0; for (; i < s.length; i++) { const c = s[i]; if (c === "\\") { dest += s[++i] || ""; continue; } if (c === "(") depth++; else if (c === ")") { if (!depth) break; depth--; } else if (c === " ") break; dest += c; } }
  while (s[i] === " ") i++;
  if (s[i] === '"' || s[i] === "'") { const q = s[i], j = s.indexOf(q, i + 1); if (j < 0) return null; i = j + 1; while (s[i] === " ") i++; }
  if (s[i] !== ")") return null;
  return { dest, end: i + 1 };
}
function extractLinks(lines) {
  const links = [], defs = {}, refs = [];
  for (const ln of lines) {
    if (ln.code) continue;
    const s = ln.text, d = /^ {0,3}\[([^\]]+)\]:\s*(<[^>]*>|\S+)/.exec(s);
    if (d) { defs[d[1].toLowerCase()] = true; links.push({ line: ln.n, col: 1, dest: d[2].replace(/^<|>$/g, ""), kind: "def", after: "" }); continue; }
    const re = /\]\(|\]\[([^\]]*)\]/g; let m;
    while ((m = re.exec(s))) {
      const open = s.lastIndexOf("[", m.index); if (open < 0) continue;
      if (m[0] === "](") {
        const r = readDest(s, m.index + 2); if (!r) continue;
        links.push({ line: ln.n, col: open + 1, dest: r.dest, kind: "inline", after: s.slice(r.end) });
        re.lastIndex = r.end;
      } else {
        const label = (m[1] || s.slice(open + 1, m.index)).toLowerCase();
        refs.push({ line: ln.n, col: open + 1, label });
      }
    }
  }
  return { links, defs, refs };
}

// ── 경로 안전 확인: 저장소 밖·심볼릭 링크는 따라가지 않는다 ──
function safeResolve(root, rel) {
  const parts = rel.split("/").filter(Boolean); let cur = root;
  for (let k = 0; k < parts.length; k++) {
    const nxt = path.join(cur, parts[k]); let st;
    try { st = fs.lstatSync(nxt); } catch (e) { return { missing: true, at: posix(path.relative(root, nxt)) }; }
    if (st.isSymbolicLink()) {
      let tgt = ""; try { tgt = fs.readlinkSync(nxt); } catch (e) { /* 읽기 실패 = 미확인 */ }
      const abs = path.resolve(path.dirname(nxt), tgt), out = path.relative(root, abs).startsWith("..");
      return { symlink: true, outside: out, at: posix(path.relative(root, nxt)) };
    }
    // 대소문자 정확 일치(대소문자 무시 파일시스템에서 GitHub 깨짐을 잡는다)
    let names = []; try { names = fs.readdirSync(cur); } catch (e) { /* 무시 */ }
    if (names.length && names.indexOf(parts[k]) < 0) return { caseMismatch: true, at: posix(path.relative(root, nxt)) };
    cur = nxt;
    if (k === parts.length - 1) return { ok: true, dir: st.isDirectory(), abs: cur };
  }
  return { ok: true, dir: true, abs: root };
}

function lint(opts) {
  let root;
  try { root = git(opts.root || process.cwd(), ["rev-parse", "--show-toplevel"]).trim(); }
  catch (e) { throw new Error("git 저장소가 아니다: " + (opts.root || process.cwd())); }
  root = fs.realpathSync(root);
  const findings = [], add = (sev, cat, file, line, msg) => findings.push({ sev, cat, file, line, msg });
  const tracked = new Set(git(root, ["ls-files", "-z"]).split("\0").filter(Boolean));
  const mdTracked = [...tracked].filter(f => /\.md$/i.test(f) && !isProtected(f)).sort();
  const mdUntracked = git(root, ["ls-files", "-z", "-o", "--exclude-standard"]).split("\0").filter(f => f && /\.md$/i.test(f) && !isProtected(f)).sort();
  let hasHead = true; try { git(root, ["rev-parse", "--verify", "-q", "HEAD"]); } catch (e) { hasHead = false; }
  const stats = { files: 0, links: 0, external: 0, ok: 0, anchorsOk: 0, sectionOk: 0, protectedSkip: 0 };
  const headCache = {}, textCache = {};
  const readRepo = rel => {
    if (textCache[rel] !== undefined) return textCache[rel];
    const r = safeResolve(root, rel); let t = null;
    if (r.ok && !r.dir) { try { t = fs.readFileSync(r.abs, "utf8"); } catch (e) { t = null; } }
    return (textCache[rel] = t);
  };
  const headsOf = rel => headCache[rel] || (headCache[rel] = headingsOf(readRepo(rel) || ""));
  const inbound = {}; mdTracked.forEach(f => inbound[f] = new Set());

  for (const file of mdTracked) {
    const text = readRepo(file);
    if (text == null) { add("warn", "missing-in-worktree", file, 0, "추적 중인데 작업 트리에 없다(또는 심볼릭 링크라 읽지 않음)"); continue; }
    stats.files++;
    const lines = scanLines(text), { links, defs, refs } = extractLinks(lines), dir = path.posix.dirname(file);
    refs.forEach(r => { if (!defs[r.label]) add("warn", "ref-undefined", file, r.line, "참조형 링크 [" + r.label + "] 의 정의가 없다(단축 참조/일반 텍스트일 수 있음)"); });
    for (const L of links) {
      stats.links++;
      const dest = L.dest.trim();
      if (!dest) { add("warn", "empty-link", file, L.line, "빈 링크 대상"); continue; }
      if (/^[a-z][a-z0-9+.-]*:/i.test(dest) || dest.startsWith("//")) { stats.external++; continue; }   // http·mailto 등: 접근하지 않는다
      let p = dest, frag = null; const h = p.indexOf("#"); if (h >= 0) { frag = p.slice(h + 1); p = p.slice(0, h); }
      p = p.replace(/\?.*$/, "");
      try { p = decodeURIComponent(p); if (frag != null) frag = decodeURIComponent(frag); }
      catch (e) { add("error", "bad-encoding", file, L.line, "URL 인코딩 해석 불가: " + dest); continue; }
      if (p && !/[./]/.test(p)) { add("review", "link-like-text", file, L.line, "경로로 보이지 않는 링크 대상(수식·괄호 텍스트가 링크로 렌더될 수 있음): " + dest); continue; }
      if (p.startsWith("/")) { add("review", "absolute-path", file, L.line, "절대 경로는 해석 규칙이 환경마다 달라 확인하지 않음: " + dest); continue; }
      let target = file;
      if (p) {
        const abs = path.posix.normalize(path.posix.join(dir, p));
        if (abs === ".." || abs.startsWith("../")) { add("warn", "outside-repo", file, L.line, "저장소 밖 경로 — 접근하지 않음: " + dest); continue; }
        target = abs.replace(/\/$/, "") || ".";
        if (isProtected(target) || isProtected(target + "/")) { stats.protectedSkip++; continue; }
        const r = safeResolve(root, target === "." ? "" : target);
        if (r.symlink) { add("warn", "symlink", file, L.line, "심볼릭 링크 — 따라가지 않음" + (r.outside ? "(저장소 밖을 가리킴)" : "") + ": " + r.at); continue; }
        if (r.caseMismatch) { add("error", "case-mismatch", file, L.line, "대소문자가 실제 파일과 다르다(대소문자 구분 환경에서 깨짐): " + dest); continue; }
        if (r.missing) { add("error", "broken-link", file, L.line, "대상 없음: " + dest); continue; }
        if (!r.dir && !tracked.has(target) && ![...tracked].some(t => t.startsWith(target + "/")))
          add("warn", "target-untracked", file, L.line, "대상이 git 미추적 — 저장소를 받은 쪽에선 깨짐: " + dest);
        if (inbound[target] && target !== file) inbound[target].add(file);
        if (r.dir) { if (frag) add("review", "anchor-on-dir", file, L.line, "디렉터리에 앵커: " + dest); else stats.ok++; continue; }
      }
      if (frag == null || frag === "") {
        stats.ok++;
        if (/\.md$/i.test(target)) sectionCheck(L, file, target);
        continue;
      }
      if (/\.md$/i.test(target)) {
        const H = headsOf(target), f = frag.toLowerCase();
        if (H.ids.has(frag) || H.hs.some(x => x.slug === f)) { stats.anchorsOk++; continue; }
        const uncertain = /[^\x00-\x7f]/.test(frag);       // 한글 앵커는 GitHub 자동 생성 규칙 판별이 불확실
        const near = H.hs.find(x => loose(x.text) === loose(frag));
        add(uncertain || near ? "review" : "warn", uncertain || near ? "anchor-review" : "anchor-missing", file, L.line,
          "앵커 #" + frag + " 를 " + target + " 헤딩에서 정확히 못 찾음" + (near ? " (유사: " + near.text + ")" : "") + (uncertain ? " — 한글/자동 앵커 판별 불확실" : ""));
      } else {
        const lm = /^L(\d+)(?:C\d+)?(?:-L(\d+)(?:C\d+)?)?$/.exec(frag);
        if (!lm) { add("review", "anchor-unsupported", file, L.line, "비 Markdown 대상의 앵커 형식 미지원: " + dest); continue; }
        const t = readRepo(target), n = t == null ? 0 : t.split(/\r?\n/).length, hi = +(lm[2] || lm[1]);
        if (t == null) add("review", "anchor-unsupported", file, L.line, "대상을 텍스트로 읽지 않음: " + dest);
        else if (hi > n || +lm[1] < 1) add("warn", "line-anchor-range", file, L.line, "줄 앵커가 파일 길이(" + n + "줄) 밖: " + dest);
        else stats.anchorsOk++;
      }
    }
  }
  // 링크 뒤 「§ 제목」 — 접두어 비교만. 판별 불확실하므로 review 등급
  function sectionCheck(L, file, target) {
    const m = /^\s*§\s*([^|()\[\],·—「」*]+)/.exec(L.after); if (!m) return;
    const want = loose(m[1].split(/[«.]/)[0]); if (!want) return;
    const H = headsOf(target), cpl = (a, b) => { let n = 0; while (n < a.length && a[n] === b[n]) n++; return n; };
    // 공통 접두어 ≥ min(6, 짧은 쪽 길이) — 제목 뒤에 붙는 조사·괄호 설명을 허용하는 느슨한 비교
    if (H.hs.some(x => { const k = loose(x.text); return k && cpl(k, want) >= Math.min(6, k.length, want.length); })) { stats.sectionOk++; return; }
    add("review", "section-ref-review", file, L.line, "§ " + m[1].trim() + " 와 접두어가 맞는 헤딩이 " + target + " 에 없음(수동 확인)");
  }

  // 색인 미연결 후보: INDEX_ROOTS 어디에서도 직접 링크되지 않는 추적 문서
  const roots = INDEX_ROOTS.filter(r => tracked.has(r));
  for (const f of mdTracked) {
    if (roots.indexOf(f) >= 0) continue;
    const fromIndex = roots.some(r => inbound[f].has(r));
    if (!fromIndex) add("info", "orphan-candidate", f, 0, "색인(" + roots.join(", ") + ")에서 직접 링크되지 않음 · 다른 문서 inbound " + inbound[f].size + "건");
  }

  // HEAD 대비 급팽창
  if (!hasHead) add("info", "no-head", ".", 0, "HEAD 커밋이 없어 팽창 기준이 없다");
  for (const f of mdTracked) {
    const now = textCache[f]; if (now == null || !hasHead) continue;
    let old; try { old = git(root, ["show", "HEAD:" + f]); } catch (e) { add("info", "no-baseline", f, 0, "HEAD 에 없는 새 문서(스테이징됨) — 기준 없음"); continue; }
    const nl = now.split("\n").length, ol = old.split("\n").length, nb = Buffer.byteLength(now), ob = Buffer.byteLength(old);
    if ((nl > ol * GROWTH.ratio && nl - ol >= GROWTH.minLines) || (nb > ob * GROWTH.ratio && nb - ob >= GROWTH.minBytes))
      add("warn", "growth", f, 0, "HEAD 대비 급팽창: " + ol + "→" + nl + "줄, " + ob + "→" + nb + "B");
  }
  mdUntracked.forEach(f => add("info", "no-baseline", f, 0, "미추적 문서 — 기준 없음(크기만 기록: " + (() => { try { return fs.lstatSync(path.join(root, f)).size; } catch (e) { return "?"; } })() + "B)"));

  // 현재형 계약의 코드 식별자
  for (const C of CONTRACTS) {
    if (!tracked.has(C.doc)) continue;
    const doc = readRepo(C.doc), code = readRepo(C.code);
    if (doc == null) continue;
    if (code == null) { add("warn", "code-path-missing", C.doc, 0, "계약 대상 코드 파일 없음: " + C.code); continue; }
    let absent = false;
    doc.split(/\r?\n/).forEach((ln, i) => {
      if (/^#+\s/.test(ln)) absent = C.absentSection.test(ln);
      const esc = id => id.replace(/\$/g, "\\$");
      if (absent) {       // 부재 목록은 `ABSENT: a, b, …` 한 줄만 본다(설명 줄의 현행 이름은 대상 아님)
        const am = /^\s*ABSENT:\s*(.*)$/.exec(ln); if (!am) return;
        am[1].split(/[,\s]+/).filter(Boolean).forEach(id => {
          if (new RegExp("function\\s+" + esc(id) + "\\b").test(code)) add("warn", "code-ref", C.doc, i + 1, "「부재 목록」의 " + id + " 가 " + C.code + " 에 function 으로 정의돼 있다");
        });
        return;
      }
      (ln.match(/`([A-Za-z_$][\w$]*)`/g) || []).forEach(tk => {
        const id = tk.slice(1, -1); if (!/^[a-z_$][\w$]*[A-Z_][\w$]*$/.test(id) || id.length < 6) return;
        if (!new RegExp("\\b" + esc(id) + "\\b").test(code)) add("warn", "code-ref", C.doc, i + 1, id + " 가 " + C.code + " 에 없다(관찰 기록 노후화 후보)");
      });
    });
  }
  return { root, stats, findings, scanned: mdTracked.length, untracked: mdUntracked.length };
}

function report(res, max) {
  const out = [], { stats } = res, order = ["error", "warn", "review", "info"];
  out.push("docLint (읽기 전용) · " + res.root);
  out.push("추적 문서 " + res.scanned + " · 미추적 문서 " + res.untracked + " · 링크 " + stats.links + " (외부 " + stats.external + " 미접근, 보호 대상 " + stats.protectedSkip + " 미확인)");
  out.push("정상: 파일 링크 " + stats.ok + " · 앵커 " + stats.anchorsOk + " · § 접두어 " + stats.sectionOk);
  const cnt = s => res.findings.filter(f => f.sev === s).length;
  out.push("발견: error " + cnt("error") + " · warn " + cnt("warn") + " · review " + cnt("review") + " · info " + cnt("info"));
  const cats = {}; res.findings.forEach(f => (cats[f.sev + "/" + f.cat] = cats[f.sev + "/" + f.cat] || []).push(f));
  Object.keys(cats).sort((a, b) => order.indexOf(a.split("/")[0]) - order.indexOf(b.split("/")[0]) || a.localeCompare(b)).forEach(k => {
    const L = cats[k]; out.push("\n[" + k + "] " + L.length + "건" + (L.length > max ? " (앞 " + max + "건만 표시)" : ""));
    L.slice(0, max).forEach(f => out.push("  " + f.file + (f.line ? ":" + f.line : "") + "  " + f.msg));
  });
  return out.join("\n");
}

if (require.main === module) {
  let o, res;
  try { o = parseArgs(process.argv.slice(2)); res = lint(o); }
  catch (e) { process.stderr.write("docLint 치명 오류: " + e.message + "\n"); process.exit(2); }
  process.stdout.write(report(res, o.max) + "\n");
  process.exit(o.strict && res.findings.some(f => f.sev === "error") ? 1 : 0);
}
module.exports = { lint, report, slug, headingsOf };
