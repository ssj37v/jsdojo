// 학습자 워크스페이스를 지우는 유일한 곳. 되돌릴 수 없는 조작이므로 경로를 먼저 봉쇄한다(R02).
//
// Windows에서 node_modules 는 파일이 2만 개를 넘고, 개발 서버가 켜져 있으면 핸들이 잠긴다.
// 그래서 지우다 실패하는 것이 정상 범주이고, 어디서 막혔는지 알려 주는 것까지가 이 모듈의 일이다.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, WORKSPACE_DIR } from './config.mjs';
import { isInside } from './paths.mjs';

/**
 * 워크스페이스를 통째로 지운다.
 * @returns {{removed:boolean, existed:boolean, blockedPath?:string, reason?:string}}
 */
export function removeWorkspace({ workspaceDir = WORKSPACE_DIR, baseDir = ROOT } = {}) {
  const target = path.resolve(workspaceDir);
  const base = path.resolve(baseDir);

  // 도장 폴더 밖이거나 도장 폴더 자체면 손대지 않는다.
  if (!isInside(base, target) || target === base) {
    throw new Error(`지울 수 있는 범위가 아니다: ${target}`);
  }
  if (path.basename(target) !== path.basename(WORKSPACE_DIR)) {
    throw new Error(`workspace 폴더가 아니다: ${target}`);
  }

  if (!fs.existsSync(target)) return { removed: true, existed: false };

  try {
    // 잠긴 핸들은 잠시 뒤 풀리는 경우가 많아 몇 번 다시 시도한다.
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    return { removed: true, existed: true };
  } catch (error) {
    return {
      removed: false,
      existed: true,
      blockedPath: error.path,
      reason: error.code ?? error.message,
    };
  }
}

/** 지우다 막혔을 때 학습자가 실제로 할 수 있는 일을 알려 준다. */
export function describeBlock({ blockedPath, reason }) {
  const lines = [`${reason ?? '알 수 없는 이유'} 로 막혔다.`];
  if (blockedPath) lines.push(`막힌 지점: ${blockedPath}`);

  if (['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(reason)) {
    lines.push(
      '',
      '대개 그 파일을 누군가 쥐고 있어서다. 아래를 확인한 뒤 다시 시도한다.',
      '  1. 실행 중인 node 프로세스(node --watch 등)가 있으면 그 터미널에서 Ctrl+C',
      '  2. workspace 폴더를 연 편집기·탐색기 창을 닫는다',
      '  3. 백신 실시간 검사가 훑는 중이면 잠시 뒤 다시 시도한다',
    );
  }
  return lines.join('\n');
}

/** 워크스페이스 규모를 미리 보여 준다. 큰 폴더를 지운다는 사실을 알고 결정하게 한다. */
export function measureWorkspace({ workspaceDir = WORKSPACE_DIR } = {}) {
  const target = path.resolve(workspaceDir);
  if (!fs.existsSync(target)) return { exists: false, files: 0, bytes: 0 };

  let files = 0;
  let bytes = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files += 1;
        try {
          bytes += fs.statSync(full).size;
        } catch {
          // 세는 도중 사라진 파일은 무시한다.
        }
      }
    }
  };
  try {
    walk(target);
  } catch {
    // 권한 문제로 다 세지 못해도 대략치면 충분하다.
  }
  return { exists: true, files, bytes };
}
