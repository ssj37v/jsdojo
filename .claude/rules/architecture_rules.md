# Architecture & Context Economy Rules — JS Dojo

## 0. Core Philosophy (컨텍스트 경제성)
LLM의 컨텍스트 윈도우는 희소 자원이다. 모든 구조 설계와 코드 분리의 절대적 기준은 **"작업 시 읽어야 하는 코드 라인 수를 최소화하는 것"**이다.

---

## 1. File Micro-Segmentation (파일 마이크로 세그멘테이션)
- **SRP 엄수:** 하나의 `.mjs` 파일은 오직 하나의 역할만 수행한다. `dojo/`의 파일당 소규모 분리 원칙을 유지한다.
- **Max Lines Limit:** 한 파일이 300라인을 초과하면 즉시 로직 분리(리팩토링)를 제안·실행한다.
- **응집도:** 함께 자주 수정되는 코드는 같은 디렉토리에 두되 물리 파일은 분리하고, ESM `export`로 외부에 노출한다.

## 2. Abstraction & Interface-Driven (추상화 및 인터페이스 주도)
- **계약 우선:** 모듈을 가져다 쓸 때 내부 구현이 아니라 `export` 시그니처(입력/출력)만 읽고 코드를 작성할 수 있어야 한다.
- **외부 계약 문서화:** 콘텐츠 계약은 `content/schema.json`, 학습자·작성자용 사용 계약은 `README.md`가 단일 진실 소스다. 변경 시 이 계약 문서를 동기화한다.
- **블랙박스화:** `verify/cmd-check.mjs`(프로세스 실행), `progress.mjs`(영속) 등 어댑터는 상위 계층이 구현을 몰라도 되도록 명확한 함수 경계를 유지한다.

## 3. Strict Layer Isolation (엄격한 계층 격리)
관심사가 섞인 코드는 컨텍스트 오염과 판정 회귀를 유발한다. 아래 계층은 하나의 파일에 혼재할 수 없다.

| 계층 | 대표 파일 | 책임 (그 외 금지) |
|---|---|---|
| **CLI/Entry** | `dojo/cli.mjs` | 인자 파싱, 챕터 선택, 종료 코드. **판정 로직·파일 조작 금지** |
| **Flow/Presentation** | `runner.mjs`, `ui.mjs`, `prompt.mjs` | 스텝 루프, 터미널 렌더, 입력 수집. **파일시스템·git 직접 조작 금지** |
| **Verify** | `verify/{index,fs-check,cmd-check,git-check}.mjs` | 판정 전담. **학습자 자기신고 불신**, 실제 파일 내용·exit code·git 상태만 신뢰 |
| **Learning state** | `progress.mjs`, `fade.mjs` | 진도·간격반복 스케줄·난이도 승강등. 순수 로직 + 원자적 영속 |
| **Content** | `content-loader.mjs`, `content/*.yaml` | 커리큘럼 로딩·스키마 검증. **학습 내용을 엔진 코드에 하드코딩 금지** |
| **Learner workspace 조작** | `scenario.mjs` | 학습자 저장소를 변형하는 유일한 모듈. 경로 봉쇄·되돌리기 보유 |

- **경계 침범 금지:** UI가 파일을 직접 읽거나, 검증기가 터미널에 출력하거나, 학습 내용 문자열을 엔진 코드에 박아 넣는 것을 금지한다.

## 4. Hierarchical Context Retrieval (계층적 컨텍스트 주입)
파일 전체를 무턱대고 읽지 않는다.
1. **High-Level:** 판정 관련이면 `dojo/verify/index.mjs`, 구조 관련이면 `CLAUDE.md`의 디렉터리 계약 표를 먼저 확인.
2. **Contract:** 대상 모듈의 `export` 시그니처와 계약 문서(`content/schema.json` / `README.md`) 확인.
3. **Implementation:** 수정이 불가피한 단일 구현 파일만 최종 열람.

## 5. State & Config Externalization (상태 및 설정 외부화)
- 타임아웃·출력 상한·승강등 임계값·SRS 간격·힌트 지연 시간 등 **동작을 바꾸는 매직 넘버**는 로직 파일에 흩뿌리지 않는다. `dojo/config.mjs` 한 곳에 모은다.
- 학습 내용(설명·힌트·정답 패턴·검증 선언)은 코드가 아니라 `content/*.yaml`에 둔다. 새 챕터 추가가 **코드 변경 없이** 가능해야 한다.
- 경로 상수(`workspace/`, `.dojo/`)도 config에서 단일 정의하여 경로 봉쇄 검사를 한 곳에서 할 수 있게 유지한다.
