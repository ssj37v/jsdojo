// git 상황 연출. 학습자 저장소를 변형하는 유일한 모듈이므로 조작 범위를 좁게 유지한다(R02).
//
// 원격은 GitHub가 아니라 .dojo/remote.git 이라는 로컬 bare 저장소다.
// 계정도 네트워크도 필요 없고, 충돌·되돌리기 같은 사고를 마음껏 재현하고 되돌릴 수 있다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FAKE_REMOTE_DIR, ROOT, WORKSPACE_DIR } from './config.mjs';
import { isInside } from './paths.mjs';
import { runProcess } from './verify/run-process.mjs';

const TEAMMATE = { name: 'Mina (팀 동료)', email: 'mina@example.com' };

/**
 * 콘텐츠에서 이름으로 부를 수 있는 상황들.
 * 스텝의 setup 블록이 여기 있는 이름만 쓸 수 있도록 스키마가 강제한다.
 */
export const SCENARIOS = {
  /** 가짜 원격을 준비한다. 학습자가 remote add 를 직접 하는 스텝에서는 쓰지 않는다. */
  ensure_remote: (context) => ensureFakeRemote(context),

  /** 자리를 비운 사이 동료가 원격에 먼저 push해 둔 상황. */
  teammate_push: (context, options) =>
    teammatePush({
      ...context,
      file: options.file,
      content: options.content,
      message: options.message,
      branch: options.branch ?? 'main',
    }),
};

/**
 * 이름으로 상황을 발동한다.
 * @param {string} name SCENARIOS의 키
 * @param {{workspaceDir:string, remoteDir:string, baseDir:string}} context
 */
export async function runScenario(name, context, options = {}) {
  const scenario = SCENARIOS[name];
  if (!scenario) throw new Error(`알 수 없는 상황: ${name}`);
  return scenario(context, options);
}

async function git(cwd, args) {
  const result = await runProcess(['git', ...args], { cwd });
  if (result.code !== 0) {
    throw new Error(`git ${args.join(' ')} 실패 (${cwd})\n${result.output}`);
  }
  return result.output;
}

/** 조작 대상이 도장 폴더 안인지 확인한다. 밖이면 아무것도 하지 않는다. */
function assertManaged(target, base, label) {
  const resolved = path.resolve(target);
  if (!isInside(path.resolve(base), resolved)) {
    throw new Error(`${label}가 관리 범위 밖이다: ${resolved}`);
  }
  return resolved;
}

/** 가짜 원격을 만들고 workspace의 origin으로 등록한다. 이미 있으면 그대로 둔다. */
export async function ensureFakeRemote({
  workspaceDir = WORKSPACE_DIR,
  remoteDir = FAKE_REMOTE_DIR,
  baseDir = ROOT,
} = {}) {
  const remote = assertManaged(remoteDir, baseDir, '가짜 원격');
  const workspace = assertManaged(workspaceDir, baseDir, 'workspace');

  if (!fs.existsSync(remote)) {
    fs.mkdirSync(path.dirname(remote), { recursive: true });
    await git(path.dirname(remote), ['init', '--bare', '-q', '-b', 'main', remote]);
  }

  const existing = await runProcess(['git', 'remote', 'get-url', 'origin'], { cwd: workspace });
  if (existing.code === 0) {
    await git(workspace, ['remote', 'set-url', 'origin', remote]);
  } else {
    await git(workspace, ['remote', 'add', 'origin', remote]);
  }
  return remote;
}

/** 원격을 통째로 지우고 다시 만든다. 학습자 workspace와 그 커밋 이력은 건드리지 않는다. */
export async function resetFakeRemote({
  workspaceDir = WORKSPACE_DIR,
  remoteDir = FAKE_REMOTE_DIR,
  baseDir = ROOT,
} = {}) {
  const remote = assertManaged(remoteDir, baseDir, '가짜 원격');
  fs.rmSync(remote, { recursive: true, force: true });
  return ensureFakeRemote({ workspaceDir, remoteDir: remote, baseDir });
}

/**
 * "자리를 비운 사이 동료가 원격에 먼저 push해 두었다" 상황을 만든다.
 * 학습자는 pull/rebase 없이는 push할 수 없게 된다.
 */
export async function teammatePush({
  workspaceDir = WORKSPACE_DIR,
  remoteDir = FAKE_REMOTE_DIR,
  baseDir = ROOT,
  file,
  content,
  message,
  branch = 'main',
} = {}) {
  if (!file || content === undefined || !message) {
    throw new Error('teammatePush에는 file, content, message가 필요하다');
  }
  const remote = await ensureFakeRemote({ workspaceDir, remoteDir, baseDir });

  // 원격이 비어 있으면 학습자 커밋을 먼저 올려 둔 뒤라야 동료 커밋이 의미를 갖는다.
  const hasBranch = await runProcess(['git', 'rev-parse', '--verify', branch], { cwd: remote });
  if (hasBranch.code !== 0) {
    await git(workspaceDir, ['push', '-q', 'origin', branch]);
  }

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-teammate-'));
  try {
    await git(staging, ['clone', '-q', '--branch', branch, remote, 'clone']);
    const clone = path.join(staging, 'clone');

    await git(clone, ['config', 'user.name', TEAMMATE.name]);
    await git(clone, ['config', 'user.email', TEAMMATE.email]);

    const target = path.join(clone, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');

    await git(clone, ['add', '--', file]);
    await git(clone, ['commit', '-q', '-m', message]);
    await git(clone, ['push', '-q', 'origin', branch]);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }

  return { remote, branch, author: TEAMMATE.name };
}
