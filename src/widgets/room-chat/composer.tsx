import { useState } from 'react'
import { Platform, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { canSendMessage, MESSAGE_MAX_LENGTH } from '@/entities/message'
import { PressableScale } from '@/shared/ui/press'

type Props = {
  /** 보낸 내용이 서버에 닿으면 resolve, 실패하면 reject. 실패하면 입력을 지우지 않는다. */
  onSend: (content: string) => Promise<unknown>
  sending: boolean
  bottomInset: number
}

/** 채팅 입력줄. 여러 줄로 늘어나다 몇 줄 넘으면 안에서 스크롤한다. */
export function Composer({ onSend, sending, bottomInset }: Props) {
  const [text, setText] = useState('')
  const enabled = canSendMessage(text) && !sending

  const send = () => {
    if (!enabled) return
    const sent = text
    onSend(sent.trim()).then(
      // 기다리는 사이 더 친 글자가 있으면 지우지 않는다.
      () => setText((cur) => (cur === sent ? '' : cur)),
      () => {},
    )
  }

  return (
    <View
      className="flex-row items-end gap-2 border-t border-white/10 bg-board-bg px-3 pt-2"
      style={{ paddingBottom: Math.max(bottomInset, 8) }}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="메시지"
        placeholderTextColor="rgba(255,255,255,0.4)"
        multiline
        maxLength={MESSAGE_MAX_LENGTH}
        accessibilityLabel="메시지"
        textAlignVertical={Platform.OS === 'android' ? 'center' : undefined}
        style={{ maxHeight: 120 }}
        className="min-h-10 flex-1 rounded-2xl bg-white/10 px-4 py-2.5 text-[15px] text-white"
      />
      <PressableScale
        onPress={send}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityLabel="보내기"
        accessibilityState={{ disabled: !enabled }}
        style={{ opacity: enabled ? 1 : 0.35 }}
        className="size-10 items-center justify-center rounded-full bg-primary"
      >
        <Ionicons name="arrow-up" size={20} color="#fff" />
      </PressableScale>
    </View>
  )
}
