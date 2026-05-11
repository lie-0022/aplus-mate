'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BadgeDisplay from '@/components/ui/BadgeDisplay'

export default function MatchingPage() {
  const searchParams = useSearchParams()
  const courseId = searchParams.get('course_id')
  const [users, setUsers] = useState<any[]>([])
  const [course, setCourse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [message, setMessage] = useState('')
  const [badgeFilter, setBadgeFilter] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    if (courseId) {
      loadData()
    }
  }, [courseId])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    // Load course info
    const { data: courseData } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId!)
      .single()
    setCourse(courseData)

    // Load users enrolled in this course (excluding current user)
    const { data: enrollments } = await supabase
      .from('user_courses')
      .select(`
        user_id,
        users (*)
      `)
      .eq('course_id', courseId!)
      .neq('user_id', user.id)

    if (enrollments) {
      // Load badges for each user
      const userIds = enrollments.map((e: any) => e.user_id)
      const { data: badges } = await supabase
        .from('badges')
        .select('*')
        .in('user_id', userIds)

      const usersWithBadges = enrollments.map((e: any) => ({
        ...e.users,
        badges: badges?.filter((b: any) => b.user_id === e.user_id) || [],
      }))

      setUsers(usersWithBadges)
    }

    setLoading(false)
  }

  const handleConnect = async (receiverId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if already has accepted match for this course
    const { data: existingMatch } = await supabase
      .from('team_matches')
      .select('*')
      .eq('course_id', courseId!)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)

    if (existingMatch && existingMatch.length > 0) {
      setMessage('이미 이 수업에서 매칭된 팀이 있습니다.')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    // Check if already sent request to this user
    const { data: existingRequest } = await supabase
      .from('team_matches')
      .select('*')
      .eq('requester_id', user.id)
      .eq('receiver_id', receiverId)
      .eq('course_id', courseId!)
      .eq('status', 'pending')

    if (existingRequest && existingRequest.length > 0) {
      setMessage('이미 요청을 보냈습니다.')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    const { error } = await supabase.from('team_matches').insert({
      requester_id: user.id,
      receiver_id: receiverId,
      course_id: courseId!,
    } as any)

    if (error) {
      setMessage('요청 중 오류가 발생했습니다.')
    } else {
      setMessage('커넥트 요청을 보냈습니다!')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const filteredUsers = badgeFilter === 'all'
    ? users
    : users.filter((u) => u.badges.some((b: any) => b.badge_type === badgeFilter))

  if (!courseId) {
    return (
      <div className="p-4 text-center text-gray-500">
        수업을 선택해주세요.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
      </div>
    )
  }

  return (
    <div className="p-4">
      <Link href={`/courses/${courseId}`} className="text-sm text-gray-500 flex items-center gap-1 mb-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        뒤로
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">팀원 찾기</h1>
      {course && (
        <p className="text-sm text-gray-500 mb-4">{course.name} · {course.professor} 교수</p>
      )}

      {message && (
        <div className="mb-4 p-3 bg-primary-light border border-primary/20 rounded-lg text-primary text-sm">
          {message}
        </div>
      )}

      {/* Badge Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {[
          { key: 'all', label: '전체' },
          { key: 'promise', label: '🤝 약속 철저' },
          { key: 'idea', label: '💡 아이디어' },
          { key: 'deadline', label: '⏰ 마감 준수' },
        ].map((filter) => (
          <button
            key={filter.key}
            onClick={() => setBadgeFilter(filter.key)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              badgeFilter === filter.key
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* User List */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          해당 조건의 팀원이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <div key={user.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900">
                      {user.department} · {user.year}학년
                    </h3>
                  </div>
                  {user.skill_tags && user.skill_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {user.skill_tags.map((tag: string) => (
                        <span key={tag} className="badge-pill bg-secondary-light text-secondary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <BadgeDisplay badges={user.badges} />
                </div>
                <button
                  onClick={() => handleConnect(user.id)}
                  className="btn-primary text-sm py-1.5 px-3 ml-3"
                >
                  커넥트
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
