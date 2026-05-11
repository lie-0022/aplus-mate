'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BadgeDisplay from '@/components/ui/BadgeDisplay'

export default function TeamDetailPage() {
  const params = useParams()
  const teamId = params.id as string
  const router = useRouter()
  const [team, setTeam] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient() as any

  useEffect(() => {
    loadTeam()
  }, [teamId])

  const loadTeam = async () => {
    const { data: teamData } = await supabase
      .from('teams')
      .select(`
        *,
        courses (*)
      `)
      .eq('id', teamId)
      .single()

    const { data: memberData } = await supabase
      .from('team_members')
      .select(`
        *,
        users (*)
      `)
      .eq('team_id', teamId)

    if (memberData) {
      // Load badges for members
      const userIds = memberData.map((m: any) => m.user_id)
      const { data: badges } = await supabase
        .from('badges')
        .select('*')
        .in('user_id', userIds)

      const membersWithBadges = memberData.map((m: any) => ({
        ...m,
        users: {
          ...m.users,
          badges: badges?.filter((b: any) => b.user_id === m.user_id) || [],
        },
      }))

      setMembers(membersWithBadges)
    }

    setTeam(teamData)
    setLoading(false)
  }

  const handleComplete = async () => {
    setCompleting(true)

    const { error } = await supabase
      .from('teams')
      .update({ status: 'completed', evaluation_status: 'in_progress' })
      .eq('id', teamId)

    if (error) {
      setMessage('완료 처리 중 오류가 발생했습니다.')
      setCompleting(false)
      return
    }

    router.push(`/teams/${teamId}/evaluate`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
      </div>
    )
  }

  if (!team) {
    return <div className="p-4 text-center text-gray-500">팀을 찾을 수 없습니다.</div>
  }

  return (
    <div className="p-4">
      <Link href="/teams" className="text-sm text-gray-500 flex items-center gap-1 mb-4">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        뒤로
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{team.courses?.name}</h1>
        <p className="text-sm text-gray-500">{team.courses?.professor} 교수</p>
        <span className={`badge-pill mt-2 ${
          team.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {team.status === 'active' ? '진행 중' : '완료'}
        </span>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-primary-light border border-primary/20 rounded-lg text-primary text-sm">
          {message}
        </div>
      )}

      {/* Team Members */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">팀원</h2>
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{member.users?.name}</h3>
                  <p className="text-sm text-gray-500">
                    {member.users?.department} · {member.users?.year}학년
                  </p>
                  <div className="mt-1">
                    <BadgeDisplay badges={member.users?.badges || []} />
                  </div>
                </div>
                {member.users?.kakao_openchat_url && (
                  <a
                    href={member.users.kakao_openchat_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary text-sm font-medium"
                  >
                    채팅
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kakao Links */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">카카오 오픈채팅</h2>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">{member.users?.name}</span>
              {member.users?.kakao_openchat_url ? (
                <a
                  href={member.users.kakao_openchat_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-secondary font-medium hover:underline"
                >
                  오픈채팅 열기
                </a>
              ) : (
                <span className="text-sm text-gray-400">미등록</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Complete Button */}
      {team.status === 'active' && (
        <button
          onClick={handleComplete}
          disabled={completing}
          className="btn-primary w-full py-3"
        >
          {completing ? '처리 중...' : '팀플 완료'}
        </button>
      )}

      {/* Evaluate Button */}
      {team.status === 'completed' && team.evaluation_status !== 'done' && (
        <Link
          href={`/teams/${teamId}/evaluate`}
          className="btn-primary w-full py-3 text-center block"
        >
          팀원 평가하기
        </Link>
      )}

      {team.evaluation_status === 'done' && (
        <div className="text-center py-4 text-sm text-gray-500">
          평가가 완료되었습니다.
        </div>
      )}
    </div>
  )
}
