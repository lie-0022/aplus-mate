'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function EvaluationDonePage() {
  const params = useParams()
  const teamId = params.id as string
  const [badges, setBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAnimation, setShowAnimation] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadBadges()
  }, [])

  const loadBadges = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('badges')
      .select('*')
      .eq('user_id', user.id)

    setBadges(data || [])
    setLoading(false)
    setTimeout(() => setShowAnimation(true), 300)
  }

  const badgeConfig: Record<string, { label: string; emoji: string; color: string }> = {
    promise: { label: '약속 철저', emoji: '🤝', color: 'from-blue-400 to-blue-600' },
    idea: { label: '아이디어 뱅크', emoji: '💡', color: 'from-yellow-400 to-yellow-600' },
    deadline: { label: '마감 준수', emoji: '⏰', color: 'from-green-400 to-green-600' },
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 min-h-screen flex flex-col items-center justify-center">
      <div className={`text-center transition-all duration-700 ${showAnimation ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">평가 완료!</h1>
        <p className="text-gray-500 mb-8">팀원 평가를 완료했습니다.</p>

        {badges.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">내 배지 현황</h2>
            <div className="grid grid-cols-1 gap-3">
              {badges.map((badge, index) => {
                const config = badgeConfig[badge.badge_type]
                return (
                  <div
                    key={badge.id}
                    className={`card p-4 transition-all duration-500 ${showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ transitionDelay: `${(index + 1) * 200}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center text-2xl`}>
                        {config.emoji}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{config.label}</p>
                        <p className="text-sm text-gray-500">x{badge.count}회 획득</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {badges.length === 0 && (
          <div className="mb-8 text-gray-400">
            <p>아직 획득한 배지가 없습니다.</p>
            <p className="text-sm mt-1">모든 팀원이 평가를 완료하면 배지가 부여됩니다.</p>
          </div>
        )}

        <div className="space-y-3">
          <Link href="/profile" className="btn-primary w-full block py-3 text-center">
            내 프로필 확인하기
          </Link>
          <Link href="/teams" className="btn-outline w-full block py-3 text-center">
            팀 목록으로
          </Link>
        </div>
      </div>
    </div>
  )
}
