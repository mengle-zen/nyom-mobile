import { describe, expect, it } from 'vitest'
import { needsUpdate, parseUpdatePolicy } from './policy'

const json = { ios: { minBuild: 16, url: 'itms-beta://' } }

describe('parseUpdatePolicy', () => {
  it('플랫폼 항목을 꺼낸다', () => {
    expect(parseUpdatePolicy(json, 'ios')).toEqual({ minBuild: 16, url: 'itms-beta://' })
  })
  it('항목이 없거나 모양이 틀리면 null', () => {
    expect(parseUpdatePolicy(json, 'android')).toBeNull()
    expect(parseUpdatePolicy({ ios: { minBuild: '16', url: 'x' } }, 'ios')).toBeNull()
    expect(parseUpdatePolicy({ ios: { minBuild: 16 } }, 'ios')).toBeNull()
    expect(parseUpdatePolicy('<html>', 'ios')).toBeNull()
    expect(parseUpdatePolicy(null, 'ios')).toBeNull()
  })
})

describe('needsUpdate', () => {
  const policy = { minBuild: 16, url: 'itms-beta://' }
  it('기준보다 낮은 빌드만 막는다', () => {
    expect(needsUpdate('15', policy)).toBe(true)
    expect(needsUpdate('16', policy)).toBe(false)
    expect(needsUpdate(17, policy)).toBe(false)
  })
  it('기준이나 빌드 번호를 모르면 막지 않는다', () => {
    expect(needsUpdate('15', null)).toBe(false)
    expect(needsUpdate(undefined, policy)).toBe(false)
    expect(needsUpdate('abc', policy)).toBe(false)
  })
})
