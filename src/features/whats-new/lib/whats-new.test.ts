import { describe, expect, it } from 'vitest'

import { RELEASE_NOTES } from './release-notes'
import { notesToShow, parseBuild } from './whats-new'

const note = (title: string) => ({ icon: 'create-outline' as const, title, body: '' })
const notes = [
  { build: 19, items: [note('a'), note('b')] },
  { build: 20, items: [note('c')] },
  { build: 22, items: [note('d')] },
]
const titles = (xs: { title: string }[]) => xs.map((x) => x.title)

describe('notesToShow', () => {
  it('마지막으로 본 빌드 다음부터 지금 빌드까지, 최신부터', () => {
    expect(titles(notesToShow(19, 22, notes))).toEqual(['d', 'c'])
  })

  it('건너뛴 빌드도 합친다', () => {
    expect(titles(notesToShow(18, 22, notes))).toEqual(['d', 'c', 'a', 'b'])
  })

  it('이미 본 빌드면 없다', () => {
    expect(notesToShow(22, 22, notes)).toEqual([])
  })

  it('지금 빌드보다 뒤의 항목은 뺀다(아직 안 나간 빌드)', () => {
    expect(titles(notesToShow(18, 20, notes))).toEqual(['c', 'a', 'b'])
  })

  it('기록이 없는 기존 사용자는 지금 빌드까지 전부', () => {
    expect(titles(notesToShow(null, 20, notes))).toEqual(['c', 'a', 'b'])
  })
})

describe('parseBuild', () => {
  it('문자열·숫자 빌드 번호를 읽는다', () => {
    expect(parseBuild('20')).toBe(20)
    expect(parseBuild(20)).toBe(20)
  })

  it('없거나 이상하면 null', () => {
    expect(parseBuild(undefined)).toBeNull()
    expect(parseBuild('dev')).toBeNull()
    expect(parseBuild(0)).toBeNull()
  })
})

describe('RELEASE_NOTES', () => {
  it('빌드 번호가 겹치지 않고, 빌드마다 네 항목 이하', () => {
    const builds = RELEASE_NOTES.map((n) => n.build)
    expect(new Set(builds).size).toBe(builds.length)
    for (const n of RELEASE_NOTES) expect(n.items.length).toBeLessThanOrEqual(4)
  })
})
