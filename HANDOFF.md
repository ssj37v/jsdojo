# 인수인계 — JS Dojo

이 문서는 **다음 세션이 이 저장소를 처음 열었을 때** 필요한 것만 담는다.
프로젝트 규약은 `CLAUDE.md`, 학습자 사용법은 `MANUAL.md`, 챕터 작성 계약은 `README.md`에 있다.
여기 있는 것은 그 문서들이 말하지 않는 것 — **왜 지금 이 상태인지, 다음에 무엇을 해야 하는지**다.

작성 시점: 2026-08-13

---

## 1. 지금 어디까지 되어 있나

**엔진은 완성되어 있고 검증됐다. 커리큘럼이 비어 있다.**

| 영역 | 상태 |
|---|---|
| 엔진 (`dojo/` 20개 모듈) | codedojo에서 이식 완료. 기동·판정·세이브·진도 전부 동작 확인 |
| 콘텐츠 계약 (`content/schema.json`) | 그대로 사용. 수정 없음 |
| 커리큘럼 (`content/*.yaml`) | **ch01 3스텝뿐** — 엔진 기동 확인용 씨앗 |
| 정답 픽스처 (`scripts/solutions/`) | ch01만 |
| 테스트 | 103개 통과 |

확인된 것:

```
npm test                        → 103 pass / 0 fail
node scripts/verify-chapter.mjs → ch01 3스텝 양방향 통과
                                  (미이행 시 실패 / 정답 적용 시 통과)
npm run dojo -- --chapter ch01  → 도입부·예측·실제 node -v 판정·진도 저장까지 실기동
```

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

## 4. 다음에 할 일

### (1) 커리큘럼 설계 — 가장 큰 덩어리

아직 아무것도 정해지지 않았다. 목표는 **바닐라 JS 기초 → 디자인 패턴**이다.
설계할 때 먼저 정해야 하는 것:

- **챕터 경계와 각 장의 `concept` 배치.** 한 스텝에 개념 하나가 스키마 강제 사항이다.
- **누적 구조.** 챕터는 앞 장이 남긴 `workspace/` 위에 쌓인다. ch05가 ch03의 결과물을
  리팩터링하는 식이면 학습 효과와 검증 정직성이 함께 올라간다.
- **무엇을 만들며 배울 것인가.** codedojo는 "대시보드를 만든다"는 서사가 9장을 관통한다.
  이쪽도 하나의 산출물(예: 작은 이벤트 기반 라이브러리, CLI 도구)을 관통시키는 편이
  디자인 패턴 장까지 자연스럽게 이어진다.

작업 순서는 챕터당: `content/chNN-*.yaml` 작성 → `scripts/solutions/chNN.mjs` 작성 →
`scripts/solutions/index.mjs` 에 한 줄 추가 → `node scripts/verify-chapter.mjs chNN` 로 전수 검증.

### (2) `setup.scenario` 확장 — 커리큘럼 착수 전에 결정할 것

현재 등록된 시나리오는 git 협업용 둘뿐이다: `ensure_remote`, `teammate_push`
(`dojo/scenario.mjs` + `content/schema.json` 의 enum).

디자인 패턴 장에서 거의 확실히 필요해지는 것이 빠져 있다:

- **리팩터링할 레거시 코드를 미리 심어 주기** — "이 코드를 전략 패턴으로 바꿔라" 류 과제의 전제
- **통과시켜야 할 테스트 파일을 배치하기** — `node --test` 로 판정하는 스텝의 전제

이건 **엔진 변경**이고 학습자 저장소를 변형하므로 R13 트리거 + Standard 티어다.
시나리오는 `announce`(무슨 일이 벌어졌는지 알림)와 되돌리기 가능성이 계약이다.
codedojo에는 필요 없는 기능이므로, 여기서만 갖는 첫 번째 엔진 차이가 된다 —
**2절의 차이 목록에 반드시 추가하고 codedojo 쪽에도 넣을지 판단한다.**

### (3) 판정 설계에서 놓치지 말 것

프레임워크가 없으므로 `npm run build` 같은 기댈 곳이 없다. 대신 실행 검사가 더 강력하다.

- 문자열 매칭(`fs` 검사)만으로 통과되는 스텝은 정답을 베껴 넣으면 뚫린다.
- `docs.test.mjs` 의 **`커리큘럼이 실행 검사 없이 문자열 매칭만으로 통과되지 않는다`** 테스트가
  모든 챕터에 `cmd` 또는 `git` 검사가 최소 하나 있도록 강제한다. 이 선을 낮추지 않는다.
- 디자인 패턴은 "패턴 이름을 썼는가"가 아니라 **동작으로** 판정한다.
  예: 옵저버라면 구독·해지·통지가 실제로 그렇게 도는지 `node --test` 로 확인한다.

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
- **`.dojo/remote.git`(7장 연습용 원격)은 세이브에 담기지 않는다.** `ensureFakeRemote` 가
  없으면 새로 만들기 때문에 실사용에는 문제가 없다. 다만 jsdojo 커리큘럼이 git 협업 장을
  갖지 않는다면 `--restart` 의 안내 문구에서 "7장 연습용 원격"이라는 표현을 손봐야 한다
  (`dojo/cli.mjs` 의 `restart()`).

---

## 6. 저장소 상태

- 브랜치 `main`, 원격 `origin` → `https://github.com/ssj37v/jsdojo.git` 연결됨.
- **아직 push하지 않았다.** 첫 push는 `git push -u origin main`.
- `workspace/`, `.dojo/` 는 gitignore 대상이다. 커밋에 섞이지 않는다.
