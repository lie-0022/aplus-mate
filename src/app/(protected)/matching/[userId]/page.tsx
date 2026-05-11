'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BadgeDisplay from '@/components/ui/BadgeDisplay'

export default function MatchingProfilePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const userId = params.userId as string
  const courseId = searchParams.get('course_id')
  const [user, setUser] = useState<any>(null)
  const [badges, setBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, [userId])

  const loadProfile = async () => {
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    const { data: badgeData } = await supabase
      .from('badges')
      .select('*')
      .eq('user_id', userId)

    setUser(userData)
    setBadges(badgeData || [])
    setLoading(false)
  }

  const handleConnect = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser || !courseId) return

    const { error } = await supabase.from('team_matches').insert({
      requester_id: currentUser.id,
      receiver_id: userId,
      course_id: courseId,
    } as any)

    if (error) {
      setMessage('요청 중 오류가 발생했습니다.')
    } else {
      setMessage('커넥트 요청을 보냈습니다!')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
      </div>
    )
  }

  if (!user) {
    return <div className="p-4 text-center text-gray-500">사용자를 찾을 수 없습니다.</div>
  }

  return (
    <div className="p-4">
      <Link
        href={courseId ? `/matching?course_id=${courseId}` : '/matching/requests'}
        className="text-sm text-gray-500 flex items-center gap-1 mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        뒤로
      </Link>

      {message && (
        <div className="mb-4 p-3 bg-primary-light border border-primary/20 rounded-lg text-primary text-sm">
          {message}
        </div>
      )}

      <div className="card p-6">
        {/* Profile Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 blur-sm select-none">
            {user.name}
          </h2>
          <p className="text-sm text-gray-400 mt-1">매칭 후 이름이 공개됩니다</p>
        </div>

        {/* Info */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">학과</span>
            <span className="text-sm font-medium">{user.department}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">학년</span>
            <span className="text-sm font-medium">{user.year}학년</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">카카오 오픈채팅</span>
            <span className="text-sm text-gray-400 blur-sm select-none">비공개</span>
          </div>
        </div>

        {/* Skills */}
        {user.skill_tags && user.skill_tags.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">스킬 태그</h3>
            <div className="flex flex-wrap gap-1.5">
              {user.skill_tags.map((tag: string) => (
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

        {/* Connect Button */}
        {courseId && (
          <button onClick={handleConnect} className="btn-primary w-full py-3">
            커넥트 요청하기
          </button>
        )}
      </div>
    </div>
  )
}
