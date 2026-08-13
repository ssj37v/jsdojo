import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { loadChapters, collectReviewCards } from '../dojo/content-loader.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function validChapter() {
  return {
    id: 'ch99',
    title: '테스트 챕터',
    goal: '로더가 계약을 지키는지 확인한다',
    steps: [
      {
        id: 'ch99-s01',
        concept: 'use-state',
        goal: '상태를 하나 만든다',
        teach: 'useState는 값과 갱신 함수를 돌려준다.',
        hints: ['어디에 상태가 필요한가?', 'page.jsx 최상단', "const [filter, setFilter] = useState('all')"],
        fade: {
          copy: "const [filter, setFilter] = useState('all')",
          fill: 'const [____, ____] = useState(____)',
          recall: '필터 상태를 만들고 초기값을 all로 둔다',
        },
        verify: [
          { type: 'fs', label: 'page.jsx에 useState가 있다', path: 'src/app/page.jsx', matches: ['useState\\('] },
        ],
        review_card: { front: '상태 1개를 만드는 훅은?', back: 'useState' },
      },
    ],
  };
}

/** 임시 content 디렉터리를 만들고 실제 schema.json을 복사한다. */
function withContentDir(chapters) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-content-'));
  fs.copyFileSync(path.join(ROOT, 'content', 'schema.json'), path.join(dir, 'schema.json'));
  for (const [index, chapter] of chapters.entries()) {
    fs.writeFileSync(path.join(dir, `c${index}.yaml`), YAML.stringify(chapter), 'utf8');
  }
  return dir;
}

test('유효한 챕터를 로드하고 불변으로 얼린다', () => {
  const dir = withContentDir([validChapter()]);
  const chapters = loadChapters(dir);

  assert.equal(chapters.length, 1);
  assert.equal(chapters[0].steps[0].concept, 'use-state');
  assert.throws(() => {
    chapters[0].steps[0].goal = '변조';
  }, TypeError);
});

test('인출 카드를 챕터에서 걷어낸다', () => {
  const dir = withContentDir([validChapter()]);
  const cards = collectReviewCards(loadChapters(dir));

  assert.equal(cards.length, 1);
  assert.equal(cards[0].chapterId, 'ch99');
  assert.equal(cards[0].back, 'useState');
});

test('힌트가 3단이 아니면 거부한다', () => {
  const chapter = validChapter();
  chapter.steps[0].hints = ['하나만'];
  assert.throws(() => loadChapters(withContentDir([chapter])), /hints|minItems|fewer/i);
});

test('일반 스텝에 힌트가 없으면 거부한다', () => {
  const chapter = validChapter();
  delete chapter.steps[0].hints;
  assert.throws(() => loadChapters(withContentDir([chapter])), /hints|required/i);
});

test('보스 스텝은 힌트를 가질 수 없다', () => {
  const chapter = validChapter();
  chapter.steps[0].boss = true;
  assert.throws(() => loadChapters(withContentDir([chapter])), /hints|must NOT|not/i);
});

test('fade.fill에 빈칸이 없으면 거부한다', () => {
  const chapter = validChapter();
  chapter.steps[0].fade.fill = '빈칸 없는 완성 코드';
  assert.throws(() => loadChapters(withContentDir([chapter])), /빈칸/);
});

test('스텝 id 접두사가 챕터와 다르면 거부한다', () => {
  const chapter = validChapter();
  chapter.steps[0].id = 'ch01-s01';
  assert.throws(() => loadChapters(withContentDir([chapter])), /접두사/);
});

test('fs 체크에 절대 경로를 쓰면 거부한다', () => {
  const chapter = validChapter();
  chapter.steps[0].verify[0].path = path.resolve('C:/Windows/System32/drivers/etc/hosts');
  assert.throws(() => loadChapters(withContentDir([chapter])), /상대 경로/);
});

test('잘못된 정규식은 로딩 시점에 잡는다', () => {
  const chapter = validChapter();
  chapter.steps[0].verify[0].matches = ['useState(('];
  assert.throws(() => loadChapters(withContentDir([chapter])), /정규식/);
});

test('챕터 id가 중복되면 거부한다', () => {
  assert.throws(() => loadChapters(withContentDir([validChapter(), validChapter()])), /중복/);
});

test('실제 content 디렉터리가 계약을 만족한다', (t) => {
  const shipped = fs.readdirSync(path.join(ROOT, 'content')).filter((n) => n.endsWith('.yaml'));
  if (shipped.length === 0) return t.skip('아직 챕터 YAML이 없다');

  const chapters = loadChapters();
  assert.ok(chapters.length >= 1);
  for (const chapter of chapters) {
    for (const step of chapter.steps) {
      assert.ok(step.verify.length >= 1, `${step.id}: 검증이 없는 스텝은 허용되지 않는다`);
    }
  }
});
