import { supabase } from '../lib/supabase.js'

export async function fetchNotificationsForUser(currentUser) {
  if (!supabase || !currentUser?.id || !currentUser?.role) return []
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id,title,body,is_read,is_sensitive,created_at')
      .eq('user_role', currentUser.role)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function createNotification({ userRole, userId, title, body }) {
  if (!supabase) return
  try {
    await supabase.from('notifications').insert({
      user_role: userRole,
      user_id: userId,
      title,
      body,
    })
  } catch {
    /* optional table */
  }
}

export async function checkBudgetAndNotify({ userRole, userId, departmentName, costs, budget }) {
  if (!budget || budget <= 0) return
  const ratio = costs / budget
  if (ratio >= 1) {
    await createNotification({
      userRole,
      userId,
      title: 'Budget exceeded',
      body: `${departmentName} spend is over 100% of budget.`,
    })
  } else if (ratio >= 0.8) {
    await createNotification({
      userRole,
      userId,
      title: 'Budget warning',
      body: `${departmentName} spend reached 80% of budget.`,
    })
  }
}
