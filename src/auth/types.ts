import type { Session, User } from '@supabase/supabase-js'

export type PermissionLevel =
  | 'admin'
  | 'management'
  | 'employee'
  | 'customer'

export type AccessLevel = 'management' | 'employee' | 'customer'

export type AuthStatus =
  | 'loading'
  | 'signed_out'
  | 'setup'
  | 'inactive'
  | 'ready'
  | 'config_missing'

export interface PortalUserRecord {
  id: string
  email: string
  permission_level: PermissionLevel
  is_active: boolean
  employee_id: string | null
  customer_id: string | null
}

export interface RankRecord {
  id: string
  rank_name: string
  display_order: number
  description: string | null
  responsibilities: string | null
  can_tow_repair: boolean
  can_customize_vehicle: boolean
  can_upgrade_vehicle: boolean
  can_sell_harness: boolean
  can_train_mechanics: boolean
  can_sell_membership: boolean
  can_manage_employees: boolean
  can_manage_ranks: boolean
  can_manage_memberships: boolean
  can_manage_prices: boolean
  can_manage_service_providers: boolean
  can_manage_outfit_guide: boolean
  can_manage_store_collaborations: boolean
  can_view_cost_price: boolean
  hiring_status: 'open' | 'closed'
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
  is_active: boolean
  is_management_rank: boolean
}

export interface EmployeeRecord {
  id: string
  character_name: string
  citizen_id: string
  phone_number: string | null
  discord_username: string | null
  rank_id: string | null
  division: string | null
  hire_date: string
  last_promotion_date: string | null
  warnings: number
  strike_1: boolean
  strike_2: boolean
  total_bills: string | number
  status: 'active' | 'inactive' | 'on_leave' | 'archived'
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
  rank: RankRecord | null
}

export type SeparationType = 'fired' | 'resigned'

export type ProviderStatus =
  | 'active'
  | 'inactive'
  | 'on_leave'
  | 'under_consideration'
  | 'archived'

export type GenericStatus = 'active' | 'inactive' | 'archived'

export interface ExEmployeeRecord {
  id: string
  employee_id: string | null
  character_name: string
  citizen_id: string
  phone_number: string | null
  discord_username: string | null
  rank_name_snapshot: string
  division: string | null
  hire_date: string
  last_promotion_date: string | null
  leave_date: string
  separation_type: SeparationType
  reason: string | null
  warnings: number
  strike_1: boolean
  strike_2: boolean
  total_bills: string | number
  restored_at: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

export interface ManagementTeamRecord {
  id: string
  display_name: string
  company_name: string
  management_role: string
  phone_number: string | null
  discord_username: string | null
  responsibilities: string | null
  provider_status: ProviderStatus
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

export interface StoreCollaborationRecord {
  id: string
  store_name: string
  contact_name: string | null
  phone_number: string | null
  discord_username: string | null
  collaboration_type: string | null
  notes: string | null
  status: GenericStatus
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

export interface OutfitGuideRecord {
  id: string
  title: string
  category: string | null
  description: string | null
  image_url: string | null
  status: GenericStatus
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

export interface PriceItemRecord {
  id: string
  category: string
  item_name: string
  item_cost: string | number
  common_selling_price: string | number
  government_selling_price: string | number
  status: GenericStatus
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

export interface MembershipPlanRecord {
  id: string
  plan_name: string
  plan_price: string | number
  description: string | null
  notes: string | null
  status: GenericStatus
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

export interface MembershipBenefitPlanRecord {
  id: string
  plan_name: string
  plan_price: string | number
  status: GenericStatus
  archived_at: string | null
  deleted_at: string | null
}

export interface MembershipBenefitPriceItemRecord {
  id: string
  category: string
  item_name: string
  common_selling_price: string | number
  status: GenericStatus
  archived_at: string | null
  deleted_at: string | null
}

export interface MembershipBenefitRecord {
  id: string
  membership_plan_id: string
  price_item_id: string
  discount_percent: string | number
  status: GenericStatus
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
  membership_plan: MembershipBenefitPlanRecord | null
  price_item: MembershipBenefitPriceItemRecord | null
}

export interface MembershipComplimentaryItemRecord {
  id: string
  membership_plan_id: string
  price_item_id: string
  quantity: number
  status: GenericStatus
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
  membership_plan: MembershipBenefitPlanRecord | null
  price_item: MembershipBenefitPriceItemRecord | null
}

export type MembershipRecordStatus = 'active' | 'expired' | 'cancelled' | 'archived'

export interface MembershipRecordMembershipPlanRecord {
  id: string
  plan_name: string
  plan_price: string | number
  status: GenericStatus
  archived_at: string | null
  deleted_at: string | null
}

export interface MembershipRecordEmployeeRecord {
  id: string
  character_name: string
  citizen_id: string
  phone_number: string | null
  discord_username: string | null
  status: EmployeeRecord['status']
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

export interface MembershipRecordCustomerProfileRecord {
  id: string
  character_name: string
  citizen_id: string
  phone_number: string | null
  discord_username: string | null
  notes: string | null
  status: GenericStatus
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

export interface MembershipRecordRecord {
  id: string
  customer_id: string | null
  membership_plan_id: string
  issued_by_employee_id: string | null
  given_date: string
  expiry_date: string | null
  complimentary_items_given: boolean
  status: MembershipRecordStatus
  notes: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
  customer_character_name: string | null
  customer_citizen_id: string | null
  customer_phone_number: string | null
  customer_discord_username: string | null
  customer: MembershipRecordCustomerProfileRecord | null
  membership_plan: MembershipRecordMembershipPlanRecord | null
  issued_by_employee: MembershipRecordEmployeeRecord | null
}

export interface CustomerRecord {
  id: string
  character_name: string
  citizen_id: string
  phone_number: string | null
  discord_username: string | null
  notes: string | null
  status: 'active' | 'inactive' | 'archived'
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

export interface AuditLogRecord {
  id: string
  actor_user_id: string | null
  action: string
  table_name: string
  row_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
  actor_user: PortalUserRecord | null
}

export interface AuthState {
  status: AuthStatus
  session: Session | null
  authUser: User | null
  portalUser: PortalUserRecord | null
  employee: EmployeeRecord | null
  customer: CustomerRecord | null
  accessLevel: AccessLevel | null
  error: string | null
}

export interface AuthContextValue extends AuthState {
  signInWithPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshAuthState: () => Promise<void>
}
