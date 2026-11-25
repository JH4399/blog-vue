// PUT replaces all editable profile fields; empty fields explicitly clear them.
export function profilePayload(user) {
  return { nickname: user.nickname || null, email: user.email || null, avatar: user.avatar || null, bio: user.bio || null }
}
