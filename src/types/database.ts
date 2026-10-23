/**
 * Supabase Database 타입 정의
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nickname: string
          avatar_url: string | null
          invite_code: string
          created_at: string
        }
        Insert: {
          id: string
          nickname: string
          avatar_url?: string | null
          invite_code: string
          created_at?: string
        }
        Update: {
          id?: string
          nickname?: string
          avatar_url?: string | null
          invite_code?: string
          created_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          user_id: string
          image_url: string
          caption: string | null
          created_at: string
          recorded_at: string
          batch_id: string | null
          group_id: string | null
          meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null
          /** 사용자 태그 — meal_slot과 둘 중 하나만 (20261021000000_meal_tag.sql) */
          meal_tag: string | null
        }
        Insert: {
          id?: string
          user_id: string
          image_url: string
          caption?: string | null
          created_at?: string
          recorded_at?: string
          batch_id?: string | null
          group_id?: string | null
          meal_slot?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null
          meal_tag?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          image_url?: string
          caption?: string | null
          created_at?: string
          recorded_at?: string
          batch_id?: string | null
          group_id?: string | null
          meal_slot?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null
          meal_tag?: string | null
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          invite_code: string
          created_by: string
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code: string
          created_by: string
          is_public?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          created_by?: string
          is_public?: boolean
          created_at?: string
        }
      }
      group_members: {
        Row: {
          group_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          group_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          group_id?: string
          user_id?: string
          joined_at?: string
        }
      }
      group_join_requests: {
        Row: {
          id: string
          group_id: string
          requester_id: string
          status: 'pending' | 'approved' | 'rejected'
          reject_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          requester_id: string
          status?: 'pending' | 'approved' | 'rejected'
          reject_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          requester_id?: string
          status?: 'pending' | 'approved' | 'rejected'
          reject_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      group_bans: {
        Row: {
          group_id: string
          user_id: string
          reason: 'kicked' | 'rejected_twice'
          created_at: string
        }
        Insert: {
          group_id: string
          user_id: string
          reason: 'kicked' | 'rejected_twice'
          created_at?: string
        }
        Update: {
          group_id?: string
          user_id?: string
          reason?: 'kicked' | 'rejected_twice'
          created_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          post_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
      }
      reactions: {
        Row: {
          post_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          post_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          post_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
        }
      }
      // 네이티브 전용 테이블. Expo push token은 Web Push 구독(endpoint/p256dh/auth)과
      // 형태가 완전히 달라 push_subscriptions를 재사용하지 않는다.
      // 스키마 근거는 supabase/migrations/20260828030000_expo_push_tokens.sql 참고.
      // 주의: 해당 마이그레이션은 아직 적용되지 않았다.
      expo_push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          platform: 'ios' | 'android'
          device_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          platform: 'ios' | 'android'
          device_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          platform?: 'ios' | 'android'
          device_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notification_settings: {
        Row: {
          user_id: string
          post_enabled: boolean
          reaction_enabled: boolean
          reminder_enabled: boolean
          updated_at: string
        }
        Insert: {
          user_id: string
          post_enabled?: boolean
          reaction_enabled?: boolean
          reminder_enabled?: boolean
          updated_at?: string
        }
        Update: {
          user_id?: string
          post_enabled?: boolean
          reaction_enabled?: boolean
          reminder_enabled?: boolean
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_group_member: {
        Args: { p_group: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { p_group: string }
        Returns: boolean
      }
      create_group: {
        Args: { p_name: string }
        Returns: {
          id: string
          name: string
          invite_code: string
          created_by: string
          is_public: boolean
          created_at: string
        }
      }
      join_group_by_code: {
        Args: { p_invite_code: string }
        Returns: {
          id: string
          name: string
          invite_code: string
          created_by: string
          is_public: boolean
          created_at: string
        } | null
      }
      rotate_group_invite_code: {
        Args: { p_group_id: string }
        Returns: Database['public']['Tables']['groups']['Row']
      }
      list_public_groups: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          is_public: boolean
          created_by: string
          created_at: string
          member_count: number
          user_status: 'none' | 'member' | 'requested' | 'banned'
        }[]
      }
      request_to_join_group: {
        Args: { p_group_id: string }
        Returns: {
          id: string
          group_id: string
          requester_id: string
          status: 'pending' | 'approved' | 'rejected'
          reject_count: number
          created_at: string
          updated_at: string
        }
      }
      approve_join_request: {
        Args: { p_request_id: string }
        Returns: void
      }
      reject_join_request: {
        Args: { p_request_id: string }
        Returns: void
      }
      kick_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: void
      }
      update_group: {
        Args: { p_group_id: string; p_name?: string; p_is_public?: boolean }
        Returns: {
          id: string
          name: string
          invite_code: string
          created_by: string
          is_public: boolean
          created_at: string
        }
      }
      leave_group: {
        Args: { p_group_id: string }
        Returns: void
      }
      my_meal_count: {
        Args: Record<string, never>
        Returns: number
      }
      /** batch 사후 편집 — 그룹 추가/제거 + 메모·시각을 원자적으로 적용 */
      update_post_batch: {
        Args: {
          p_post_id: string
          p_group_ids: string[]
          p_caption: string | null
          p_recorded_at: string | null
          /** 끼니 인자는 둘 다 null이면 유지, 하나만 보낸다 (20261021000000_meal_tag.sql) */
          p_meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null
          p_meal_tag: string | null
        }
        Returns: void
      }
      /** batch 전체 삭제. 반환값 = 정리할 스토리지 경로 */
      delete_post_batch: {
        Args: { p_post_id: string }
        Returns: string | null
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Post = Database['public']['Tables']['posts']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type Reaction = Database['public']['Tables']['reactions']['Row']
export type Group = Database['public']['Tables']['groups']['Row']
export type GroupMember = Database['public']['Tables']['group_members']['Row']
export type GroupJoinRequest = Database['public']['Tables']['group_join_requests']['Row']
export type GroupBan = Database['public']['Tables']['group_bans']['Row']
export type NotificationSettingsRow =
  Database['public']['Tables']['notification_settings']['Row']
export type ExpoPushTokenRow =
  Database['public']['Tables']['expo_push_tokens']['Row']
