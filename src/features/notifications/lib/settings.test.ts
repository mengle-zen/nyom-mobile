import { describe, it, expect } from 'vitest'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_KIND_META,
  toNotificationSettings,
  toSettingsColumns,
  withKind,
} from './settings'

describe('toNotificationSettings', () => {
  it('row가 없으면 전부 수신(기본값 true) — 기존 사용자 회귀 방지', () => {
    expect(toNotificationSettings(null)).toEqual({
      post: true,
      reaction: true,
      reminder: true,
    })
    expect(toNotificationSettings(undefined)).toEqual({
      post: true,
      reaction: true,
      reminder: true,
    })
  })

  it('기본값 객체를 복사해 반환한다(호출자가 변형해도 원본 불변)', () => {
    const a = toNotificationSettings(null)
    a.post = false
    expect(DEFAULT_NOTIFICATION_SETTINGS.post).toBe(true)
    expect(toNotificationSettings(null).post).toBe(true)
  })

  it('row 값을 그대로 반영한다', () => {
    expect(
      toNotificationSettings({
        post_enabled: false,
        reaction_enabled: true,
        reminder_enabled: false,
      }),
    ).toEqual({ post: false, reaction: true, reminder: false })
  })

  it('일부 컬럼만 있어도 나머지는 기본값 true로 메운다', () => {
    expect(toNotificationSettings({ reaction_enabled: false })).toEqual({
      post: true,
      reaction: false,
      reminder: true,
    })
  })

  it('false는 기본값으로 덮이지 않는다 (?? 사용 확인)', () => {
    expect(toNotificationSettings({ post_enabled: false }).post).toBe(false)
  })
})

describe('toSettingsColumns', () => {
  it('화면 형태를 DB 컬럼명으로 옮긴다', () => {
    expect(
      toSettingsColumns({ post: false, reaction: true, reminder: false }),
    ).toEqual({
      post_enabled: false,
      reaction_enabled: true,
      reminder_enabled: false,
    })
  })

  it('toNotificationSettings와 왕복해도 값이 유지된다', () => {
    const settings = { post: false, reaction: true, reminder: false }
    expect(toNotificationSettings(toSettingsColumns(settings))).toEqual(settings)
  })
})

describe('withKind', () => {
  it('해당 종류만 바꾸고 나머지는 유지한다', () => {
    const before = { post: true, reaction: true, reminder: true }
    expect(withKind(before, 'reaction', false)).toEqual({
      post: true,
      reaction: false,
      reminder: true,
    })
  })

  it('원본을 변형하지 않는다', () => {
    const before = { post: true, reaction: true, reminder: true }
    withKind(before, 'post', false)
    expect(before.post).toBe(true)
  })
})

describe('NOTIFICATION_KIND_META', () => {
  it('세 종류를 모두 덮고 중복이 없다', () => {
    const kinds = NOTIFICATION_KIND_META.map((m) => m.kind)
    expect(kinds).toEqual(['post', 'reaction', 'reminder'])
    expect(new Set(kinds).size).toBe(3)
  })

  it('모든 항목에 라벨과 설명이 있다', () => {
    for (const meta of NOTIFICATION_KIND_META) {
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.description.length).toBeGreaterThan(0)
    }
  })
})
