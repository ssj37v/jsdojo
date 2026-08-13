// 커리큘럼 YAML 로딩과 계약 검증. 학습 내용은 코드가 아니라 content/*.yaml에만 존재한다.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import { CONTENT_DIR, CONTENT_MAX_BYTES } from './config.mjs';

function compileValidator(dir) {
  const schema = JSON.parse(fs.readFileSync(path.join(dir, 'schema.json'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false, useDefaults: true });
  return ajv.compile(schema);
}

// JSON Schema로는 표현하기 번거로운 교차 제약을 여기서 잡는다.
function assertConsistency(chapter, fileName) {
  const fail = (message) => {
    throw new Error(`${fileName}: ${message}`);
  };

  const seenStepIds = new Set();
  for (const step of chapter.steps) {
    if (!step.id.startsWith(`${chapter.id}-`)) {
      fail(`스텝 ${step.id}의 접두사가 챕터 ${chapter.id}와 다르다`);
    }
    if (seenStepIds.has(step.id)) fail(`스텝 id 중복: ${step.id}`);
    seenStepIds.add(step.id);

    if (step.fade) {
      if (!step.fade.fill.includes('____')) {
        fail(`${step.id}: fade.fill에는 빈칸(____)이 있어야 한다`);
      }
      if (step.fade.copy.includes('____')) {
        fail(`${step.id}: fade.copy는 완성 코드여야 한다(빈칸 금지)`);
      }
    }

    for (const check of step.verify) {
      if (check.type === 'fs' && path.isAbsolute(check.path)) {
        fail(`${step.id}: fs 체크 경로는 workspace 기준 상대 경로여야 한다 (${check.path})`);
      }
      if (check.type === 'git' && needsValue(check.assert) && !check.value) {
        fail(`${step.id}: git assert ${check.assert}에는 value가 필요하다`);
      }
      for (const pattern of [
        ...(check.matches ?? []),
        ...(check.not_matches ?? []),
        check.expect_output,
        check.reject_output,
      ]) {
        if (pattern === undefined) continue;
        try {
          new RegExp(pattern);
        } catch (error) {
          fail(`${step.id}: 잘못된 정규식 ${JSON.stringify(pattern)} — ${error.message}`);
        }
      }
    }
  }
}

function needsValue(assertName) {
  return ['branch_is', 'tracked', 'ignored', 'commit_message_matches'].includes(assertName);
}

/** content 디렉터리의 모든 챕터를 id 순으로 로드한다. */
export function loadChapters(dir = CONTENT_DIR) {
  const validate = compileValidator(dir);
  const chapters = [];
  const seenIds = new Set();

  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.yaml')).sort();
  for (const name of files) {
    const raw = fs.readFileSync(path.join(dir, name), 'utf8');
    if (raw.length > CONTENT_MAX_BYTES) throw new Error(`${name}: 챕터 파일이 너무 크다`);

    const chapter = YAML.parse(raw, { maxAliasCount: 20 });
    if (!validate(chapter)) {
      throw new Error(`${name}: ${validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ')}`);
    }
    if (seenIds.has(chapter.id)) throw new Error(`${name}: 챕터 id 중복 ${chapter.id}`);
    seenIds.add(chapter.id);

    assertConsistency(chapter, name);
    chapters.push(deepFreeze(chapter));
  }

  if (chapters.length === 0) throw new Error(`${dir}: 챕터 YAML이 하나도 없다`);
  return Object.freeze(chapters.sort((a, b) => a.id.localeCompare(b.id)));
}

/** 간격 반복에 쓸 인출 카드를 스텝에서 걷어 평평한 목록으로 만든다. */
export function collectReviewCards(chapters) {
  const cards = [];
  for (const chapter of chapters) {
    for (const step of chapter.steps) {
      if (!step.review_card) continue;
      cards.push(
        Object.freeze({
          id: step.id,
          chapterId: chapter.id,
          concept: step.concept,
          ...step.review_card,
        }),
      );
    }
  }
  return Object.freeze(cards);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
