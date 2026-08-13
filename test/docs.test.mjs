import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChapters } from '../dojo/content-loader.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readDoc = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

/** 문서에 적힌 `npm run dojo -- --옵션` 들을 걷어낸다. */
function documentedFlags(text) {
  return new Set([...text.matchAll(/npm run dojo -- (--[a-z-]+)/g)].map((m) => m[1]));
}

test('문서에 적힌 도장 옵션이 실제로 존재한다', () => {
  const cli = readDoc('dojo/cli.mjs');
  const flags = new Set([...documentedFlags(readDoc('MANUAL.md')), ...documentedFlags(readDoc('README.md'))]);

  assert.ok(flags.size >= 5, '문서에서 옵션을 찾지 못했다 — 정규식이나 문서를 확인한다');
  for (const flag of flags) {
    assert.ok(cli.includes(`'${flag}'`), `${flag} 는 문서에만 있고 cli.mjs 에는 없다`);
  }
});

test('도움말에 문서의 옵션이 모두 나온다', () => {
  const usage = readDoc('dojo/cli.mjs').match(/const USAGE = `([\s\S]*?)`/)[1];
  for (const flag of documentedFlags(readDoc('MANUAL.md'))) {
    assert.ok(usage.includes(flag), `${flag} 가 --help 도움말에 빠져 있다`);
  }
});

test('매뉴얼의 학습 중 키가 실제 처리되는 키와 일치한다', () => {
  const prompt = readDoc('dojo/prompt.mjs');
  const manual = readDoc('MANUAL.md');

  for (const key of ['h', 'b', 'w', 's', 'q']) {
    assert.ok(prompt.includes(`answer === '${key}'`), `prompt.mjs 가 ${key} 키를 처리하지 않는다`);
    assert.ok(new RegExp(`\\\`${key}\\\``).test(manual), `매뉴얼에 ${key} 키 설명이 없다`);
  }
});

test('매뉴얼의 커리큘럼 표가 실제 챕터와 일치한다', () => {
  const chapters = loadChapters();
  const manual = readDoc('MANUAL.md');

  for (const chapter of chapters) {
    const title = chapter.title.replace(/^\d+장 · /, '');
    assert.ok(manual.includes(title), `매뉴얼 커리큘럼 표에 "${title}" 이 없다`);
  }

  const totalSteps = chapters.reduce((sum, chapter) => sum + chapter.steps.length, 0);
  assert.ok(manual.includes(`${totalSteps}스텝`), `매뉴얼의 총 스텝 수가 실제(${totalSteps})와 다르다`);
});

test('매뉴얼이 학습자가 실제로 쓰는 실행 명령을 안내한다', () => {
  const manual = readDoc('MANUAL.md');
  // 이 도장에는 프레임워크가 없다. 학습자가 코드를 돌려 보는 수단은 node 뿐이다.
  for (const command of ['node hello.mjs', 'node --test', 'node --watch']) {
    assert.ok(manual.includes(command), `매뉴얼에 ${command} 안내가 없다`);
  }
});

test('커리큘럼이 실행 검사 없이 문자열 매칭만으로 통과되지 않는다', async () => {
  const { loadChapters } = await import('../dojo/content-loader.mjs');

  for (const chapter of loadChapters()) {
    const runnable = chapter.steps.filter((step) => step.kind !== 'inspect');
    const hasExecution = runnable.some((step) =>
      step.verify.some((check) => check.type === 'cmd' || check.type === 'git'));
    assert.ok(
      hasExecution,
      `${chapter.id}: 파일 내용만 보는 검사뿐이다 — 베껴 넣기로 뚫린다. cmd 검사를 최소 하나 둔다`,
    );
  }
});
