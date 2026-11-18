import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const THUMB = 48

/**
 * 올리기 화면의 사진 줄 — 여러 장 올리기(2026-11-17).
 *
 * 누르면 그 장으로 바꾼다. 장마다 기록 하나라 시각·태그·메모·자르기도 그 장 것으로 바뀐다.
 * 보고 있는 장에만 빼기(×)를 단다 — 모든 장에 달면 고르려다 빼는 실수가 잦다.
 * 「+」는 앨범에서 더 고른다. 다 차면 숨긴다.
 */
export function ShotStrip({
  thumbs,
  active,
  onSelect,
  onRemove,
  onAdd,
  disabled,
}: {
  thumbs: { key: string; uri: string; invalid: boolean }[]
  active: number
  onSelect: (index: number) => void
  onRemove: () => void
  /** 더 고를 수 없으면 null */
  onAdd: (() => void) | null
  disabled: boolean
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // ×가 썸네일 밖으로 반쯤 나와 있어 위쪽 여백(pt-2)을 둔다
      contentContainerClassName="items-center gap-2 px-4 pt-2"
      style={{ flexGrow: 0 }}
    >
      {thumbs.map((t, i) => {
        const selected = i === active
        return (
          <View key={t.key} style={{ width: THUMB, height: THUMB }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`사진 ${thumbs.length}장 중 ${i + 1}번째${t.invalid ? ', 시각을 다시 확인해 주세요' : ''}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(i)}
              className={`size-full overflow-hidden rounded-lg active:opacity-70 ${
                selected ? 'border-2 border-primary' : 'border border-white/25 opacity-70'
              }`}
            >
              <Image source={{ uri: t.uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            </Pressable>
            {t.invalid && (
              <View
                pointerEvents="none"
                className="absolute bottom-1 left-1 size-2.5 rounded-full bg-destructive"
              />
            )}
            {selected && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="이 사진 빼기"
                disabled={disabled}
                onPress={onRemove}
                hitSlop={8}
                className="absolute -right-1.5 -top-1.5 size-5 items-center justify-center rounded-full bg-neutral-900 active:opacity-70"
              >
                <Ionicons name="close" size={13} color="#fff" />
              </Pressable>
            )}
          </View>
        )
      })}
      {onAdd && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="앨범에서 사진 더 고르기"
          disabled={disabled}
          onPress={onAdd}
          style={{ width: THUMB, height: THUMB }}
          className="items-center justify-center rounded-lg border border-dashed border-white/40 active:opacity-70"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      )}
      {thumbs.length > 1 && (
        <Text className="ml-1 text-xs text-white/60">
          {active + 1}/{thumbs.length}
        </Text>
      )}
    </ScrollView>
  )
}
