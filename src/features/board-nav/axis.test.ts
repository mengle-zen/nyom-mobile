import { describe, it, expect } from 'vitest'
import { decideAxis, edgeZone } from './axis'

describe('decideAxis', () => {
  it('임계 미만이면 null', () => {
    expect(decideAxis(3, 3, 10)).toBeNull()
  })
  it('수평 우세면 h', () => {
    expect(decideAxis(20, 5, 10)).toBe('h')
  })
  it('수직 우세면 v', () => {
    expect(decideAxis(5, 20, 10)).toBe('v')
  })
})

describe('edgeZone', () => {
  it('좌측 30% 이내면 left', () => {
    expect(edgeZone(10, 100)).toBe('left')
  })
  it('우측 30% 이내면 right', () => {
    expect(edgeZone(90, 100)).toBe('right')
  })
  it('중앙이면 null', () => {
    expect(edgeZone(50, 100)).toBeNull()
  })
})
