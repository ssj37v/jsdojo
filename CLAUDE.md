# JS Dojo — Project Instructions

이 저장소는 **혼자 공부하는 학습자가 자기 PC에서 바닐라 자바스크립트를 기초부터 디자인 패턴까지
직접 손으로 쓰고 실행하며 익히도록** 이끄는 대화형 CLI 튜토리얼 엔진이다.
모든 작업의 최우선 기준은 **검증 정직성**(학습자가 실제로 해내지 않으면 통과되지 않음)과 **학습 설계 근거**다.

프레임워크·번들러·Docker·서버는 쓰지 않는다. 학습자가 만지는 것은 `.mjs` 파일과 `node` 명령뿐이다.
엔진은 [codedojo](https://github.com/ssj37v/codedojo)(React·Next.js 커리큘럼)에서 이식했다.
**콘텐츠만 다르고 엔진은 같게 유지한다** — 그래야 한쪽의 엔진 수정을 다른 쪽으로 옮길 수 있다.
엔진(`dojo/`)에 손대야 한다면 그 변경이 양쪽 모두에 타당한지 먼저 따진다.

## 스택 / 런타임

- Node.js 22+, 순수 ESM (`.mjs`, `"type": "module"`). TypeScript·트랜스파일·빌드 단계 없음.
- 외부 런타임 의존성은 `ajv`, `yaml` 뿐. **새 dependency는 학습자 설치 부담**이므로 근거와 함께 사전 제안한다 (R04).
- 학습자 코드도 무의존이 원칙이다. 커리큘럼이 npm 패키지를 요구하기 시작하면 그 자체가 설계 실패 신호다.
- Windows 네이티브 우선. 외부 명령 실행은 반드시 플랫폼 분기를 거친다(`npm` → Windows에서 `npm.cmd`).
- 학습자 산출물은 `workspace/`(학습자 소유, 자체 git 저장소), 진도는 `.dojo/progress.json`. 둘 다 gitignore 대상이다.

## 디렉터리 계약

| 경로 | 책임 |
|---|---|
| `dojo/cli.mjs`, `runner.mjs`, `ui.mjs`, `prompt.mjs` | 표현·흐름 계층. 파일시스템·git 직접 조작 금지 |
| `dojo/verify/*` | 판정 전담. 실제 파일·exit code·git 상태로만 판정하고 학습자 자기신고를 신뢰하지 않는다 |
| `dojo/progress.mjs`, `fade.mjs` | 진도·간격반복·난이도 페이드 상태기계 |
| `dojo/snapshot.mjs` | 세이브 슬롯. 한 슬롯은 진도와 코드 한 쌍이며 둘은 절대 따로 움직이지 않는다 |
| `dojo/browse.mjs` | 지난 스텝 열람. 읽기 전용이며, 통과하지 않은 스텝의 정답·힌트는 노출하지 않는다 |
| `dojo/scenario.mjs` | 학습자 저장소를 변형하는 모듈. 모든 변형은 되돌릴 수 있어야 한다 |
| `dojo/workspace.mjs` | workspace 삭제 전담. 경로 3중 봉쇄를 통과한 것만 지운다 |
| `content/*.yaml` + `content/schema.json` | 커리큘럼 단일 진실 소스. 엔진에 학습 내용을 하드코딩하지 않는다 |

## 커리큘럼 설계 원칙

- **한 스텝 한 개념.** `concept` 필드는 하나뿐이다. 작업기억 한계 때문에 복수 도입을 금지한다.
- **실행으로 판정한다.** 문자열 매칭만으로 통과되는 스텝은 베껴 넣기로 뚫린다.
  프레임워크가 없는 만큼 `node <파일>` 실행 결과와 `node --test` 를 판정의 주력으로 쓴다.
- **누적 설계.** 챕터는 앞 챕터가 남긴 `workspace/` 위에 쌓인다. 앞 장을 건너뛰면 뒷 장이 성립하지 않아야 한다.
- **디자인 패턴은 동작으로 검증한다.** "옵저버 패턴을 썼다"를 문자열로 확인하지 말고,
  구독·해지·통지가 실제로 그렇게 동작하는지를 테스트로 확인한다.

## 운영 규약

작업 지시를 받으면 `.claude/rules/agent_directives.md`의 티어링·규칙 체계를 **먼저** 적용한다.

- `.claude/rules/agent_directives.md` — 상시 로딩. 복잡도 티어링(R00)과 불변 규칙(R02 학습자 자산 보호, R03 교차검증, R09 교착탈출, R10 검증우선, R13 검증 정직성).
- `.claude/rules/architecture_rules.md` — 파일 세그멘테이션·계층 격리 규약.
- `.claude/rules/playbooks.md` — R07/R09/R11 상세 절차(온디맨드 참조).

## 검증 (변경 후 필수)

```bash
npm test                          # node --test — 검증기·페이드·SRS·세이브 단위 및 회귀
node scripts/verify-chapter.mjs   # 챕터 전 스텝을 실제 workspace에서 전수 검증
npm run dojo                      # 실제 학습 흐름 수동 완주
```

`verify-chapter.mjs`는 **git 저장소 안에서** 검증한다. workspace가 도장 저장소 안에 있는
실제 배치를 재현하지 않으면 git 검사가 부모 저장소를 올려다보는 false pass를 놓친다.

**검증기(`dojo/verify/`)나 콘텐츠(`content/`)를 건드린 변경은 "오답이 통과되지 않는다"는 회귀 테스트 없이 완료로 보고하지 않는다.**
