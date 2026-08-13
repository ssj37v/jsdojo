// 세이브 슬롯. 한 슬롯은 "그 시점의 진도 + 그 시점의 코드" 한 쌍이다.
// 진도만 되돌리면 코드와 어긋나 검사가 그냥 통과해 버리므로 둘은 항상 함께 움직인다.
import fs from 'node:fs';
import path from 'node:path';
import {
  MANUAL_SLOT_LIMIT,
  PRELOAD_SLOT_ID,
  SAVES_DIR,
  SNAPSHOT_EXCLUDE,
  WORKSPACE_DIR,
} from './config.mjs';
import { isInside } from './paths.mjs';

const SLOT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function defaults(dirs = {}) {
  return {
    savesDir: dirs.savesDir ?? SAVES_DIR,
    workspaceDir: dirs.workspaceDir ?? WORKSPACE_DIR,
  };
}

function slotPath(savesDir, id) {
  if (!SLOT_ID_PATTERN.test(id)) throw new Error(`쓸 수 없는 슬롯 이름이다: ${id}`);
  const target = path.resolve(savesDir, id);
  if (!isInside(path.resolve(savesDir), target)) throw new Error(`슬롯 경로가 범위를 벗어난다: ${id}`);
  return target;
}

/** node_modules 같은 재생성 가능한 것은 슬롯에 담지 않는다. */
function shouldCopy(source, base) {
  const relative = path.relative(base, source);
  if (relative === '') return true;
  return !relative.split(path.sep).some((segment) => SNAPSHOT_EXCLUDE.includes(segment));
}

export function makeSlotId({ kind, stepId, now = new Date() }) {
  if (kind === 'preload') return PRELOAD_SLOT_ID;
  if (kind === 'auto') {
    if (!stepId) throw new Error('자동 슬롯에는 stepId가 필요하다');
    return `auto-${stepId}`;
  }
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  return `save-${stamp}`.toLowerCase();
}

/**
 * 지금 상태를 슬롯 하나로 남긴다. 같은 id가 있으면 덮어쓴다.
 * 임시 폴더에 완성한 뒤 교체하므로 중간에 죽어도 기존 슬롯이 깨지지 않는다.
 */
export function saveSnapshot({ progress, chapterId = null, stepId = null, label = '', kind = 'manual', now = new Date(), dirs } = {}) {
  const { savesDir, workspaceDir } = defaults(dirs);
  const id = makeSlotId({ kind, stepId, now });
  const target = slotPath(savesDir, id);

  const meta = {
    id,
    kind,
    label: label || defaultLabel({ kind, chapterId, stepId }),
    chapterId,
    stepId,
    completedCount: progress?.completedSteps?.length ?? 0,
    hasWorkspace: fs.existsSync(workspaceDir),
    createdAt: now.toISOString(),
  };

  fs.mkdirSync(savesDir, { recursive: true });
  const staging = path.join(savesDir, `.tmp-${id}-${process.pid}`);
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  try {
    fs.writeFileSync(path.join(staging, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(staging, 'progress.json'), `${JSON.stringify(progress, null, 2)}\n`, 'utf8');

    if (meta.hasWorkspace) {
      fs.cpSync(workspaceDir, path.join(staging, 'workspace'), {
        recursive: true,
        filter: (source) => shouldCopy(source, workspaceDir),
      });
    }

    // rename은 대상이 있으면 실패하므로 기존 것을 먼저 옆으로 치운다.
    const retired = `${target}.old-${process.pid}`;
    if (fs.existsSync(target)) fs.renameSync(target, retired);
    fs.renameSync(staging, target);
    fs.rmSync(retired, { recursive: true, force: true });
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }

  pruneManualSlots(savesDir);
  return meta;
}

function defaultLabel({ kind, chapterId, stepId }) {
  if (kind === 'preload') return '불러오기 직전';
  if (kind === 'auto') return `${stepId ?? chapterId ?? ''} 통과 시점`;
  return '수동 저장';
}

/** 최신순 슬롯 목록. 읽을 수 없는 슬롯은 건너뛴다. */
export function listSnapshots(dirs) {
  const { savesDir } = defaults(dirs);
  if (!fs.existsSync(savesDir)) return [];

  const slots = [];
  for (const name of fs.readdirSync(savesDir)) {
    if (name.startsWith('.')) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(savesDir, name, 'meta.json'), 'utf8'));
      slots.push(meta);
    } catch {
      // 반쪽짜리 슬롯은 목록에서 조용히 제외한다.
    }
  }
  return slots.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function readSnapshot(id, dirs) {
  const { savesDir } = defaults(dirs);
  const target = slotPath(savesDir, id);
  if (!fs.existsSync(target)) throw new Error(`그런 세이브가 없다: ${id}`);

  return {
    meta: JSON.parse(fs.readFileSync(path.join(target, 'meta.json'), 'utf8')),
    progress: JSON.parse(fs.readFileSync(path.join(target, 'progress.json'), 'utf8')),
  };
}

/**
 * 슬롯의 코드를 workspace에 되돌린다. 진도 교체는 호출자가 한다.
 * node_modules 등 제외 대상은 지우지 않는다 — 되돌릴 때마다 재설치를 강요하지 않기 위해서다.
 */
export function restoreWorkspace(id, dirs) {
  const { savesDir, workspaceDir } = defaults(dirs);
  const source = path.join(slotPath(savesDir, id), 'workspace');
  if (!fs.existsSync(source)) return { restored: false };

  if (fs.existsSync(workspaceDir)) {
    for (const name of fs.readdirSync(workspaceDir)) {
      if (SNAPSHOT_EXCLUDE.includes(name)) continue;
      fs.rmSync(path.join(workspaceDir, name), { recursive: true, force: true });
    }
  }
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.cpSync(source, workspaceDir, { recursive: true });
  return { restored: true };
}

export function deleteSnapshot(id, dirs) {
  const { savesDir } = defaults(dirs);
  fs.rmSync(slotPath(savesDir, id), { recursive: true, force: true });
}

/** 수동 슬롯이 너무 쌓이면 오래된 것부터 정리한다. 자동 슬롯은 스텝 수만큼이라 건드리지 않는다. */
function pruneManualSlots(savesDir) {
  const manual = listSnapshots({ savesDir }).filter((slot) => slot.kind === 'manual');
  const excess = manual.slice(MANUAL_SLOT_LIMIT);
  for (const slot of excess) {
    fs.rmSync(path.join(savesDir, slot.id), { recursive: true, force: true });
  }
  return excess.map((slot) => slot.id);
}
