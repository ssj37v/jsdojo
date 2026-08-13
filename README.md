# JS Dojo

바닐라 자바스크립트를 **기초 문법부터 디자인 패턴까지** 직접 손으로 쳐 가며 익히는 대화형 CLI 튜토리얼.

강의 영상도, 브라우저 안의 가짜 에디터도 없다. 자기 컴퓨터에 진짜 파일을 만들고, 진짜 Node로
실행하고, 진짜 git으로 커밋한다. 프레임워크는 쓰지 않는다 — 언어와 설계 그 자체가 대상이다.
도장은 옆에서 순서를 잡아 주고, 학습자가 실제로 해냈는지만 확인한다. 말로 넘어가는 통과는 없다.

## 시작하기

필요한 것은 **Node.js 22 이상**과 **git** 뿐이다. Docker도 계정도 필요 없다.

```bash
npm install
npm run dojo
```

첫 실행에서 1장이 시작된다. 중간에 `q`로 나가도 진도는 저장되고, 다시 실행하면 이어진다.

> 명령·키·문제 해결을 한데 모은 **[사용 설명서(MANUAL.md)](MANUAL.md)** 가 따로 있다.

```bash
npm run dojo -- --status         # 지금까지의 진도
npm run dojo -- --chapter ch01   # 특정 장으로 이동
npm run dojo -- --reset          # 진도만 초기화 (workspace 코드와 git 이력은 그대로)
npm run dojo -- --restart        # workspace까지 지우고 1장부터 (지우기 전 자동 저장)
```

학습자가 쓰는 코드는 `workspace/`에, 진도는 `.dojo/progress.json`에 쌓인다.
둘 다 이 저장소에 커밋되지 않는다.

## 지난 스텝 다시 보기

되돌리지 않고 **읽기만** 한다. 코드도 진도도 그대로 둔 채 지나온 설명을 다시 펼쳐 본다.

```bash
npm run dojo -- --outline           # 스텝 목차 (통과 여부·개념)
npm run dojo -- --outline ch01      # 한 챕터만
npm run dojo -- --show ch01-s02     # 그 스텝의 설명·힌트·정답·복습카드
```

학습 중에는 `b` 키로 지나온 스텝을 골라 보고 하던 자리로 돌아온다.
아직 통과하지 않은 스텝은 **목표와 스텝 번호까지만** 보이고 설명·힌트·정답은 잠겨 있다.

## 세이브 / 로드

게임처럼 여러 시점을 저장해 두고 언제든 되돌아갈 수 있다.
**세이브 한 칸에는 진도와 그 시점의 코드가 함께 담긴다** — 진도만 되돌리면 코드와 어긋나
검사가 의미를 잃기 때문이다.

```bash
npm run dojo -- --saves               # 저장된 지점 목록
npm run dojo -- --save "리팩터링 전"    # 지금 상태를 이름 붙여 저장
npm run dojo -- --load auto-ch01-s02   # 2스텝 통과 시점으로 되돌아가기
```

- **자동 체크포인트** — 스텝을 통과할 때마다 `auto-<스텝id>` 슬롯이 갱신된다.
- **수동 저장** — 학습 중에는 `w` 키로, 밖에서는 `--save`로. 최근 20개까지 유지된다.
- **되돌리기의 되돌리기** — 불러오기 직전 상태가 `auto-preload`에 자동으로 남는다.
- `node_modules`·`dist`·`coverage`는 슬롯에 담지 않는다.

마음껏 망가뜨려 보라는 뜻이다. 되돌아올 지점이 있으면 과감하게 시도하게 된다.

## 학습 중 쓰는 키

| 키 | 하는 일 |
|---|---|
| `Enter` | 지금 상태를 검사한다 |
| `h` | 힌트를 한 단계 연다 (헤맨 뒤에 열린다) |
| `b` | 지나온 스텝을 다시 본다 (코드는 그대로) |
| `w` | 지금 상태를 이름 붙여 저장한다 |
| `s` | 이 스텝을 건너뛴다 (나중에 복습 카드로 다시 만난다) |
| `q` | 저장하고 종료 |

## 어떻게 가르치는가

기억에 남는 학습에는 조건이 있다. 이 도장은 그 조건을 기능으로 구현했다.

- **3단 페이드** — 같은 개념이 다시 나올 때마다 도움이 한 겹씩 걷힌다.
  `따라치기`(완성 코드 제시) → `빈칸 채우기` → `백지에서`.
- **먼저 예측하기** — 실행 전에 결과를 먼저 맞혀 본다. 빗나간 예측을 곧바로 교정할 때 가장 오래 남는다.
- **떠올리기로 시작** — 챕터를 열면 지난 개념을 백지에서 먼저 꺼낸다.
- **간격 반복** — 맞힌 카드는 1일 → 3일 → 7일 → 21일 → 60일 간격으로 다시 나온다.
- **설명해 보고 대조하기** — 통과한 뒤 "왜 이렇게 동작하나"를 한 줄로 쓴다. 답을 낸 다음에야
  모범답안이 열리고, 빠뜨린 핵심어를 짚어 준다. **통과 여부에는 영향을 주지 않는다.**
- **힌트는 늦게 열린다** — 한 번 시도하거나 15초쯤 헤맨 뒤에야 열린다.
- **난이도가 따라온다** — 연속 실패하면 지원 단계를 되돌린다. 좌절 구간에 가두지 않는다.
- **보스 스테이지** — 챕터 끝에는 힌트 없이 그동안의 것을 모아 쓰는 과제가 나온다.

## 커리큘럼

| 장 | 주제 | 상태 |
|---|---|---|
| 1 | 코드를 실행시키다 — Node 실행, 스크립트 파일, const 바인딩 | 작성 중 |

기초 문법 → 함수와 스코프 → 배열·객체 → 비동기 → 모듈 → 객체지향 → **디자인 패턴** 순으로
확장 중이다. 챕터는 앞 장의 결과물 위에 쌓이도록 설계한다.

---

## 챕터를 직접 쓰려면

커리큘럼은 코드가 아니라 `content/*.yaml`에 있다. 새 장을 추가하는 데 엔진 수정은 필요 없다.
계약은 `content/schema.json`(JSON Schema 2020-12)이 강제하며, 위반은 로딩 시점에 잡힌다.

```yaml
id: ch02
title: "2장 · 함수로 묶는다"
goal: "반복되는 코드를 함수로 뽑아낸다"
steps:
  - id: ch02-s01
    concept: function-declaration   # 이 스텝이 도입하는 새 개념 하나 (복수 금지)
    kind: edit                      # command | edit | inspect
    goal: "인사를 함수로 만든다"
    teach: |
      설명을 여기에 쓴다.
    predict:                        # (선택) 실행 전 예측 질문
      question: "이 코드는 무엇을 출력할까?"
      answer_pattern: "안녕"
      reveal: "인자로 넘긴 값이 그대로 찍힌다."
    fade:                           # (선택) 3단 제시. fill에는 반드시 ____ 가 있어야 한다
      copy: "function greet(name) { return `안녕, ${name}` }"
      fill: "function greet(____) { return `안녕, ${____}` }"
      recall: "이름을 받아 인사말을 돌려주는 함수를 만든다"
    hints:                          # 정확히 3단 (관찰 → 위치 → 코드). boss 스텝에는 쓸 수 없다
      - "같은 문장을 두 번 적고 있다면 묶을 때가 된 것이다"
      - "hello.mjs 위쪽에 함수를 선언한다"
      - "function greet(name) { return `안녕, ${name}` } 를 적는다"
    verify:                         # 하나라도 실패하면 통과가 아니다
      - type: fs
        label: "함수를 선언했다"
        path: hello.mjs
        matches: ['function\s+greet']
      - type: cmd
        label: "실행 결과가 맞다"
        run: ["node", "hello.mjs"]
        expect_output: "안녕, 자바스크립트"
    explain:                        # (선택) 통과 후 자기설명. 채점하지 않는다
      question: "같은 코드를 그냥 두 번 적으면 나중에 무엇이 곤란해지나?"
      model_answer: |
        고칠 곳이 두 군데가 된다. 하나만 고치면 두 동작이 갈라지고, 그 차이는 한참 뒤에 발견된다.
      keywords:
        - term: "고칠"
          nudge: "수정할 때 무슨 일이 벌어지는지 떠올려 본다"
    review_card:                    # 간격 반복에 등록될 인출 카드
      front: "값을 돌려주는 키워드는?"
      back: "return"
```

### 상황 연출

스텝에 `setup` 블록을 두면 그 스텝에 들어갈 때 학습자 저장소에 상황이 주입된다.
현재 등록된 시나리오는 git 협업용 두 가지(`ensure_remote`, `teammate_push`)다.
새 상황(예: 리팩터링할 레거시 코드 심기)이 필요하면 `dojo/scenario.mjs`에 등록하고
`content/schema.json`의 `setup.scenario` enum에 추가한다 — **엔진 변경이므로 회귀 테스트를 동반한다.**

세 가지가 지켜진다: **알리고**(announce는 필수), **한 번만**(스텝당 1회, 진도에 기록),
**되돌릴 수 있게**(세이브를 로드하면 주입 기록도 함께 돌아가 다시 연출된다).

### 검사 종류

| type | 쓰는 곳 | 주요 필드 |
|---|---|---|
| `fs` | 파일 내용 확인 | `path`(workspace 기준 상대경로), `exists`, `matches`, `not_matches`, `json_has` |
| `cmd` | 실제 실행 결과 | `run`(고정 argv 배열), `cwd`(`workspace`\|`root`), `expect_exit`, `expect_output`, `reject_output` |
| `git` | 저장소 상태 | `assert`(`repo_exists`, `has_commit`, `clean_worktree`, `branch_is`, `tracked`, `ignored`, `commit_message_matches`), `value` |

`git` 검사는 **workspace 자신이 저장소 루트일 때만** 통과한다. git은 저장소를 못 찾으면
상위 폴더로 올라가므로, 이 가드가 없으면 학습자가 `git init`을 하지 않아도 도장 저장소가
잡혀 통과해 버린다.

**검사를 설계할 때의 원칙**: 파일 안의 문자열만 보는 검사는 베껴 넣기로 뚫린다.
프레임워크가 없는 대신 이 도장에는 더 좋은 무기가 있다 — **실행 검사**다.
`node <파일>` 로 출력을 확인하거나, `node --test` 로 미리 준비한 테스트를 돌리면
"베껴 넣었는가"가 아니라 "동작하는가"로 판정할 수 있다. 코드를 고치는 스텝에는 실행 검사를 함께 둔다.

### 챕터를 검증하는 법

```bash
npm test                               # 엔진 단위·회귀 테스트 + 콘텐츠 계약 검사
node scripts/verify-chapter.mjs        # 임시 폴더에서 전 챕터를 실제로 돌려 본다
node scripts/verify-chapter.mjs ch02   # ch01부터 ch02까지만 (챕터는 누적된다)
```

챕터는 앞 챕터의 결과물 위에 쌓이므로 검증도 누적으로 돈다.
`verify-chapter.mjs`는 각 스텝에 대해 두 가지를 확인한다.

1. 아무것도 하지 않은 상태에서는 **통과하지 않는다** (검사가 헐겁지 않다)
2. 정답을 적용하면 **통과한다** (검사가 과하지 않다)

새 챕터를 추가하면 `scripts/solutions/<챕터id>.mjs` 에 각 스텝의 정답 조작을 쓰고
`scripts/solutions/index.mjs` 에 한 줄 더한다. 정답이 등록되지 않은 스텝은 검증에서 실패로 잡힌다.

## 구조

```
dojo/
  cli.mjs            진입점 (인자 해석)
  runner.mjs         스텝 루프: 제시 → 작업 → 검증 → 피드백
  ui.mjs             터미널 렌더
  prompt.mjs         입력 수집
  fade.mjs           3단 페이드 상태기계
  progress.mjs       진도·간격 반복 (원자적 저장)
  snapshot.mjs       세이브 슬롯 (진도 + 코드 한 쌍)
  browse.mjs         지난 스텝 열람 (읽기 전용, 스포일러 잠금)
  review.mjs         워밍업 인출 세션
  content-loader.mjs 커리큘럼 로딩·계약 검증
  scenario.mjs       상황 연출 (학습자 저장소를 건드리는 유일한 모듈)
  workspace.mjs      workspace 삭제 (경로 3중 봉쇄)
  paths.mjs          경로 봉쇄
  config.mjs         상수 단일 출처
  verify/            판정 — 실제 파일·종료 코드·git 상태만 신뢰한다
content/             커리큘럼 (schema.json + 장별 YAML)
scripts/             운영 스크립트
test/                node --test
```

## 문서

| 문서 | 대상 | 내용 |
|---|---|---|
| [MANUAL.md](MANUAL.md) | 학습자 | 명령 전체, 학습 중 키, 문제 해결 |
| README.md (이 문서) | 전체 | 프로젝트 소개, 학습 설계, 챕터 작성법 |
| CLAUDE.md | 기여자 | 디렉터리 계약과 작업 규약 |

엔진은 [codedojo](https://github.com/ssj37v/codedojo)(React·Next.js 커리큘럼)에서 그대로 이식했다.
콘텐츠만 다르고 엔진은 같으므로, 한쪽의 엔진 수정은 다른 쪽으로 옮겨올 수 있다.
