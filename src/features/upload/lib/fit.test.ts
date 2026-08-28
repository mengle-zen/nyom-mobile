import { describe, expect, it } from 'vitest'
import { fitWithin, needsResize, MAX_UPLOAD_EDGE } from './fit'

describe('fitWithin', () => {
  it('긴 변이 상한 이하면 그대로 둔다 (확대하지 않는다)', () => {
    expect(fitWithin({ width: 800, height: 600 }, 1280)).toEqual({
      width: 800,
      height: 600,
    })
  })

  it('상한과 정확히 같으면 그대로 둔다', () => {
    expect(fitWithin({ width: 1280, height: 720 }, 1280)).toEqual({
      width: 1280,
      height: 720,
    })
  })

  it('가로가 긴 사진은 가로를 상한에 맞춘다', () => {
    expect(fitWithin({ width: 4032, height: 3024 }, 1280)).toEqual({
      width: 1280,
      height: 960,
    })
  })

  it('세로가 긴 사진은 세로를 상한에 맞춘다', () => {
    expect(fitWithin({ width: 3024, height: 4032 }, 1280)).toEqual({
      width: 960,
      height: 1280,
    })
  })

  it('정사각형도 비율을 유지한다', () => {
    expect(fitWithin({ width: 2000, height: 2000 }, 1280)).toEqual({
      width: 1280,
      height: 1280,
    })
  })

  it('극단적인 파노라마에서도 짧은 변이 0이 되지 않는다', () => {
    const out = fitWithin({ width: 10000, height: 3 }, 1280)
    expect(out.width).toBe(1280)
    expect(out.height).toBeGreaterThanOrEqual(1)
  })

  it('크기를 못 읽으면(0·NaN·음수) 원본을 그대로 돌려준다', () => {
    expect(fitWithin({ width: 0, height: 0 })).toEqual({ width: 0, height: 0 })
    expect(fitWithin({ width: Number.NaN, height: 100 })).toEqual({
      width: Number.NaN,
      height: 100,
    })
    expect(fitWithin({ width: -10, height: 100 })).toEqual({
      width: -10,
      height: 100,
    })
  })

  it('기본 상한은 MAX_UPLOAD_EDGE', () => {
    expect(fitWithin({ width: 4000, height: 4000 })).toEqual({
      width: MAX_UPLOAD_EDGE,
      height: MAX_UPLOAD_EDGE,
    })
  })
})

describe('needsResize', () => {
  it('상한을 넘으면 true', () => {
    expect(needsResize({ width: 4032, height: 3024 }, 1280)).toBe(true)
  })

  it('상한 이하면 false', () => {
    expect(needsResize({ width: 1280, height: 720 }, 1280)).toBe(false)
    expect(needsResize({ width: 100, height: 100 }, 1280)).toBe(false)
  })

  it('크기를 못 읽으면 false — 추측 리사이즈보다 원본이 안전하다', () => {
    expect(needsResize({ width: 0, height: 0 }, 1280)).toBe(false)
    expect(needsResize({ width: Number.NaN, height: 5000 }, 1280)).toBe(false)
  })
})
