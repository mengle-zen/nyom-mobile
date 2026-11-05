/** 답장이 인용하는 기록. 썸네일과 「수진의 12:31 기록」 라벨, 상세 열기에 쓴다. */
export type QuotedPost = {
  id: string
  user_id: string
  image_url: string
  signedImageUrl: string | null
  recorded_at: string
  created_at: string
}

/** 메시지 답장이 가리키는 원래 메시지. 말풍선 안 「수진에게 답장 / 원문」과 원문으로 이동에 쓴다. */
export type RepliedMessage = {
  id: string
  user_id: string
  content: string
}

export type RoomMessage = {
  id: string
  group_id: string
  user_id: string
  content: string
  created_at: string
  /** 답장이었나. 기록이 지워지면 post는 null이고 이 값만 남는다(「지운 기록」). */
  is_reply: boolean
  post: QuotedPost | null
  /** 다른 메시지에 단 답장이었나. 원문이 지워지면 reply_to는 null이고 이 값만 남는다(「지운 메시지」). */
  is_message_reply: boolean
  reply_to: RepliedMessage | null
}

/** 방 멤버 한 명의 읽음 상태 — 메시지마다 안 읽은 사람 수를 센다. */
export type RoomReadState = {
  user_id: string
  joined_at: string
  /** 방 채팅을 마지막으로 연 시각. 한 번도 안 열었으면 null */
  chat_read_at: string | null
}

/** 한 번에 불러오는 메시지 수. 위로 올리면 이만큼 더. */
export const MESSAGE_PAGE_SIZE = 50
export const MESSAGE_MAX_LENGTH = 1000
