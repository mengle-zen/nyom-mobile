import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { useAuth } from '@/features/auth'
import { useGroupMembers, useMyGroups } from '@/entities/group'
import { RoomChat } from '@/widgets/room-chat'
import { boardHref } from '@/shared/lib/board-href'
import { ErrorState } from '@/shared/ui/error-state'
import { PressableScale } from '@/shared/ui/press'

/** useLocalSearchParams는 같은 키가 여러 번 오면 배열을 준다. 첫 값만 쓴다. */
function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * 방 채팅 화면(`?group=`). 방 화면 헤더의 말풍선·채팅 푸시로 들어온다.
 *
 * 보드처럼 항상 어두운 화면이다 — 방 화면에서 넘어올 때 밝기가 튀지 않게.
 */
export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const groupId = one(useLocalSearchParams().group) ?? null

  const { data: groups } = useMyGroups()
  const { data: members = [] } = useGroupMembers(groupId)
  const group = groups?.find((g) => g.id === groupId)

  // 푸시로 곧장 열리면 돌아갈 화면이 없다 — 그때는 그 방으로 보낸다.
  const goBack = () => {
    if (router.canGoBack()) router.back()
    else if (groupId) router.replace(boardHref(groupId))
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      className="bg-board-bg"
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
          <PressableScale
            onPress={goBack}
            hapticKind={null}
            accessibilityRole="button"
            accessibilityLabel="방으로 돌아가기"
            hitSlop={6}
            className="size-9 items-center justify-center rounded-full bg-white/10"
          >
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </PressableScale>
          <View className="shrink flex-row items-baseline gap-2" accessible accessibilityRole="header">
            <Text numberOfLines={1} className="shrink text-base font-bold text-white">
              {group?.name ?? ''}
            </Text>
            {members.length > 0 && (
              <Text className="text-xs font-semibold text-white/55">{members.length}명</Text>
            )}
          </View>
        </View>

        {groupId && user ? (
          <RoomChat
            groupId={groupId}
            userId={user.id}
            members={members}
            bottomInset={insets.bottom}
          />
        ) : (
          <ErrorState message="방을 찾지 못했어요" onRetry={goBack} />
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
