import type { GenericStatus } from '../auth/types'

export type MembershipAudience = 'management' | 'employee' | 'public'

interface ParentPlanVisibilityRecord {
  status: GenericStatus
  archived_at: string | null
  deleted_at: string | null
}

interface ChildVisibilityRecord {
  status: GenericStatus
  archived_at: string | null
  deleted_at: string | null
  membership_plan: ParentPlanVisibilityRecord | null
}

function isActiveParentPlan(plan: ParentPlanVisibilityRecord | null) {
  return Boolean(plan) && plan?.status === 'active' && plan.archived_at === null && plan.deleted_at === null
}

function isVisibleParentPlan(plan: ParentPlanVisibilityRecord | null, audience: MembershipAudience) {
  if (!plan || plan.deleted_at !== null) {
    return false
  }

  if (audience === 'management') {
    return true
  }

  return isActiveParentPlan(plan)
}

export function isVisibleMembershipBenefit(
  benefit: ChildVisibilityRecord,
  audience: MembershipAudience,
) {
  if (benefit.deleted_at !== null) {
    return false
  }

  if (!isVisibleParentPlan(benefit.membership_plan, audience)) {
    return false
  }

  if (audience === 'public') {
    return benefit.status === 'active' && benefit.archived_at === null
  }

  return true
}

export function isVisibleComplimentaryItem(
  item: ChildVisibilityRecord,
  audience: MembershipAudience,
) {
  if (item.deleted_at !== null) {
    return false
  }

  if (!isVisibleParentPlan(item.membership_plan, audience)) {
    return false
  }

  if (audience === 'public') {
    return item.status === 'active' && item.archived_at === null
  }

  return true
}

