import { useEffect, useRef, useState } from 'react'
import { Platform, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { canSendMessage, MESSAGE_MAX_LENGTH } from '@/entities/message'
import { PressableScale } from '@/shared/ui/press'
import { useKeyboardShown } from '@/shared/ui/use-keyboard-shown'

type Props = {
  /** 보낸 내용이 서버에 닿으면 resolve, 실패하면 reject. 실패하면 입력을 지우지 않는다. */
  onSend: (content: string) => Promise<unknown>
  sending: boolean
  bottomInset: number
  /** 답장하려는 메시지. 입력줄 위에 「수진에게 답장 / 원문」이 붙는다. */
  replyingTo: { id: string; title: string; text: string } | null
  onCancelReply: () => void
}

/** 채팅 입력줄. 여러 줄로 늘어나다 몇 줄 넘으면 안에서 스크롤한다. */
export function Composer({ onSend, sending, bottomInset, replyingTo, onCancelReply }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<TextInput>(null)
  const replyId = replyingTo?.id ?? null
  const keyboardShown = useKeyboardShown()
  const enabled = canSendMessage(text) && !sending

  // 밀어서 답장을 고르면 바로 칠 수 있게 키보드를 올린다.
  useEffect(() => {
    if (replyId) inputRef.current?.focus()
  }, [replyId])

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
      className="gap-2 border-t border-white/10 bg-board-bg px-3 pt-2"
      style={{ paddingBottom: keyboardShown ? 8 : Math.max(bottomInset, 8) }}
    >
      {replyingTo && (
        <View className="flex-row items-center gap-3 px-1">
          <View className="flex-1" accessible accessibilityLabel={`${replyingTo.title}: ${replyingTo.text}`}>
            <Text numberOfLines={1} className="text-xs font-bold text-primary-200">
              {replyingTo.title}
            </Text>
            <Text numberOfLines={1} className="text-xs text-white/45">
              {replyingTo.text}
            </Text>
          </View>
          <PressableScale
            onPress={onCancelReply}
            hapticKind={null}
            accessibilityRole="button"
            accessibilityLabel="답장 취소"
            hitSlop={8}
            className="size-7 items-center justify-center rounded-full bg-white/10"
          >
            <Ionicons name="close" size={15} color="#fff" />
          </PressableScale>
        </View>
      )}
      <View className="flex-row items-end gap-2">
        <TextInput
          ref={inputRef}
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
    </View>
  )
}
