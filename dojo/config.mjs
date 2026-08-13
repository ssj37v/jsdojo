// 동작을 바꾸는 상수의 단일 출처. 로직 파일에 매직 넘버를 흩뿌리지 않는다.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const CONTENT_DIR = path.join(ROOT, 'content');
export const WORKSPACE_DIR = path.join(ROOT, 'workspace');
export const DOJO_DIR = path.join(ROOT, '.dojo');
export const PROGRESS_FILE = path.join(DOJO_DIR, 'progress.json');
export const FAKE_REMOTE_DIR = path.join(DOJO_DIR, 'remote.git');
export const SAVES_DIR = path.join(DOJO_DIR, 'saves');

// 세이브 슬롯에 담지 않는 것들. 다시 만들 수 있고 무겁기만 하다.
export const SNAPSHOT_EXCLUDE = ['node_modules', 'dist', 'coverage', '.cache'];

// 로드 직전 상태를 담는 특수 슬롯. 잘못 불러와도 한 번은 되돌릴 수 있다.
export const PRELOAD_SLOT_ID = 'auto-preload';

// 자동 슬롯은 스텝 수만큼만 쌓이므로 상한이 필요 없다. 수동 슬롯만 제한한다.
export const MANUAL_SLOT_LIMIT = 20;

// 외부 명령 실행 한도. npm install이 느릴 수 있어 넉넉하게 잡는다.
export const CMD_LIMITS = {
  timeoutMs: 180_000,
  maxOutputBytes: 65_536,
};

// 3단 페이드 승강등 임계값 (플로우 채널 유지)
// 개념은 재등장할 때마다 지원이 한 단계씩 걷힌다. 연속 실패 시에만 되돌린다.
export const FADE = {
  levels: ['copy', 'fill', 'recall'],
  promoteAfterSuccesses: 1,
  demoteAfterFailures: 2,
};

// 간격 반복 스케줄. 인출 성공 횟수에 따라 다음 복습 간격이 늘어난다.
export const SRS_INTERVAL_DAYS = [1, 3, 7, 21, 60];

// 힌트 지연 개방 — 즉답 힌트는 학습을 파괴한다(desirable difficulty).
export const HINT = {
  unlockAfterMs: 15_000,
  unlockAfterFailures: 1,
};

// 챕터 시작 시 출제할 워밍업 인출 카드 수
export const WARMUP_CARD_COUNT = 3;

export const CONTENT_MAX_BYTES = 262_144;
