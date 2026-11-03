import { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { postImageSource, postTimeLabel } from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import type { GroupMemberProfile } from '@/entities/group'
import { canSendMessage, MESSAGE_MAX_LENGTH } from '@/entities/message'
import { ReactionBar } from '@/widgets/meal-tile'
import { PressableScale } from '@/shared/ui/press'
import { useKeyboardShown } from '@/shared/ui/use-keyboard-shown'

type Props = {
  /** 그 사람의 그날 기록, 시각순. 비어 있으면 닫힌 상태. */
  posts: BoardPost[]
  /** 처음 보여 줄 장 — 보드에서 누른 사진 */
  initialIndex: number
  member: GroupMemberProfile | null
  isMe: boolean
  currentUserId: string
  onReact: (postId: string, emoji: string) => void
  /** 보고 있는 장에 답장 — 방 채팅에 그 기록을 인용한 메시지로 올라간다. 실패하면 reject. */
  onReply: (postId: string, content: string) => Promise<void>
  onClose: () => void
}

/**
 * 사진 상세 — 전체화면 사진 + 작성자 + 끼니·시각 + 메모 + 리액션.
 *
 * 웹앱에는 사진을 크게 보는 화면이 아예 없었다. 친구가 뭘 먹었는지 자세히 보려는
 * 가장 자연스러운 동작(사진 탭)이 오히려 끼니를 넘겨버렸다(docs/UX_FINDINGS.md B항).
 *
 * 그 사람이 그날 올린 사진을 사진 영역에서 좌우로 넘겨 본다(2026-10-27부터 끼니 구분 없이
 * 그날 전체). 장마다 별개의 기록이라 시각·메모·리액션도 보고 있는 장을 따라 바뀐다.
 * 리액션은 시간 띠에 자리가 없어 여기서만 단다. 넘기는 건 사진 영역만 —
 * 화면 전체를 넘기게 하면 메모를 스크롤하려던 손가락이 장을 넘긴다.
 *
 * 맨 아래 입력칸은 인스타 스토리 답장처럼 보고 있는 장에 답장한다(2026-11-03 방 채팅).
 * 답장은 방 채팅에 그 기록을 인용해 올라가고, 여기에는 목록을 두지 않는다 — 상세는
 * 사진을 보는 곳이고 대화는 대화방에서 한다(docs/superpowers/specs/2026-11-03-room-chat-design.md).
 */
export function PostDetail({
  posts,
  initialIndex,
  member,
  isMe,
  currentUserId,
  onReact,
  onReply,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(initialIndex)
  const open = posts.length > 0 && member !== null
  // 보는 중에 장이 사라지면(삭제 등) 남은 마지막 장에 머문다.
  const post = posts[Math.min(index, posts.length - 1)]

  const onPageEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
  }

  return (
    <Modal
      visible={open}
      onRequestClose={onClose}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      {open && (
        // 입력칸이 키보드 위로 올라오고 사진 영역이 그만큼 줄어든다.
        // flex는 style로 — NativeWind `flex-1`이 KAV 내부의 높이 조정을 덮어쓴다(AGENTS.md).
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          className="bg-board-bg"
        >
          <View className="flex-1 bg-board-bg" style={{ paddingTop: insets.top }}>
            <View className="flex-row items-center gap-3 px-4 py-2">
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="닫기"
                hitSlop={8}
                className="size-9 items-center justify-center rounded-full bg-white/10 active:opacity-70"
              >
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
              <View className="flex-1">
                <Text className="text-base font-bold text-white">
                  {isMe ? '나' : member.nickname}
                </Text>
                <Text className="text-xs text-white/55">
                  {postTimeLabel(post.recorded_at, post.meal_tag)}
                </Text>
              </View>
            </View>

            <View className="flex-1 bg-black">
              <ScrollView
                horizontal
                pagingEnabled
                // 누른 사진부터 연다(첫 렌더에만 쓰인다 — 열 때마다 key로 새로 그린다)
                contentOffset={{ x: initialIndex * width, y: 0 }}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onPageEnd}
                // 한 장뿐이면 넘길 게 없다 — 끝에서 튕기는 것도 막는다.
                scrollEnabled={posts.length > 1}
              >
                {posts.map((p, i) => (
                  <View
                    key={p.id}
                    style={{ width }}
                    accessible={posts.length > 1}
                    accessibilityLabel={`사진 ${posts.length}장 중 ${i + 1}번째`}
                  >
                    <Photo post={p} />
                  </View>
                ))}
              </ScrollView>
              {posts.length > 1 && <PageDots count={posts.length} active={index} />}
            </View>

            <ScrollView
              style={{ maxHeight: 176 }}
              contentContainerStyle={{
                gap: 12,
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 12,
              }}
            >
              {post.caption ? (
                <Text className="text-sm leading-relaxed text-white/85">{post.caption}</Text>
              ) : (
                <Text className="text-sm text-white/30">메모 없이 올렸어요</Text>
              )}
              <ReactionBar
                postId={post.id}
                reactions={post.reactions}
                currentUserId={currentUserId}
                onReact={onReact}
                alwaysExpanded
              />
            </ScrollView>

            <ReplyComposer
              // 장을 넘기면 대상이 바뀐다 — 보내는 순간 보고 있는 장에 답장한다.
              postId={post.id}
              placeholder={isMe ? '이 기록에 대해 말하기…' : `${member.nickname}에게 답장…`}
              bottomInset={insets.bottom}
              onReply={onReply}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  )
}

const SENT_NOTICE_MS = 2000

/**
 * 답장 입력칸 한 줄 + 보내기.
 *
 * 보낸 뒤 확인을 앱 토스트로 띄우지 않고 여기 안에 짧게 적는다. 상세는 RN `Modal`이라
 * 루트의 Toaster가 모달 **아래**에 그려져 보이지 않는다.
 */
function ReplyComposer({
  postId,
  placeholder,
  bottomInset,
  onReply,
}: {
  postId: string
  placeholder: string
  bottomInset: number
  onReply: (postId: string, content: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<'sent' | 'failed' | null>(null)
  const keyboardShown = useKeyboardShown()
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    },
    [],
  )

  const canSend = canSendMessage(text) && !sending

  const send = async () => {
    if (!canSend) return
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setSending(true)
    setNotice(null)
    try {
      await onReply(postId, text.trim())
      setText('')
      Keyboard.dismiss()
      setNotice('sent')
      AccessibilityInfo.announceForAccessibility('대화방에 보냈어요')
      noticeTimer.current = setTimeout(() => setNotice(null), SENT_NOTICE_MS)
    } catch {
      // 쓴 글은 그대로 남겨 다시 누르기만 하면 되게 한다.
      setNotice('failed')
      AccessibilityInfo.announceForAccessibility('보내지 못했어요. 다시 보내 주세요')
    } finally {
      setSending(false)
    }
  }

  return (
    <View
      className="gap-1.5 px-4 pt-2"
      style={{ paddingBottom: keyboardShown ? 8 : bottomInset + 8 }}
    >
      <View accessibilityLiveRegion="polite">
        {notice === 'sent' && (
          <Text className="px-2 text-xs font-semibold text-white/70">대화방에 보냈어요</Text>
        )}
        {notice === 'failed' && (
          <Text className="px-2 text-xs font-semibold text-destructive">
            보내지 못했어요. 다시 보내 주세요
          </Text>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v)
            if (notice === 'failed') setNotice(null)
          }}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.45)"
          accessibilityLabel={placeholder.replace(/…$/, '')}
          maxLength={MESSAGE_MAX_LENGTH}
          returnKeyType="send"
          // 보내기 실패 시 키보드를 내리지 않고 그대로 다시 보낼 수 있게.
          submitBehavior="submit"
          onSubmitEditing={() => void send()}
          className="h-field flex-1 rounded-full bg-board-surface px-4 text-sm text-white"
        />
        <PressableScale
          onPress={() => void send()}
          disabled={!canSend}
          hapticKind={null}
          accessibilityRole="button"
          accessibilityLabel="보내기"
          accessibilityState={{ disabled: !canSend }}
          hitSlop={6}
          className="h-field justify-center px-2"
        >
          <Text
            className="text-sm font-bold"
            style={{ color: '#FF7A2E', opacity: canSend ? 1 : 0.35 }}
          >
            보내기
          </Text>
        </PressableScale>
      </View>
    </View>
  )
}

function Photo({ post }: { post: BoardPost }) {
  const [failed, setFailed] = useState(false)

  if (!post.signedImageUrl || failed) {
    return (
      <View className="flex-1 items-center justify-center gap-2">
        <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.4)" />
        <Text className="text-xs text-white/40">사진을 불러오지 못했어요</Text>
      </View>
    )
  }
  return (
    <Image
      source={postImageSource(post)}
      style={{ width: '100%', height: '100%' }}
      contentFit="contain"
      transition={120}
      onError={() => setFailed(true)}
    />
  )
}

/** 몇 번째 장인지. 각 장이 읽기 라벨을 갖고 있어 점 자체는 화면 읽기에서 뺀다. */
function PageDots({ count, active }: { count: number; active: number }) {
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="absolute inset-x-0 bottom-3 flex-row justify-center gap-1.5"
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className={`size-1.5 rounded-full ${i === active ? 'bg-white' : 'bg-white/35'}`}
        />
      ))}
    </View>
  )
}
