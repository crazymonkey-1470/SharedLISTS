export type Role = 'owner' | 'member'
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Profile {
  id: string
  display_name: string | null
  created_at: string
}

export interface Household {
  id: string
  name: string
  created_by: string | null
  created_at: string
}

export interface Membership {
  household_id: string
  role: Role
  joined_at: string
  household: Household
}

export interface Member {
  user_id: string
  role: Role
  joined_at: string
  display_name: string | null
}

export interface Invite {
  id: string
  household_id: string
  token: string
  created_by: string | null
  expires_at: string
  revoked: boolean
  created_at: string
}

export interface List {
  id: string
  household_id: string
  name: string
  position: number
  created_by: string | null
  created_at: string
}

export interface Item {
  id: string
  list_id: string
  household_id: string
  text: string
  done: boolean
  done_at: string | null
  added_by: string | null
  created_at: string
}

export interface CalEvent {
  id: string
  household_id: string
  title: string
  notes: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
  repeat: Repeat
  repeat_until: string | null
  list_id: string | null
  created_by: string | null
  created_at: string
}
