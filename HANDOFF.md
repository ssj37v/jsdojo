# 인수인계 — JS Dojo

이 문서는 **다음 세션이 이 저장소를 처음 열었을 때** 필요한 것만 담는다.
프로젝트 규약은 `CLAUDE.md`, 학습자 사용법은 `MANUAL.md`, 챕터 작성 계약은 `README.md`,
커리큘럼 설계 근거는 `CURRICULUM.md`에 있다.
여기 있는 것은 그 문서들이 말하지 않는 것 — **왜 지금 이 상태인지, 다음에 무엇을 해야 하는지**다.

작성 시점: 2026-08-13 (커리큘럼 설계 확정 · ch02 완성 시점에 갱신)

---

## 1. 지금 어디까지 되어 있나

**엔진도 커리큘럼도 완성됐다. ch01~ch11 전 61스텝이 양방향 검증을 통과한다.**

| 영역 | 상태 |
|---|---|
| 엔진 (`dojo/` 20개 모듈) | codedojo에서 이식 완료. 기동·판정·세이브·진도 전부 동작 확인 |
| 콘텐츠 계약 (`content/schema.json`) | `seed_files` 시나리오분만 확장 (아래 3절) |
| **커리큘럼 설계 (`CURRICULUM.md`)** | **11장 배치·누적 관계·판정 3단 사다리 확정** |
| 커리큘럼 (`content/*.yaml`) | **ch01~ch11 = 61스텝. 완성** |
| 정답 픽스처 (`scripts/solutions/`) | ch01 ~ ch11 |
| 테스트 | 168개 통과 |

확인된 것:

```
npm test                             → 168 pass / 0 fail
node scripts/verify-chapter.mjs      → ch01→ch11 누적 61스텝 양방향 통과
                                        (미이행 시 실패 / 정답 적용 시 통과)
npm run dojo -- --chapter ch02        → 도입부·페이드 1단·힌트 잠금까지 실기동
```

**ch05에서 판정 방식이 2단으로 올라섰다.** `node --input-type=module -e` 하네스로 학습자 모듈을
직접 import해 동작으로 판정한다(`content/ch05-modules.yaml` 이 본보기). ch06~ch11은 이 형태를 따른다.

---

## 2. 이 저장소의 특수한 제약 — 엔진 동기화

엔진은 [codedojo](https://github.com/ssj37v/codedojo)(React·Next.js 커리큘럼)와 **같은 코드**다.
콘텐츠만 다르다. 이 관계를 유지하는 것이 규율이다.

- **`dojo/` 를 고칠 일이 생기면 먼저 "이 수정이 codedojo에도 타당한가"를 따진다.**
  타당하면 양쪽에 같이 넣는다. 한쪽에만 필요한 수정이라면 그건 대개 콘텐츠로 풀어야 할 문제다.
- 양쪽의 차이는 현재 **5곳뿐**이다. 이 목록이 길어지면 동기화가 깨지고 있다는 신호다.

| 파일 | codedojo | jsdojo |
|---|---|---|
| `dojo/ui.mjs` 배너 | `React · Next.js · git …` | `자바스크립트를 기초부터 설계까지 …` |
| `dojo/config.mjs` `SNAPSHOT_EXCLUDE` | `node_modules .next .turbo dist out coverage` | `node_modules dist coverage .cache` |
| `dojo/workspace.mjs` 안내 | `개발 서버(npm run dev)` | `실행 중인 node 프로세스(node --watch 등)` |
| `dojo/cli.mjs` 복구 안내 | `package.json이 함께 되돌아갔다면 …` | `workspace 에 package.json 과 의존성이 있었다면 …` |
| `test/` 2개 | 위 두 항목을 Next 기준으로 확인 | node 기준으로 확인 |

**codedojo로 옮겨야 할 것이 두 개 생겼다.** 아래는 차이가 아니라 **이식 대기분**이다 —
옮기고 나면 양쪽이 다시 같아진다. 방치하면 그때부터 진짜 차이가 된다.

| 변경 | 내용 | 왜 양쪽 모두에 타당한가 |
|---|---|---|
| `dojo/scenario.mjs` + `content/schema.json` | `seed_files` 시나리오 | "리팩터링할 코드를 미리 심어 준다"는 React 커리큘럼에도 그대로 쓸모가 있다 |
| `dojo/cli.mjs` `restart()` | `(7장 연습용 원격)` → `(git 협업 연습용 원격)` | 챕터 번호를 문구에 박아 두면 커리큘럼이 바뀔 때마다 틀린 안내가 된다 |
| `dojo/verify/run-process.mjs` | `cleanEnv()` — 자식 환경에서 `NODE_TEST_CONTEXT` 제거 | **거짓 통과 차단.** 이 변수가 있으면 `node --test` 가 파일을 하나도 돌리지 않고 0으로 끝난다. codedojo도 테스트 러너 안에서 판정을 돌리면 같은 함정에 빠진다 |
| `dojo/verify/git-check.mjs` | `branch_is` 가 커밋 이전(unborn HEAD)에도 브랜치 이름을 읽는다 | `git init` 직후를 판정하려면 필요하다. 고치기 전에는 git 오류문이 브랜치 이름인 양 학습자 화면에 나갔다 |

codedojo에서 엔진 수정이 나왔을 때 옮기는 방법:

```bash
cd D:\project\codedojo
git diff <before> <after> -- dojo/ > /tmp/fix.patch
cd D:\project\jsdojo
git apply /tmp/fix.patch      # 위 5곳에 걸리면 수동 병합
npm test
```

---

## 3. 이번에 이식하며 함께 고친 것

`--restart` 가 잠긴 파일 때문에 실패할 때 **workspace를 절반만 지우고 멈추던** 문제.

무엇이 문제였나 — `fs.rmSync` 는 트리를 훑으며 지우다 잠긴 파일에서 멈춘다. 남는 상태는
학습자 코드 절반과 `.git` 소실, 그런데 `progress.json` 은 온전. 화면에는 "다 지우지 못했다,
진도는 그대로 두었다"라고만 나와 아무것도 잃지 않은 것처럼 읽힌다. 재시도하지 않고 그냥
진행하면 **없는 코드에 대해 통과 기록만 남은 상태**가 된다.

어떻게 고쳤나 — 삭제를 두 단계로 나눴다(`dojo/workspace.mjs`).

1. 폴더를 옆 이름(`workspace.trash-<ts>`)으로 **rename** — 통째로 되거나 통째로 안 된다.
   실패하면 한 파일도 건드리지 않은 상태이므로 "아무것도 지우지 않았다"고 정직하게 말할 수 있다.
2. 옮겨 놓은 것을 `rmSync` — 여기서 실패해도 workspace는 이미 사라졌으므로 초기화를 마치고
   남은 잔해 폴더 경로를 화면에 알린다(`residuePath`).

회귀 테스트는 `test/workspace.test.mjs` 의 **`지우다 막히면 파일이 하나도 사라지지 않는다`** 다.
workspace 하위를 테스트 프로세스의 cwd로 잡아 실제 잠금을 재현한다(Windows 전용, 그 외 skip).
옛 구현에 이 테스트를 대면 파일 3개 → 1개, `.git/HEAD` 소실로 실패한다.

> **이 테스트를 지우거나 약화시키지 않는다.** 이 프로젝트에서 가장 비싼 실패는 학습자 코드
> 유실이고, 그것을 잡는 유일한 그물이다.

---

## 4. 다음에 할 일 — ch03부터 같은 틀을 반복한다

**설계는 끝났다.** 무엇을 어떤 순서로 가르치고 각 장을 어떻게 판정할지는 `CURRICULUM.md`에 있다.
11장이 하나의 프로그램(할 일 관리 CLI)을 키우고, 앞 장의 산출물이 뒷 장의 재료다.

챕터 한 장을 쓰는 절차는 `CURRICULUM.md` 5절에 단계로 적혀 있다. 요약하면:

```
content/chNN-*.yaml → scripts/solutions/chNN.mjs → index.mjs 한 줄
→ MANUAL.md 커리큘럼 표·총 스텝 수 갱신 → verify-chapter.mjs chNN → npm test
```

**커리큘럼은 끝났다.** 남은 것은 다듬기와 실사용에서 나오는 것들이다.

우선순위 순으로:

1. **사람 손으로 완주해 본다.** `npm run dojo` 로 처음부터 끝까지 한 번 밟아 보는 것이
   아직 남아 있다. 자동 검증은 판정만 보고 **읽는 경험**은 보지 않는다 — 설명이 긴지,
   힌트가 너무 이른지, 페이드 단계가 튀는지는 사람만 안다.
2. **codedojo 이식 대기분 3건**(2절)을 옮긴다. 특히 `cleanEnv()` 는 거짓 통과 차단이라 중요하다.
3. **첫 push.** `git push -u origin main` (6절).
4. 5절의 알려진 이슈들 — 전부 `--restart` 주변이고 우선순위는 낮다.

새 챕터를 더한다면 절차는 `CURRICULUM.md` 5절 그대로다.

### 챕터를 만들며 확립한 판정 도구 (본보기 파일)

| 도구 | 어디에 | 무엇을 잡나 |
|---|---|---|
| 다른 argv → 다른 출력 | `ch02-functions.yaml` | 기대 출력 하드코딩 |
| `-e` 하네스로 모듈 직접 구동 | `ch05-modules.yaml` | 판정을 학습자가 무력화하는 것 |
| 파일을 증거로 삼기 | `ch07-async.yaml` | "저장했다"는 화면상의 주장 |
| 뮤테이션 | `ch09-testing.yaml` | 아무것도 확인하지 않는 테스트 |
| 저장소 상태 판정 | `ch10-git.yaml` | "커밋했다"는 말 |
| 동작으로 패턴 판정 | `ch11-patterns.yaml` | 이름만 패턴인 껍데기 |

`test/content-integrity.test.mjs` 에 각 장의 "그럴듯한 오답"이 모여 있다.
**새 챕터를 더하면 여기에 오답과 음성 대조군을 함께 넣는다.** 대조군이 없으면
오답 테스트가 "하네스가 뭐든 거부한다"는 이유로도 초록불이 된다 — 실제로 세 번 겪었다.

### ch09에서 확립한 것 — 뮤테이션 판정

학습자가 **테스트를 쓰는** 장의 판정은 `CURRICULUM.md` 3절 "3단"에 정리해 두었다.
구현을 임시 폴더에서 망가뜨려 보고 학습자의 테스트가 잡는지 확인한다. `content/ch09-testing.yaml`
보스 검사가 본보기다(뮤테이션 4개를 한 번에 돌리고 살아남은 것을 이름으로 보고한다).

만들면서 두 번 데였다. 둘 다 **판정 장치 자체의 결함**이었다.

1. `promisify(execFile)` 은 성공하면 `code` 속성이 아예 없는 객체로 resolve한다.
   `assert.notEqual(result.code, 0)` 는 그래서 **통과해 버린다.** 성공/실패는 불리언으로 좁혀 잡는다.
2. 뒷정리를 보는 검사는 기준선이 오염돼 있으면 아무것도 못 잡는다 —
   앞선 `node --test` 검사가 학습자 workspace에 이미 그 파일을 만들어 두기 때문이다.
   샌드박스에서 **기준선을 먼저 씻고** 재야 한다.

### ch07이 남긴 판정 하네스 패턴 (ch08 이후로도 쓴다)

`-e` 안에서 **CLI를 격리 실행하고 파일을 증거로 삼는** 형태를 ch07에서 확립했다.
`content/ch07-async.yaml` 의 보스 검사가 본보기다. 핵심은 학습자 자산 보호다 —
검사가 `tasks.json` 을 건드리기 전에 백업하고 `finally` 에서 되돌린다.

```js
const keep = await readFile('tasks.json', 'utf8').catch(() => null)
const restore = async () => (keep === null
  ? rm('tasks.json', { force: true })
  : writeFile('tasks.json', keep))
try { /* 검사 */ } finally { await restore() }
```

모듈 단위 검사는 `saveTasks(tasks, file)` 의 파일 이름 인자를 써서 `tasks.check.json` 으로 돌린다 —
학습자의 진짜 목록을 아예 건드리지 않는다.

### 챕터를 쓸 때 놓치면 안 되는 것

- **판정 3단 사다리를 따른다** (`CURRICULUM.md` 3절). `fs` 문자열 검사는 보조로만 두고,
  최종 판정은 항상 실행 검사에서 난다.
- **ch05부터는 `-e` 하네스를 쓴다.** 판정 스크립트를 YAML 안에 두고 학습자 모듈을 밖에서 import해
  돌리는 방식이다. 판정 코드가 `workspace/` 밖에 있어 학습자가 무력화할 수 없다 — 이 프로젝트에서
  가장 정직한 판정이고, 디자인 패턴 장은 여기에 전적으로 기댄다.
- **오답 회귀 테스트를 함께 쓴다.** `test/content-integrity.test.mjs` 에 그 챕터의
  "그럴듯한 오답"을 넣고 통과하지 않는지 확인한다. ch02 것이 본보기다 — 하드코딩·종료 코드 누락·
  인자 무시를 각각 잡는다. **음성 대조군(정답은 통과한다) 테스트를 반드시 함께 둔다.**
  없으면 하네스가 고장 나 전부 거부해도 오답 테스트는 초록불로 남는다.
- `docs.test.mjs` 가 **모든 챕터에 `cmd` 또는 `git` 검사가 최소 하나 있도록** 강제한다.
  이 선을 낮추지 않는다.

---

## 5. 알려진 이슈 (미해결, 우선순위 낮음)

- **실패한 `--restart` 도 수동 세이브 슬롯을 하나 소비한다.** 백업은 삭제 시도 *전에*
  만들어지므로 rename이 막혀 아무것도 안 지운 경우에도 슬롯이 쌓인다. 수동 슬롯 상한은
  20이고 초과분은 오래된 것부터 정리되므로(`dojo/snapshot.mjs`), 반복 실패 시 학습자가
  직접 이름 붙인 오래된 세이브가 밀려날 수 있다.
- **`--restart` 대상 목록이 없는 것도 있는 것처럼 보인다.** workspace만 `(아직 없다)` 가
  붙고 `progress.json`·`remote.git` 은 존재 여부와 무관하게 나열된다.
- **`--restart` 와 `--reset` 을 함께 주면 `--reset` 이 조용히 무시된다.** 파괴 범위가 다른
  플래그이므로 거부하거나 명시하는 편이 안전하다.
- **`.dojo/remote.git`은 세이브에 담기지 않는다.** `ensureFakeRemote` 가 없으면 새로 만들기 때문에
  실사용에는 문제가 없다. (문구 문제는 해소됐다 — git 협업 장을 ch10으로 두기로 했고,
  안내에서 챕터 번호를 빼 `(git 협업 연습용 원격)` 으로 고쳤다. 2절 이식 대기분 참고.)

---

## 6. 저장소 상태

- 브랜치 `main`, 원격 `origin` → `https://github.com/ssj37v/jsdojo.git`.
- 커리큘럼 전권(ch01~ch11)이 `main` 에 올라가 있다.
- `workspace/`, `.dojo/` 는 gitignore 대상이다. 커밋에 섞이지 않는다.
