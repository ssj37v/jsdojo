// 자기설명 되짚기. 채점이 아니다 — 통과 여부에 영향을 주지 않고, 빠진 관점만 짚어 준다.
//
// 설명을 스스로 만들어 보는 것만으로 이해가 깊어지지만, 피드백이 없으면 틀린 이해가 그대로 굳는다.
// 그래서 답을 받은 뒤에 모범답안을 보여주고, 언급되지 않은 핵심어를 되짚는다.

/** 답에서 언급되지 않은 핵심어를 돌려준다. 빈 답이면 전부 빠진 것으로 본다. */
export function missingKeywords(answer, keywords = []) {
  const normalized = normalize(answer);
  if (normalized === '') return [...keywords];
  return keywords.filter((keyword) => !normalized.includes(normalize(keyword.term)));
}

/** 학습자가 무언가 적기는 했는가. 빈 답에는 모범답안을 보여줄 이유가 약하다. */
export function hasAttempt(answer) {
  return normalize(answer) !== '';
}

function normalize(text) {
  return String(text ?? '').toLowerCase().replace(/\s+/g, '');
}
