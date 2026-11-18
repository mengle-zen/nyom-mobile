import { describe, expect, it } from 'vitest'

import { INITIAL_TRANSFORM } from './canvas-transform'
import { decodePhotos, encodePhotos, MAX_PHOTOS, newDraft, removeDraft } from './photo-drafts'

const shot = (uri: string) => ({ uri, width: 100, height: 100, mimeType: 'image/jpeg' })

describe('newDraft', () => {
  it('찍은 시각이 먹은 시각 기본값이고 자르기는 처음 상태', () => {
    const d = newDraft({ shot: shot('a'), takenAt: new Date(2026, 10, 17, 12, 5) })
    expect(d.time).toBe('12:05')
    expect(d.timeValid).toBe(true)
    expect(d.transform).toEqual(INITIAL_TRANSFORM)
    expect(d.baked).toBeNull()
  })

  it('같은 파일을 두 번 골라도 key가 다르다', () => {
    const t = new Date()
    expect(newDraft({ shot: shot('a'), takenAt: t }).key).not.toBe(
      newDraft({ shot: shot('a'), takenAt: t }).key,
    )
  })
})

describe('removeDraft', () => {
  const t = new Date()
  const list = ['a', 'b', 'c'].map((u) => newDraft({ shot: shot(u), takenAt: t }))

  it('가운데 장을 빼면 그 자리의 다음 장을 보여 준다', () => {
    const r = removeDraft(list, 1)
    expect(r.drafts.map((d) => d.shot.uri)).toEqual(['a', 'c'])
    expect(r.active).toBe(1)
  })

  it('마지막 장을 빼면 앞 장으로', () => {
    expect(removeDraft(list, 2).active).toBe(1)
  })

  it('하나뿐인 장을 빼면 빈 목록', () => {
    expect(removeDraft(list.slice(0, 1), 0)).toEqual({ drafts: [], active: 0 })
  })
})

describe('encodePhotos / decodePhotos', () => {
  it('왕복한다', () => {
    const photos = [
      { uri: 'file:///a.jpg', width: 10, height: 20, takenAt: '2026-11-17T03:00:00.000Z' },
      { uri: 'file:///b,c.jpg', width: 1, height: 1, takenAt: '2026-11-17T04:00:00.000Z', tag: '야식', caption: 'x' },
    ]
    expect(decodePhotos(encodePhotos(photos))).toEqual(photos)
  })

  it('망가진 값은 버린다', () => {
    expect(decodePhotos(undefined)).toEqual([])
    expect(decodePhotos('not json')).toEqual([])
    expect(decodePhotos('{"uri":"a"}')).toEqual([])
    expect(
      decodePhotos(JSON.stringify([{ uri: '', width: 1, height: 1, takenAt: '2026-11-17T00:00:00Z' }, { uri: 'a', width: 1, height: 1, takenAt: 'nope' }])),
    ).toEqual([])
  })

  it(`${MAX_PHOTOS}장까지만 받는다`, () => {
    const many = Array.from({ length: MAX_PHOTOS + 3 }, (_, i) => ({
      uri: `f${i}`, width: 1, height: 1, takenAt: '2026-11-17T00:00:00.000Z',
    }))
    expect(decodePhotos(encodePhotos(many))).toHaveLength(MAX_PHOTOS)
  })
})
