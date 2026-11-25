const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])

export function validateAvatarFile(file) {
  if (!file) throw new Error('Choose an image file.')
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Use a JPG, PNG, WebP, SVG, or GIF image.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image must be 2 MB or smaller.')
  }
}

function fileExtension(file) {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/svg+xml') return 'svg'
  return file.type.split('/')[1] || 'jpg'
}

export async function uploadAvatar(supabase, { file, userId, folder }) {
  if (!supabase) throw new Error('Supabase is not configured.')
  validateAvatarFile(file)
  const path = `${folder}/${userId}-${Date.now()}.${fileExtension(file)}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type,
  })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
