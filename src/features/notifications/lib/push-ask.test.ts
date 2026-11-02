import { describe, expect, it } from 'vitest'

import {
  INITIAL_PUSH_ASK,
  PUSH_ASK_MAX_SNOOZES,
  parsePushAskState,
  shouldAskForPush,
  snoozePushAsk,
} from './push-ask'

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 10, 2, 3)

describe('shouldAskForPush', () => {
  it('처음 들어온, 알림이 꺼진 사람에게 묻는다', () => {
    expect(shouldAskForPush(INITIAL_PUSH_ASK, false, now)).toBe(true)
  })

  it('이미 허용했으면 묻지 않는다', () => {
    expect(shouldAskForPush(INITIAL_PUSH_ASK, true, now)).toBe(false)
  })

  it('미루면 7일 동안 묻지 않고, 7일이 지나면 다시 묻는다', () => {
    const snoozed = snoozePushAsk(INITIAL_PUSH_ASK, now)
    expect(shouldAskForPush(snoozed, false, now + 6 * DAY)).toBe(false)
    expect(shouldAskForPush(snoozed, false, now + 7 * DAY)).toBe(true)
  })

  it('세 번 미루면 더는 묻지 않는다', () => {
    let state = INITIAL_PUSH_ASK
    for (let i = 0; i < PUSH_ASK_MAX_SNOOZES; i++) state = snoozePushAsk(state, now)
    expect(shouldAskForPush(state, false, now + 365 * DAY)).toBe(false)
  })
})

describe('parsePushAskState', () => {
  it('저장된 값을 읽는다', () => {
    expect(parsePushAskState(JSON.stringify({ snoozes: 2, nextAt: 5 }))).toEqual({ snoozes: 2, nextAt: 5 })
  })

  it('없거나 깨진 값은 처음 상태로', () => {
    expect(parsePushAskState(null)).toEqual(INITIAL_PUSH_ASK)
    expect(parsePushAskState('{oops')).toEqual(INITIAL_PUSH_ASK)
    expect(parsePushAskState(JSON.stringify({ snoozes: '1' }))).toEqual(INITIAL_PUSH_ASK)
  })
})
