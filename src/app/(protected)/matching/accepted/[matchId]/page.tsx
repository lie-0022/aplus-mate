'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BadgeDisplay from '@/components/ui/BadgeDisplay'

export default function AcceptedMatchPage() {
  const params = useParams()
  const matchId = params.matchId as string
  const [match, setMatch] = useState<any>(null)
  const [partner, setPartner] = useState<any>(null)
  const [badges, setBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadMatch()
  }, [matchId])

  const loadMatch = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: matchRaw } = await supabase
      .from('team_matches')
      .select(`
        *,
        courses (*)
      `)
      .eq('id', matchId)
      .single()

    const matchData = matchRaw as any
    if (!matchData) {
      setLoading(false)
      return
    }

    setMatch(matchData)

    // Determine partner
    const partnerId = matchData.requester_id === user.id
      ? matchData.receiver_id
      : matchData.requester_id

    const { data: partnerData } = await supabase
      .from('users')
      .select('*')
      .eq('id', partnerId)
      .single()

    const { data: badgeData } = await supabase
      .from('badges')
      .select('*')
      .eq('user_id', partnerId)

    setPartner(partnerData)
    setBadges(badgeData || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
      </div>
    )
  }

  if (!match || !partner) {
    return <div className="p-4 text-center text-gray-500">매칭 정보를 찾을 수 없습니다.</div>
  }

  return (
    <div className="p-4">
      <Link href="/teams" className="text-sm text-gray-500 flex items-center gap-1 mb-4">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        뒤로
      </Link>

      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          매칭 완료
        </div>
      </div>

      <div className="card p-6">
        {/* Profile Header - Full Info */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{partner.name}</h2>
          <p className="text-sm text-gray-500">{match.courses?.name}</p>
        </div>

        {/* Full Info */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">이름</span>
            <span className="text-sm font-medium">{partner.name}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">학교</span>
            <span className="text-sm font-medium">{partner.university}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">학과</span>
            <span className="text-sm font-medium">{partner.department}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">학년</span>
            <span className="text-sm font-medium">{partner.year}학년</span>
          </div>
        </div>

        {/* Skills */}
        {partner.skill_tags && partner.skill_tags.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">스킬 태그</h3>
            <div className="flex flex-wrap gap-1.5">
              {partner.skill_tags.map((tag: string) => (
                <span key={tag} className="badge-pill bg-secondary-light text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Badges */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">배지</h3>
          <BadgeDisplay badges={badges} />
        </div>

        {/* Kakao Open Chat */}
        {partner.kakao_openchat_url && (
          <a
            href={partner.kakao_openchat_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary w-full text-center block py-3"
          >
            카카오 오픈채팅으로 연락하기
          </a>
        )}

        {!partner.kakao_openchat_url && (
          <div className="text-center text-sm text-gray-400 py-3">
            상대방이 아직 카카오 오픈채팅 URL을 등록하지 않았습니다.
          </div>
        )}
      </div>
    </div>
  )
}
