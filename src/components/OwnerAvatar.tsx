import { cn } from '@/lib/utils';
import { Owner } from '@/types/project';

interface OwnerAvatarProps {
  owner: Owner;
  size?: 'sm' | 'md';
}

export function OwnerAvatar({ owner, size = 'sm' }: OwnerAvatarProps) {
  const initials = owner.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white shrink-0 shadow-sm',
        size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'
      )}
      style={{ backgroundColor: owner.color }}
      title={owner.name}
    >
      {initials}
    </div>
  );
}
