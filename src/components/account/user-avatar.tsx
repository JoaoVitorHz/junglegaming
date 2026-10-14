import type { User } from '@/api/contracts'
import { cn } from '@/lib/utils'

export function UserAvatar({ user, className }: { user: Pick<User, 'displayName' | 'avatarUrl'>; className?: string }) {
  const initials = user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className={cn('size-10 rounded-full border border-line-strong object-cover', className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn('grid size-10 place-items-center rounded-full border border-line-strong bg-surface-raised text-xs font-bold text-copper-bright', className)}
    >
      {initials || '?'}
    </span>
  )
}
