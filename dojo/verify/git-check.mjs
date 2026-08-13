// git 상태 기반 판정. 학습자가 "커밋했다"고 말해도 저장소에 없으면 통과하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { runProcess } from './run-process.mjs';

const GIT_TIMEOUT_MS = 20_000;

/**
 * workspace 자신이 저장소 루트인지 확인한다.
 *
 * git은 저장소를 찾지 못하면 상위 폴더로 계속 올라간다. workspace가 도장 저장소 안에 있으므로
 * 이 가드가 없으면 학습자가 git init을 하지 않아도 도장 저장소가 잡혀 통과해 버린다(false pass).
 */
async function isWorkspaceRepoRoot(ctx) {
  const result = await runProcess(['git', 'rev-parse', '--show-toplevel'], {
    cwd: ctx.workspaceDir,
    timeoutMs: GIT_TIMEOUT_MS,
  });
  if (result.code !== 0) return false;

  const top = result.output.trim();
  if (!top) return false;
  return samePath(top, ctx.workspaceDir);
}

function samePath(a, b) {
  const normalize = (target) => {
    const resolved = path.resolve(target);
    try {
      return fs.realpathSync.native(resolved).toLowerCase();
    } catch {
      return resolved.toLowerCase();
    }
  };
  return normalize(a) === normalize(b);
}

export async function checkGit(check, ctx) {
  const git = (args) => runProcess(['git', ...args], { cwd: ctx.workspaceDir, timeoutMs: GIT_TIMEOUT_MS });

  // 어떤 검사든 workspace 자신이 저장소일 때만 의미가 있다.
  if (!(await isWorkspaceRepoRoot(ctx))) {
    return fail('workspace가 아직 git 저장소가 아니다 (workspace 폴더 안에서 git init 이 필요하다)');
  }

  switch (check.assert) {
    case 'repo_exists':
      return pass('git 저장소 확인');

    case 'has_commit': {
      const minCount = check.min_count ?? 1;
      const result = await git(['rev-list', '--count', 'HEAD']);
      if (result.code !== 0) return fail('커밋이 하나도 없다');
      const count = Number.parseInt(result.output.trim(), 10);
      return count >= minCount
        ? pass(`커밋 ${count}개 확인`)
        : fail(`커밋이 ${count}개뿐이다 (${minCount}개 이상 필요)`);
    }

    case 'clean_worktree': {
      const result = await git(['status', '--porcelain']);
      if (result.code !== 0) return fail('git 상태를 읽을 수 없다');
      const dirty = result.output.trim();
      return dirty === ''
        ? pass('작업 트리가 깨끗하다')
        : fail(`아직 커밋되지 않은 변경이 있다:\n${dirty}`);
    }

    case 'branch_is': {
      const result = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
      const current = result.output.trim();
      return current === check.value
        ? pass(`현재 브랜치 ${current}`)
        : fail(`현재 브랜치가 ${current || '알 수 없음'} 이다 (${check.value} 이어야 한다)`);
    }

    case 'tracked': {
      const result = await git(['ls-files', '--error-unmatch', '--', check.value]);
      return result.code === 0
        ? pass(`${check.value} 가 git에 추적되고 있다`)
        : fail(`${check.value} 가 아직 git에 추적되지 않는다`);
    }

    case 'ignored': {
      const result = await git(['check-ignore', '--quiet', '--', check.value]);
      return result.code === 0
        ? pass(`${check.value} 가 무시 목록에 있다`)
        : fail(`${check.value} 가 .gitignore로 걸러지지 않는다`);
    }

    case 'commit_message_matches': {
      const result = await git(['log', '-1', '--pretty=%B']);
      if (result.code !== 0) return fail('커밋이 없어 메시지를 읽을 수 없다');
      return new RegExp(check.value, 'mi').test(result.output)
        ? pass('커밋 메시지 확인')
        : fail(`마지막 커밋 메시지가 조건과 다르다: /${check.value}/`);
    }

    default:
      return fail(`알 수 없는 git 검사: ${check.assert}`);
  }
}

function pass(detail) {
  return { passed: true, detail };
}

function fail(detail) {
  return { passed: false, detail };
}
