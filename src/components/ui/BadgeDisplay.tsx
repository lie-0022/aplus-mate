'use client'

interface Badge {
  badge_type: 'promise' | 'idea' | 'deadline'
  count: number
}

const badgeConfig = {
  promise: {
    label: '약속 철저',
    emoji: '🤝',
    color: 'bg-blue-100 text-blue-700',
  },
  idea: {
    label: '아이디어 뱅크',
    emoji: '💡',
    color: 'bg-yellow-100 text-yellow-700',
  },
  deadline: {
    label: '마감 준수',
    emoji: '⏰',
    color: 'bg-green-100 text-green-700',
  },
}

export default function BadgeDisplay({ badges }: { badges: Badge[] }) {
  if (!badges || badges.length === 0) {
    return <span className="text-xs text-gray-400">배지 없음</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => {
        const config = badgeConfig[badge.badge_type]
        return (
          <span
            key={badge.badge_type}
            className={`badge-pill ${config.color}`}
          >
            {config.emoji} {config.label} x{badge.count}
          </span>
        )
      })}
    </div>
  )
}
