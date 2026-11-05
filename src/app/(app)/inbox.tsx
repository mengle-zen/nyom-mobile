import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useMyGroups } from '@/entities/group'
import { localDayKey, postImageSource } from '@/entities/post'
import {
  filterInbox,
  inboxMessage,
  inboxSection,
  inboxTime,
  isUnread,
  useInbox,
  useInboxSeenAt,
  useMarkInboxSeen,
  INBOX_DAYS,
  type InboxFilter,
  type InboxItem,
  type InboxKind,
  type InboxProfile,
} from '@/features/inbox'
import { boardHref, chatHref } from '@/shared/lib/board-href'
import { SwipeBack } from '@/shared/ui/swipe-back'

const FILTERS: { value: InboxFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'post', label: '기록' },
  { value: 'reaction', label: '리액션' },
  { value: 'reply', label: '답장' },
]

/** 얼굴 옆 작은 배지 — 무슨 알림인지 */
const KIND_ICON: Record<InboxKind, keyof typeof Ionicons.glyphMap> = {
  post: 'camera',
  reaction: 'heart',
  reply: 'chatbubble',
}

type Row = { type: 'section'; key: string; label: string } | { type: 'item'; key: string; item: InboxItem }

/**
 * 알림 모아보기(2026-11-05 시안 A) — 그룹 목록 오른쪽 위 종에서 연다.
 *
 * 최근 2주의 친구 기록·내 기록에 달린 리액션·답장을 모은다(features/inbox). 들어올 때까지
 * 못 본 줄은 연한 주황으로 칠하고, 화면을 떠날 때 「여기까지 봤다」를 남겨 종의 점을 끈다.
 * 기록·리액션은 그날 타임테이블로, 답장은 대화방으로 간다.
 */
export default function InboxScreen() {
  const insets = useSafeAreaInsets()
  const inbox = useInbox()
  const { data: seenAt } = useInboxSeenAt()
  const { mutate: markSeen } = useMarkInboxSeen()
  const { data: groups } = useMyGroups()
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [refreshing, setRefreshing] = useState(false)

  // 보는 동안은 강조를 그대로 두고, 떠날 때 봤다고 남긴다.
  useFocusEffect(useCallback(() => () => markSeen(), [markSeen]))

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.navigate('/(app)/groups' as never)
  }

  const groupName = useMemo(() => new Map((groups ?? []).map((g) => [g.id, g.name])), [groups])

  const rows = useMemo<Row[]>(() => {
    const now = new Date()
    const out: Row[] = []
    let section = ''
    for (const item of filterInbox(inbox.data?.items ?? [], filter)) {
      const label = inboxSection(new Date(item.createdAt), now)
      if (label !== section) {
        section = label
        out.push({ type: 'section', key: `s:${label}`, label })
      }
      out.push({ type: 'item', key: item.key, item })
    }
    return out
  }, [inbox.data, filter])

  const open = (item: InboxItem) => {
    if (item.kind === 'reply') router.push(chatHref(item.groupId))
    else if (item.postCreatedAt)
      router.push(boardHref(item.groupId, { date: localDayKey(new Date(item.postCreatedAt)) }))
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await inbox.refetch().catch(() => {})
    setRefreshing(false)
  }

  return (
    <SwipeBack onBack={goBack} backdrop="#EDE4D6">
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-header flex-row items-center gap-1 border-b border-border/50 px-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            onPress={goBack}
            hitSlop={6}
            className="size-icon items-center justify-center rounded-lg active:opacity-60"
          >
            <Ionicons name="chevron-back" size={22} color="#3A3329" />
          </Pressable>
          <Text accessibilityRole="header" className="text-base font-semibold text-foreground">
            알림
          </Text>
        </View>

        <View className="flex-row gap-2 px-4 pb-1 pt-3">
          {FILTERS.map((f) => {
            const on = f.value === filter
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className={`rounded-full border px-3 py-1 ${on ? 'border-foreground bg-foreground' : 'border-border bg-card'}`}
              >
                <Text className={`text-xs font-semibold ${on ? 'text-white' : 'text-muted-foreground'}`}>
                  {f.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {inbox.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FF7A2E" />
          </View>
        ) : inbox.error ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Text className="text-center text-sm text-muted-foreground">알림을 불러오지 못했어요</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void inbox.refetch()}
              className="h-control-sm justify-center rounded-xl border border-border px-4 active:opacity-70"
            >
              <Text className="text-sm font-medium text-foreground">다시 시도</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#A89A82" />
            }
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-8 py-20">
                <Text className="text-center text-sm text-muted-foreground">
                  최근 {INBOX_DAYS}일 동안 온 알림이 없어요
                </Text>
              </View>
            }
            renderItem={({ item: row }) =>
              row.type === 'section' ? (
                <Text accessibilityRole="header" className="px-4 pb-1.5 pt-4 text-xs font-bold text-muted-foreground">
                  {row.label}
                </Text>
              ) : (
                <InboxRow
                  item={row.item}
                  profile={inbox.data?.profiles.get(row.item.actorId)}
                  room={groupName.get(row.item.groupId) ?? ''}
                  unread={isUnread(row.item, seenAt ?? null)}
                  onPress={() => open(row.item)}
                />
              )
            }
          />
        )}
      </View>
    </SwipeBack>
  )
}

function InboxRow({
  item,
  profile,
  room,
  unread,
  onPress,
}: {
  item: InboxItem
  profile: InboxProfile | undefined
  room: string
  unread: boolean
  onPress: () => void
}) {
  // 방을 나가 프로필을 볼 수 없으면 이름을 모른다.
  const name = profile?.nickname ?? '나간 친구'
  const message = inboxMessage(item)
  const time = inboxTime(new Date(item.createdAt), new Date())
  const thumb = item.thumb ? postImageSource(item.thumb) : null

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? '새 알림, ' : ''}${name}${message}, ${room}, ${time}`}
      className={`flex-row items-center gap-3 px-4 py-2.5 active:opacity-70 ${unread ? 'bg-primary-50' : ''}`}
    >
      <View>
        <View className="size-10 items-center justify-center overflow-hidden rounded-full bg-primary-100">
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ width: 40, height: 40 }} contentFit="cover" />
          ) : (
            <Text className="text-sm font-bold text-primary-700">{name.slice(0, 1)}</Text>
          )}
        </View>
        <View className="absolute -bottom-1 -right-1 size-5 items-center justify-center rounded-full border-2 border-background bg-primary">
          <Ionicons name={KIND_ICON[item.kind]} size={10} color="#fff" />
        </View>
      </View>
      <View className="flex-1">
        <Text numberOfLines={2} className="text-sm leading-snug text-foreground">
          <Text className="font-bold">{name}</Text>
          {message}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {room ? `${room} · ` : ''}
          {time}
        </Text>
      </View>
      {thumb && (
        <Image source={thumb} style={{ width: 44, height: 44, borderRadius: 8 }} contentFit="cover" />
      )}
    </Pressable>
  )
}
