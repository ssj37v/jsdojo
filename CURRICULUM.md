# 커리큘럼 설계도

이 문서는 **무엇을 어떤 순서로 가르치고, 각 장을 어떻게 판정할지**에 대한 단일 설계 근거다.
챕터 YAML을 쓰는 문법은 [README.md](README.md)의 "챕터를 직접 쓰려면"에 있다. 여기 있는 것은 그 위의 층 —
장 경계를 왜 이렇게 그었고, 어느 장이 어느 장을 전제하며, 각 장의 판정을 무엇으로 떠받치는지다.

새 챕터를 쓰기 전에 이 문서를 먼저 읽는다. 설계를 바꾸려면 코드보다 이 문서를 먼저 고친다.

---

## 1. 관통 산출물 — 할 일 관리 CLI

11개 장이 **하나의 프로그램**을 키운다. 장마다 다른 예제를 쓰지 않는 이유는 두 가지다.

- **누적이 곧 검증이다.** 앞 장을 건너뛰면 뒷 장의 파일이 없어 판정이 성립하지 않는다.
  "이해했다고 생각하고 넘어가기"가 구조적으로 막힌다.
- **디자인 패턴이 억지가 아니게 된다.** 패턴은 코드가 자라서 불편해졌을 때 나오는 답이다.
  10장까지 학습자 손으로 자란 CLI가 있어야 11장의 "이제 갈아 끼워야 한다"가 실감난다.

```
workspace/
  hello.mjs        ch01 — 실행 순환을 익힌 흔적. 끝까지 지우지 않는다
  app.mjs          ch02~ — CLI 진입점. argv를 읽고 명령을 고른다
  lib/
    tasks.mjs      ch05~ — 할 일 목록 로직
    store.mjs      ch07~ — 파일 영속
    ...            ch11  — 전략·옵저버·커맨드로 갈라진다
  test/            ch09~ — 학습자가 직접 쓴 테스트
  tasks.json       ch07~ — 실제 데이터
```

`workspace/`는 학습자 소유다. 도장이 파일을 놓을 때는 `seed_files`를 거치며, **이미 있는 파일은 절대 덮어쓰지 않는다**.

---

## 2. 장 배치

concept는 스텝당 하나다(스키마 강제). 아래는 각 장이 **도입하는 새 개념**의 목록이며, 순서가 곧 스텝 순서다.
`(boss)`는 힌트 없이 그 장의 개념을 조합시키는 마지막 스텝이다.

| 장 | 제목 | 새 개념 (스텝 순서) | 산출물 | 판정 주력 |
|---|---|---|---|---|
| ch01 | 코드를 실행시키다 | `node-runtime` · `script-file` · `const-binding` | `hello.mjs` | `node hello.mjs` 출력 |
| ch02 | 함수로 묶는다 | `function-declaration` · `return-value` · `conditional` · `parameter-default` · `process-argv` · `process-exit` · (boss) | `app.mjs` | **다른 argv → 다른 출력** |
| ch03 | 목록을 담는다 | `array-literal` · `array-index` · `array-push` · `object-literal` · `object-mutation` · (boss) | 메모리 상의 할 일 배열 | 실행 출력 |
| ch04 | 훑고 고른다 | `for-of` · `block-scope` · `arrow-function` · `array-map` · `array-filter` · `array-find` · (boss) | 목록 렌더링 | 실행 출력 |
| ch05 | 파일을 나눈다 | `export-named` · `import-statement` · `default-export` · `module-scope` · (boss) | `lib/tasks.mjs` | **`-e` 하네스** |
| ch06 | 잘못된 입력을 막는다 | `throw-error` · `try-catch` · `custom-error` · `guard-clause` · (boss) | 입력 검증 | `-e` + `expect_exit` |
| ch07 | 기다렸다 이어간다 | `promise` · `async-await` · `fs-promises` · `error-propagation` · (boss) | `tasks.json` 영속 | `-e` + 파일 상태 |
| ch08 | 틀을 만든다 | `class-syntax` · `constructor` · `method` · `private-field` · `getter` · (boss) | `TaskStore` 클래스 | `-e` 하네스 |
| ch09 | 스스로 검증한다 | `node-test` · `assert-strict` · `test-isolation` · `test-first` · (boss) | 학습자가 쓴 테스트 | `node --test` + **뮤테이션** |
| ch10 | 이력을 남긴다 | `git-init` · `git-commit` · `gitignore` · `remote-push` · `pull-conflict` · (boss) | git 이력 | `git` 검사 + `teammate_push` |
| ch11 | 갈아 끼운다 | `strategy` · `observer` · `command` · `factory` · `singleton-module` · (boss) | 패턴 리팩터링 | **`-e` 하네스 + `seed_files`** |

### 누적 관계 — 앞 장을 건너뛰면 성립하지 않는다

| 장 | 무엇을 전제하는가 |
|---|---|
| ch03 | ch02의 `app.mjs`와 `formatTask` — 배열의 각 항목을 그 함수로 찍는다 |
| ch04 | ch03의 할 일 배열 — 순회·필터·변환의 대상이 없으면 성립하지 않는다 |
| ch05 | ch04까지 한 파일에 쌓인 로직 — 파일이 길어졌다는 **체감**이 모듈 분리의 동기다 |
| ch06 | ch05의 `lib/tasks.mjs` — 검증은 그 모듈의 경계에서 이뤄진다 |
| ch07 | ch06의 던지는 에러 — 비동기에서 에러가 어떻게 전파되는지가 이 장의 절반이다 |
| ch08 | ch07의 흩어진 함수들 — 상태와 함수가 같이 다닌다는 것이 클래스의 근거다 |
| ch09 | ch08의 `TaskStore` — 테스트할 대상이 있어야 테스트를 배운다 |
| ch10 | ch09까지의 전체 코드 — 커밋할 것이 쌓여 있어야 버전 관리가 의미를 갖는다 |
| ch11 | **ch09의 테스트** — 리팩터링은 초록불이 있어야 안전하다. 이 순서를 뒤집지 않는다 |

ch09(테스트)를 ch11(패턴) 앞에 두는 것은 설계상 양보하지 않는다. 테스트 없이 하는 구조 변경은
학습자에게 "고쳤는데 뭐가 깨졌는지 모르는" 경험을 주고, 그것이 패턴에 대한 인상을 망친다.

---

## 3. 판정 설계 — 3단 사다리

이 도장에는 `npm run build` 같은 기댈 곳이 없다. 대신 **실행 검사**가 더 강력하다.
아래 세 단은 학습자가 "정답을 베껴 넣는 것"과 "실제로 해내는 것"을 어떻게 갈라내는지의 사다리다.

### 0단 — `fs` 문자열 검사는 보조로만

파일 안에 `function formatTask` 가 있는지 보는 검사는 **베껴 넣기로 뚫린다.**
쓰지 말라는 뜻이 아니라 **단독으로 두지 말라**는 뜻이다. `fs` 검사는 "무엇을 고쳐야 하는지 짚어 주는 피드백"으로
값어치가 있다 — 실행 검사보다 먼저 두면 학습자가 받는 실패 메시지가 훨씬 구체적이다.

`test/docs.test.mjs`의 `커리큘럼이 실행 검사 없이 문자열 매칭만으로 통과되지 않는다` 가
모든 챕터에 `cmd` 또는 `git` 검사가 최소 하나 있도록 강제한다. **이 선을 낮추지 않는다.**

### 1단 — 다른 입력, 다른 출력 (ch02~ch04)

모듈(`export`)을 배우기 전에는 학습자 코드를 밖에서 import할 수 없다. 이 구간의 무기는
**같은 파일을 서로 다른 argv로 두 번 실행해, 각각 다른 출력을 요구하는 것**이다.

```yaml
verify:
  - type: cmd
    label: "제목을 인자로 받는다"
    run: ["node", "app.mjs", "우유 사기"]
    expect_output: "우유 사기"
  - type: cmd
    label: "다른 제목을 주면 다른 결과가 나온다"
    run: ["node", "app.mjs", "빨래 개기"]
    expect_output: "빨래 개기"
    reject_output: "우유 사기"      # 출력을 하드코딩했다면 여기서 걸린다
```

기대 출력을 그대로 박아 넣은 코드는 **두 번째 검사에서 반드시 실패한다.** 두 검사는 짝이며, 하나만 두지 않는다.

### 2단 — 학습자 코드를 밖에서 구동한다 (ch05~)

모듈을 배운 뒤부터는 판정 스크립트를 **콘텐츠 YAML 안에** 두고 학습자 모듈을 직접 import해 돌린다.

```yaml
verify:
  - type: cmd
    label: "구독을 해지하면 더 이상 통지가 오지 않는다"
    run:
      - node
      - --input-type=module
      - -e
      - |
        import { Emitter } from './lib/emitter.mjs'
        import assert from 'node:assert/strict'
        const bus = new Emitter()
        const seen = []
        const off = bus.on('task:added', (t) => seen.push(t))
        bus.emit('task:added', '우유 사기')
        off()
        bus.emit('task:added', '빨래 개기')
        assert.deepEqual(seen, ['우유 사기'], '해지 후에는 통지가 오면 안 된다')
```

이 방식이 이 프로젝트에서 가장 정직한 판정이다. 이유는 하나다 —
**판정 코드가 `workspace/` 밖에 있으므로 학습자가 무력화할 수 없다.**
workspace에 심어 준 테스트 파일은 지우거나 약하게 고칠 수 있지만, YAML 안의 하네스는 그럴 수 없다.

동작 근거(실측 확인):

- `node --input-type=module -e` 의 **상대 import는 cwd 기준으로 해석된다.** `cmd` 검사의 기본 cwd가
  `workspace`이므로 `./lib/…` 가 학습자 파일을 정확히 가리킨다.
- `node` 는 `dojo/verify/run-process.mjs` 의 `WINDOWS_SHIMS` 에 없어 **cmd.exe를 경유하지 않는다.**
  따라서 argv에 개행·따옴표·한글을 그대로 넣어도 안전하다(`planSpawn` 의 메타문자 검사는 shim 전용).
- 실패하면 `assert` 가 종료 코드 1을 내고, 그 메시지가 학습자 화면에 그대로 뜬다 — 힌트 대신 쓰기 좋다.

**디자인 패턴은 이름이 아니라 동작으로 판정한다.** `matches: ['class\s+\w+Strategy']` 같은 검사는
패턴을 흉내 낸 껍데기를 통과시킨다. 대신 이렇게 묻는다 — 전략을 **바꿔 끼우면 결과가 실제로 달라지는가**,
구독을 **해지하면 통지가 멈추는가**, 커맨드를 **되돌리면 상태가 돌아오는가**.

### 3단 — 학습자의 테스트를 시험한다 (ch09)

학습자가 **테스트를 쓰는** 장에서는 판정이 한 겹 더 필요하다. 테스트 파일은 `workspace/` 안에 있어
학습자가 얼마든지 약하게 쓸 수 있고, `assert.ok(true)` 한 줄도 `node --test` 는 초록불로 통과시킨다.
"테스트를 썼다"와 "그 테스트가 무언가를 지킨다"는 전혀 다른 말이다.

그래서 **구현을 일부러 망가뜨려 보고, 학습자의 테스트가 그것을 잡아내는지**로 판정한다(뮤테이션 검사).

```js
// workspace 를 통째로 임시 폴더에 복사한 뒤 거기서만 망가뜨린다.
// 학습자 파일은 한 글자도 건드리지 않는다.
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'dojo-mutate-'))
let survived
try {
  await cp('.', sandbox, { recursive: true })
  await writeFile(path.join(sandbox, 'lib', 'format.mjs'), BROKEN)
  await run(process.execPath, ['--test'], { cwd: sandbox })
  survived = true            // 테스트가 통과했다 = 망가진 것을 못 잡았다
} catch {
  survived = false           // 테스트가 실패했다 = 잡았다
} finally {
  await rm(sandbox, { recursive: true, force: true })
}
assert.equal(survived, false, '구현을 망가뜨렸는데도 테스트가 통과했다')
```

**성공/실패를 불리언으로 직접 좁혀 잡는다.** `promisify(execFile)` 은 성공하면 `code` 자체가 없는
객체로 resolve하므로, `assert.notEqual(result.code, 0)` 같은 검사는 **통과해 버린다**(거짓 통과).
종료 코드를 볼 때는 `assert.equal(result.code, 1)` 처럼 값을 못 박거나, 위처럼 불리언을 쓴다.

### 판정을 쓸 때의 순서

1. `fs` 검사를 먼저 둔다 — 실패 메시지가 구체적이어야 학습자가 어디를 볼지 안다.
2. 그 뒤에 실행 검사를 둔다 — 최종 판정은 항상 여기서 난다.
3. **판정을 새로 만들면 "틀린 구현으로 돌려 보고 실제로 실패하는지" 손으로 확인한다.**
   통과해 버리면 그 판정은 없는 것과 같다.

---

## 4. `seed_files` 사용 지침

`setup.scenario: seed_files` 는 스텝의 전제가 되는 파일을 workspace에 놓는다.
**주 용도는 ch11의 "리팩터링할 레거시 코드 심기"** 다 — "이 코드를 전략 패턴으로 바꿔라"는 과제는
바꿀 대상이 먼저 있어야 성립한다.

```yaml
setup:
  scenario: seed_files
  announce: "정렬 로직이 if 사슬로 뭉쳐 있는 lib/legacy-sort.mjs 를 놓아 두었다. 이걸 갈아 끼운다."
  files:
    - path: "lib/legacy-sort.mjs"
      content: |
        export function sortTasks(tasks, how) {
          if (how === 'title') { … }
          else if (how === 'created') { … }
        }
```

지켜야 할 것:

- **심는 경로는 항상 새 경로여야 한다.** 이미 있는 파일은 덮어쓰지 않고 건너뛰므로(학습자 자산 보호),
  기존 파일을 겨냥하면 상황이 조용히 연출되지 않은 채 스텝이 시작된다.
- `announce` 는 필수다. 학습자 저장소가 몰래 바뀌는 일은 없다.
- 스텝당 한 번만 적용된다(`progress.setups`). 세이브를 되돌리면 그 기록도 함께 돌아가 다시 연출된다.
- **테스트 파일을 심어 "이걸 통과시켜라"로 쓰지 않는다.** 그건 3절 2단 하네스로 푼다 —
  workspace에 있는 테스트는 학습자가 고칠 수 있다.

---

## 5. 챕터 한 장을 쓰는 절차

```
1. 이 문서에서 그 장의 concept 목록과 전제를 확인한다
2. content/chNN-<슬러그>.yaml 작성
     - 스텝당 concept 하나. 앞 장에서 쓴 concept 이름을 재사용하지 않는다
     - edit 스텝에는 fade 3단(fill에 ____ 필수)과 hints 정확히 3단
     - boss 스텝에는 hints를 넣지 않는다(스키마가 금지한다)
     - 판정은 3절 사다리를 따른다
3. scripts/solutions/chNN.mjs 작성 — 각 스텝의 "정답 상태"를 만드는 조작
4. scripts/solutions/index.mjs 에 한 줄 추가
5. MANUAL.md 커리큘럼 표와 총 스텝 수 갱신 (test/docs.test.mjs 가 대조한다)
6. node scripts/verify-chapter.mjs chNN — 스텝별 양방향 확인
7. npm test
8. npm run dojo -- --chapter chNN — 사람 손으로 완주
```

6번이 확인하는 것은 두 가지다. **아무것도 하지 않으면 통과하지 않는다**(검사가 헐겁지 않다)와
**정답을 적용하면 통과한다**(검사가 과하지 않다). 둘 중 하나라도 깨지면 그 챕터는 완성이 아니다.
