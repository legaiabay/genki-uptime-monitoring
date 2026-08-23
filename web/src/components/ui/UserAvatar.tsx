import Avatar from 'boring-avatars'

interface UserAvatarProps {
  name: string
  size?: number
  borderRadius?: number | string
}

const PALETTE = ['#2d2d2d', '#e53e3e', '#c53030', '#9b2c2c', '#742a2a']

export default function UserAvatar({ name, size = 32, borderRadius = 8 }: UserAvatarProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius,
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Avatar
        size={size}
        name={name || '?'}
        variant="beam"
        colors={PALETTE}
      />
    </div>
  )
}
