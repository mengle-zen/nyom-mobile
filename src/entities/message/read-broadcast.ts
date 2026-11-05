import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/shared/api/supabase'

/**
 * 「읽었어요」 신호 — 누가 대화방을 열어 읽음 처리를 하면 같은 방을 보고 있는 사람들이
 * 읽음 상태를 다시 받아 안 읽은 사람 수를 줄인다.
 *
 * DB 변경을 실시간으로 받지 않고(group_members는 Realtime publication에 없다) Realtime
 * broadcast로 신호만 보낸다. 내용 없는 신호라 누가 보내도 「다시 받아라」 이상의 일은
 * 일어나지 않는다 — 읽음 상태 자체는 RLS를 거쳐 DB에서 읽는다.
 *
 * supabase-js는 같은 이름의 채널을 이미 구독 중이면 그 채널을 돌려주고, 거기에 `.on()`을
 * 붙이면 throw한다(같은 방 채팅이 스택에 두 번 쌓였을 때). 그래서 방마다 채널 하나를
 * 여러 화면이 나눠 쓴다.
 */
type Room = { channel: RealtimeChannel; listeners: Set<() => void> }
const rooms = new Map<string, Room>()

/** 같은 방 사람이 읽을 때마다 listener를 부른다. 돌려준 함수로 그만 받는다. */
export function subscribeRoomReads(groupId: string, listener: () => void): () => void {
  let room = rooms.get(groupId)
  if (!room) {
    const listeners = new Set<() => void>()
    const channel = supabase
      .channel(`room-reads:${groupId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'read' }, () => listeners.forEach((l) => l()))
      .subscribe()
    room = { channel, listeners }
    rooms.set(groupId, room)
  }
  room.listeners.add(listener)
  return () => {
    const current = rooms.get(groupId)
    if (!current) return
    current.listeners.delete(listener)
    if (current.listeners.size === 0) {
      rooms.delete(groupId)
      void supabase.removeChannel(current.channel)
    }
  }
}

/**
 * 내가 읽었다고 같은 방에 알린다. 대화방을 보고 있을 때만 채널이 있다.
 * 대화방을 열자마자 읽음 처리를 하므로 채널이 아직 연결 전일 수 있다 — 그때는 REST로 보낸다
 * (연결 전 `send()`는 REST로 바꿔 보내며 경고를 남기고, 그 동작은 없어질 예정이다).
 */
export function announceRead(groupId: string): void {
  const channel = rooms.get(groupId)?.channel
  if (!channel) return
  if (channel.state === 'joined') {
    void channel.send({ type: 'broadcast', event: 'read', payload: {} })
  } else {
    void channel.httpSend('read', {}).catch(() => {})
  }
}
