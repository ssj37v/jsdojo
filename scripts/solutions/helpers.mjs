// lifecycle: ops
// 챕터 정답 스크립트가 공유하는 파일·git 조작 도구.
import fs from 'node:fs';
import path from 'node:path';
import { runProcess } from '../../dojo/verify/run-process.mjs';

export function write(ws, relative, content) {
  const target = path.join(ws, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

export function read(ws, relative) {
  return fs.readFileSync(path.join(ws, relative), 'utf8');
}

/**
 * 파일을 고친다. 아무것도 바뀌지 않으면 실패로 본다 —
 * 템플릿이 바뀌었는데 정답만 조용히 통과하는 상황을 막는다.
 */
export function edit(ws, relative, transform) {
  const before = read(ws, relative);
  const after = transform(before);
  if (before === after) {
    throw new Error(`${relative}: 정답 적용이 아무것도 바꾸지 못했다 (템플릿이 바뀌었을 수 있다)`);
  }
  write(ws, relative, after);
}

export function remove(ws, relative) {
  const target = path.join(ws, relative);
  if (!fs.existsSync(target)) throw new Error(`${relative}: 지울 파일이 없다`);
  fs.rmSync(target);
}

/** 파일 이름을 바꾼다(.js → .tsx 같은 마이그레이션용). 내용을 손보려면 transform을 준다. */
export function rename(ws, from, to, transform = (text) => text) {
  const source = path.join(ws, from);
  if (!fs.existsSync(source)) throw new Error(`${from}: 옮길 파일이 없다`);
  const content = transform(fs.readFileSync(source, 'utf8'));
  fs.rmSync(source);
  write(ws, to, content);
}

export async function git(ws, args) {
  const result = await runProcess(['git', ...args], { cwd: ws });
  if (result.code !== 0) throw new Error(`git ${args.join(' ')} 실패: ${result.output}`);
  return result.output;
}

export async function commitAll(ws, message) {
  await git(ws, ['add', '.']);
  await git(ws, ['commit', '-q', '-m', message]);
}

export async function run(ws, argv, { timeoutMs = 600_000 } = {}) {
  const result = await runProcess(argv, { cwd: ws, timeoutMs });
  if (result.code !== 0) throw new Error(`${argv.join(' ')} 실패: ${result.output.slice(-800)}`);
  return result.output;
}
