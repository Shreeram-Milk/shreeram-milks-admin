const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')

/** Decorative initials badge; the name is always rendered beside it. */
export function InitialsAvatar({ name }: { name: string }) {
  return <span className="initials-avatar" aria-hidden="true">{initialsOf(name) || '?'}</span>
}
