import { describe, expect, it } from 'vitest'

import {
  INITIAL_TRANSFORM,
  MAX_SCALE,
  MIN_SCALE,
  baseSize,
  clampScale,
  isUntouched,
  snapAngle,
  snapOffset,
} from './canvas-transform'

describe('snapOffset', () => {
  it('붙는 거리(8pt) 안이면 가운데로 붙는다', () => {
    // 캔버스 400pt에서 0.015 = 6pt
    expect(snapOffset(0.015, 400)).toEqual({ value: 0, snapped: true })
    expect(snapOffset(-0.015, 400)).toEqual({ value: 0, snapped: true })
  })

  it('붙는 거리 밖이면 그대로 둔다', () => {
    // 0.03 × 400 = 12pt
    expect(snapOffset(0.03, 400)).toEqual({ value: 0.03, snapped: false })
  })

  it('같은 비율이라도 캔버스가 작으면 화면상 거리가 짧아 붙는다', () => {
    // 0.03 × 200 = 6pt
    expect(snapOffset(0.03, 200).snapped).toBe(true)
  })

  it('캔버스 크기를 모르면(0) 붙이지 않는다', () => {
    expect(snapOffset(0.001, 0)).toEqual({ value: 0.001, snapped: false })
  })
})

describe('snapAngle', () => {
  it('0°·90°·-90°·180° 근처에서 붙는다', () => {
    expect(snapAngle(3)).toEqual({ value: 0, snapped: true })
    expect(snapAngle(-2.5)).toEqual({ value: 0, snapped: true })
    expect(snapAngle(88)).toEqual({ value: 90, snapped: true })
    expect(snapAngle(-91)).toEqual({ value: -90, snapped: true })
    expect(snapAngle(178)).toEqual({ value: 180, snapped: true })
  })

  it('-0을 내지 않는다', () => {
    expect(Object.is(snapAngle(-1).value, 0)).toBe(true)
  })

  it('사이 각도는 그대로 둔다', () => {
    expect(snapAngle(20)).toEqual({ value: 20, snapped: false })
  })
})

describe('clampScale', () => {
  it('범위 밖은 끝값으로', () => {
    expect(clampScale(0.1)).toBe(MIN_SCALE)
    expect(clampScale(10)).toBe(MAX_SCALE)
    expect(clampScale(1.5)).toBe(1.5)
  })
})

describe('isUntouched', () => {
  it('초기 상태는 손대지 않은 것', () => {
    expect(isUntouched(INITIAL_TRANSFORM)).toBe(true)
  })

  it('한 바퀴 돌린 것도 손대지 않은 것과 같다', () => {
    expect(isUntouched({ ...INITIAL_TRANSFORM, rotation: 360 })).toBe(true)
    expect(isUntouched({ ...INITIAL_TRANSFORM, rotation: -360 })).toBe(true)
  })

  it('하나라도 바뀌면 손댄 것', () => {
    expect(isUntouched({ ...INITIAL_TRANSFORM, x: 0.1 })).toBe(false)
    expect(isUntouched({ ...INITIAL_TRANSFORM, scale: 1.2 })).toBe(false)
    expect(isUntouched({ ...INITIAL_TRANSFORM, rotation: 90 })).toBe(false)
  })
})

describe('baseSize', () => {
  it('세로 사진은 너비가 캔버스를 꽉 채운다', () => {
    expect(baseSize({ width: 3000, height: 4000 }, 300)).toEqual({ width: 300, height: 400 })
  })

  it('가로 사진은 높이가 캔버스를 꽉 채운다', () => {
    expect(baseSize({ width: 4000, height: 3000 }, 300)).toEqual({ width: 400, height: 300 })
  })

  it('크기를 모르면 정사각', () => {
    expect(baseSize({ width: 0, height: 0 }, 300)).toEqual({ width: 300, height: 300 })
  })
})
