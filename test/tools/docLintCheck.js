// tools/docLint.js 합성 fixture 회귀 — 임시 가짜 git 저장소(os.tmpdir)에서만 실행하고 끝나면 지운다.
// 실행: node test/tools/docLintCheck.js   (실제 저장소는 읽지도 쓰지도 않는다)
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const TOOL = path.join(__dirname, "..", "..", "tools", "docLint.js");
const { lint } = require(TOOL);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const GIT = ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const git = (d, a) => cp.execFileSync("git", GIT.concat(["-C", d], a), { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const W = (d, f, t) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), t); };
const run = (args, cwd) => { const r = cp.spawnSync(process.execPath, [TOOL].concat(args), { encoding: "utf8", cwd }); return { code: r.status, out: r.stdout, err: r.stderr }; };
const tmp = [];
const mk = () => { const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "doclint-"))); tmp.push(d); git(d, ["init", "-q"]); return d; };

try {
  // ── 1. 기준 저장소 ──
  const R = mk();
  W(R, "CLAUDE.md", "# 헌법\n[색인](docs/INDEX.md)\n");
  W(R, "docs/INDEX.md", "# Index\n[a](a.md) [b](b.md) [h](history/old.md) [g](grow.md) [gone](gone.md)\n");
  W(R, "docs/b.md", "# B Title\n\n## Setup Steps\n\n## 설치 방법\n\n## 다음에 확인할 것 (열린 이슈)\n<a id=\"custom-x\"></a>\n");
  W(R, "docs/my doc.md", "# space\n");
  W(R, "docs/history/old.md", "# old\n옛 이름 `findMaxSafeAngle` 은 삭제됐다.\n");
  W(R, "docs/grow.md", "# grow\nx\n");
  W(R, "docs/gone.md", "# gone\n");
  W(R, "memory/README.md", "# mem\n[e](dart-engine.md)\n");
  W(R, "memory/dart-engine.md", "# 계약\n`liveFunction` 와 `staleFunction` 를 쓴다.\n## 부재 목록\n```\nABSENT: deadFunction, liveFunction\n```\n");
  W(R, "js/dartMove.js", "function liveFunction() {}\n// deadFunction 은 주석으로만\n");
  W(R, "js/code.js", "a\nb\nc\n");
  W(R, "docs/orphan.md", "# lonely\n");
  W(R, "docs/Case.md", "# case\n");
  W(R, "docs/a.md", [
    "# A",
    "[ok](b.md) [missing](nope.md) [dir](history/) [up](../CLAUDE.md)",
    "[anchor ok](b.md#setup-steps) [anchor bad](b.md#setup-stepz) [anchor kr](b.md#설치-방법) [kr bad](b.md#설치-방볍) [html id](b.md#custom-x)",
    "[self](#a) [self bad](#zzz)",
    "```",
    "[in fence](fence-missing.md)",
    "```",
    "인라인 `[in code](code-missing.md)` 은 무시",
    "[ext](https://example.com/x.md) [mail](mailto:a@b.c) [proto](//cdn.example/x)",
    "[enc](my%20doc.md) [angle](<my doc.md>) [badenc](x%E0%A4%A.md)",
    "[out](../../../etc/passwd.md) [abs](/docs/b.md)",
    "[link](lnk.md) [prot](../books/pages/1.png) [prot2](../AGENTS.md)",
    "[ref ok][r1] [ref broken][r2] [ref undef][r3] [collapsed][]",
    "[r1]: b.md",
    "[r2]: missing-ref.md",
    "[case](case.md) [untracked](scratch.txt)",
    "[line ok](../js/code.js#L2) [line bad](../js/code.js#L9) [line range](../js/code.js#L1-L3)",
    "[sec](b.md) § 다음에 확인할 것 «무엇» · [sec bad](b.md) § 전혀 없는 제목",
    "구간 [P−ℓ, P+ℓ](ℓ=2cm) 수식",
    ""].join("\n"));
  git(R, ["add", "-A"]); git(R, ["commit", "-qm", "base"]);
  // 커밋 후 변경: 팽창 / 삭제 / 스테이징된 새 문서 / 미추적 문서 / 미추적 대상 / 심볼릭 링크
  W(R, "docs/grow.md", "# grow\n" + "line\n".repeat(400));
  fs.unlinkSync(path.join(R, "docs/gone.md"));
  W(R, "docs/staged.md", "# staged\n"); git(R, ["add", "docs/staged.md"]);
  W(R, "docs/new-untracked.md", "# new\n" + "z\n".repeat(5000));
  W(R, "docs/scratch.txt", "s\n");
  fs.symlinkSync("/etc/hosts", path.join(R, "docs/lnk.md"));
  fs.mkdirSync(path.join(R, "books/pages"), { recursive: true }); fs.writeFileSync(path.join(R, "books/pages/1.png"), "x");
  W(R, "books/note.md", "[x](nowhere.md)\n");      // 보호 영역 문서 — 스캔 대상 아님
  W(R, "AGENTS.md", "[x](nowhere.md)\n");

  const before = git(R, ["status", "--porcelain=v1", "-uall"]) + git(R, ["diff"]);
  const res = lint({ root: R }), F = res.findings;
  if (process.env.DOCLINT_DUMP) F.forEach(f => console.log(f.sev, f.cat, f.file + ":" + f.line, f.msg));
  const has = (cat, file, re) => F.some(f => f.cat === cat && (!file || f.file === file) && (!re || re.test(f.msg)));
  const none = (re) => !F.some(f => re.test(f.msg));

  ok(has("broken-link", "docs/a.md", /nope\.md/), "1: 끊긴 링크 = error");
  ok(F.find(f => f.cat === "broken-link").sev === "error", "1: broken-link 등급 error");
  ok(!has("broken-link", null, /b\.md$/) && !has("broken-link", null, /history\//) && !has("broken-link", null, /CLAUDE/), "1: 정상 파일·디렉터리·상위 상대경로 통과");
  ok(!has("anchor-missing", null, /setup-steps /) && has("anchor-missing", "docs/a.md", /setup-stepz/), "2: ASCII 앵커 정확/불일치");
  ok(F.find(f => /setup-stepz/.test(f.msg)).sev === "warn", "2: ASCII 앵커 불일치 = warn(구조 오류 아님)");
  ok(none(/#설치-방법 /) && has("anchor-review", "docs/a.md", /설치-방볍/), "2: 한글 자동 앵커 정확=통과, 불확실=review");
  ok(none(/custom-x/), "2: HTML id 앵커 통과");
  ok(none(/#a /) && has("anchor-missing", "docs/a.md", /#zzz/), "2: 같은 파일 순수 앵커");
  ok(none(/fence-missing/) && none(/code-missing/), "3: 코드 펜스·인라인 코드 안 예시 링크 무시");
  ok(none(/example/) && none(/mailto/) && res.stats.external === 3, "4: 외부 URL·메일·// 미접근");
  ok(none(/my%20doc|my doc/), "5: URL 인코딩 공백·<공백 경로> 해석");
  ok(has("bad-encoding", "docs/a.md", /x%E0/), "5: 잘못된 인코딩 = error");
  ok(has("outside-repo", "docs/a.md", /passwd/), "6: 저장소 밖 경로 = warn·미접근");
  ok(has("absolute-path", "docs/a.md", /\/docs\/b\.md/), "6: 절대 경로 = review");
  ok(has("symlink", "docs/a.md", /lnk\.md/) && has("symlink", null, /저장소 밖/), "6: 심볼릭 링크 따라가지 않고 warn(밖 표시)");
  ok(res.stats.protectedSkip === 2 && none(/books|AGENTS/) && !F.some(f => f.file.startsWith("books/") || f.file === "AGENTS.md"), "7: 보호 대상 링크·문서 스캔 제외");
  ok(has("broken-link", "docs/a.md", /missing-ref/) && none(/: b\.md$/) && has("ref-undefined", "docs/a.md", /r3/) && has("ref-undefined", "docs/a.md", /collapsed/), "8: 참조형 정의·사용");
  ok(has("case-mismatch", "docs/a.md", /case\.md/) || has("broken-link", "docs/a.md", /case\.md/), "9: 대소문자 불일치 = error");
  ok(has("target-untracked", "docs/a.md", /scratch\.txt/), "9: 미추적 대상 = warn");
  ok(has("line-anchor-range", "docs/a.md", /#L9/) && none(/#L2 |#L1-L3/), "10: 코드 줄 앵커 범위");
  ok(res.stats.sectionOk >= 1 && has("section-ref-review", "docs/a.md", /전혀 없는 제목/), "11: § 접두어 일치/불확실 review");
  ok(has("link-like-text", "docs/a.md", /ℓ=2cm/) && F.find(f => f.cat === "link-like-text").sev === "review", "11: 수식 괄호 = review(오류 아님)");
  ok(has("orphan-candidate", "docs/orphan.md") && !has("orphan-candidate", "docs/a.md") && !has("orphan-candidate", "CLAUDE.md"), "12: 색인 미연결 후보 = info");
  ok(has("growth", "docs/grow.md", /→402줄/) && !has("growth", "docs/a.md"), "13: HEAD 대비 급팽창 = warn");
  ok(has("missing-in-worktree", "docs/gone.md"), "13: 추적 문서 삭제 = warn");
  ok(has("no-baseline", "docs/staged.md", /HEAD 에 없는/) && has("no-baseline", "docs/new-untracked.md", /미추적/), "14: 새 문서 = 기준 없음(info)");
  ok(F.filter(f => f.file === "docs/new-untracked.md").every(f => f.sev === "info"), "14: 큰 미추적 문서를 오류로 단정하지 않음");
  ok(has("code-ref", "memory/dart-engine.md", /staleFunction/) && !has("code-ref", null, /^liveFunction 가/), "15: 현재형 계약 식별자 = warn");
  ok(has("code-ref", null, /부재 목록」의 liveFunction/) && !has("code-ref", null, /deadFunction/), "15: 부재 목록 정의 존재만 경고(주석 언급은 통과)");
  ok(!F.some(f => f.file === "docs/history/old.md" && f.cat === "code-ref"), "15: history 옛 함수명은 검사 대상 아님");

  const after = git(R, ["status", "--porcelain=v1", "-uall"]) + git(R, ["diff"]);
  ok(before === after, "16: 실행 전후 git 상태·diff 불변");
  const r1 = run(["--root", R, "--max", "1"]);
  ok(r1.code === 0 && /\[error\/broken-link\] 3건 \(앞 1건만 표시\)/.test(r1.out), "17: 보고 전용 exit 0 · 표시 상한과 전체 건수 구분");
  ok(/docs\/(INDEX|a)\.md:2 /.test(r1.out), "17: 경로:줄 위치 출력");
  ok(run(["--root", R, "--strict"]).code === 1, "17: --strict + error = exit 1");
  const NG = fs.mkdtempSync(path.join(os.tmpdir(), "doclint-nogit-")); tmp.push(NG);
  ok(run(["--root", NG]).code === 2, "17: 저장소 아님 = exit 2");
  ok(run(["--bogus"]).code === 2, "17: 인자 오류 = exit 2");

  // ── 2. HEAD 없는 저장소 / 깨끗한 저장소 ──
  const N = mk();
  W(N, "CLAUDE.md", "# x\n[a](a.md)\n"); W(N, "a.md", "# a\n"); git(N, ["add", "-A"]);
  const rn = lint({ root: N });
  ok(rn.findings.some(f => f.cat === "no-head") && !rn.findings.some(f => f.sev === "error" || f.sev === "warn"), "18: HEAD 없음 = info, 팽창 검사 생략");
  git(N, ["commit", "-qm", "c"]);
  const rc = run(["--root", N, "--strict"]);
  ok(rc.code === 0 && /error 0 · warn 0/.test(rc.out), "18: 깨끗한 저장소 strict 통과");
} finally {
  tmp.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* 정리 실패는 무시 */ } });
}
console.log("docLintCheck: " + pass + " PASS, " + fail + " FAIL");
process.exit(fail ? 1 : 0);
