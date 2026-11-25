import { supabase } from '../lib/supabase.js'

export async function logAudit({ actor, action, entityType, entityId = null, details = null }) {
  if (!supabase || !actor) return
  try {
    await supabase.from('audit_logs').insert({
      actor_role: actor.role,
      actor_id: actor.id,
      actor_email: actor.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    })
  } catch {
    // Audit failures should not block user actions.
  }
}
