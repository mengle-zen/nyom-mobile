import type { ReleaseNote } from './release-notes'

/** 빌드 번호를 정수로. 개발 빌드처럼 없거나 이상하면 null — 그때는 아무것도 띄우지 않는다. */
export function parseBuild(raw: string | number | null | undefined): number | null {
  const n = typeof raw === 'number' ? raw : Number.parseInt(raw ?? '', 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * 보여 줄 바뀐 점 — 마지막으로 본 빌드 다음부터 지금 빌드까지, 최신 빌드부터.
 * 마지막으로 본 기록이 없으면(이 기능 전부터 쓰던 사람) 지금 빌드까지 적어 둔 것 전부.
 * 새로 설치한 사람은 호출부가 먼저 지금 빌드를 기록해 이 함수가 빈 목록을 돌려준다.
 */
export function notesToShow(
  lastSeen: number | null,
  current: number,
  notes: { build: number; items: ReleaseNote[] }[],
): ReleaseNote[] {
  return notes
    .filter((n) => n.build <= current && (lastSeen === null || n.build > lastSeen))
    .sort((a, b) => b.build - a.build)
    .flatMap((n) => n.items)
}
