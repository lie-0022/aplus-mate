'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BadgeDisplay from '@/components/ui/BadgeDisplay'
import EmptyState from '@/components/ui/EmptyState'

export default function MatchingRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient() as any

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('team_matches')
      .select(`
        *,
        courses (*),
        requester:users!team_matches_requester_id_fkey (*)
      `)
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (data) {
      // Load badges for requesters
      const requesterIds = data.map((r: any) => r.requester_id)
      const { data: badges } = await supabase
        .from('badges')
        .select('*')
        .in('user_id', requesterIds)

      const requestsWithBadges = data.map((r: any) => ({
        ...r,
        requester: {
          ...r.requester,
          badges: badges?.filter((b: any) => b.user_id === r.requester_id) || [],
        },
      }))

      setRequests(requestsWithBadges)
    }

    setLoading(false)
  }

  const handleAccept = async (matchId: string, requesterId: string, courseId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Update match status
    const { error: matchError } = await supabase
      .from('team_matches')
      .update({ status: 'accepted' } as any)
      .eq('id', matchId)

    if (matchError) {
      setMessage('수락 중 오류가 발생했습니다.')
      return
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        match_id: matchId,
        course_id: courseId,
      } as any)
      .select()
      .single()

    if (teamError || !team) {
      setMessage('팀 생성 중 오류가 발생했습니다.')
      return
    }

    // Add team members
    await supabase.from('team_members').insert([
      { team_id: (team as any).id, user_id: requesterId },
      { team_id: (team as any).id, user_id: user.id },
    ] as any)

    setMessage('매칭을 수락했습니다!')
    setRequests(requests.filter((r) => r.id !== matchId))
    setTimeout(() => {
      router.push(`/matching/accepted/${matchId}`)
    }, 1000)
  }

  const handleReject = async (matchId: string) => {
    const { error } = await supabase
      .from('team_matches')
      .update({ status: 'rejected' } as any)
      .eq('id', matchId)

    if (error) {
      setMessage('거절 중 오류가 발생했습니다.')
    } else {
      setMessage('매칭을 거절했습니다.')
      setRequests(requests.filter((r) => r.id !== matchId))
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

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">받은 매칭 요청</h1>

      {message && (
        <div className="mb-4 p-3 bg-primary-light border border-primary/20 rounded-lg text-primary text-sm">
          {message}
        </div>
      )}

      {requests.length === 0 ? (
        <EmptyState
          title="받은 요청이 없습니다"
          description="새로운 매칭 요청이 오면 여기에 표시됩니다."
        />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="card">
              <div className="mb-3">
                <span className="badge-pill bg-secondary-light text-secondary mb-2">
                  {request.courses?.name}
                </span>
                <div className="mt-2">
                  <p className="font-medium text-gray-900">
                    {request.requester?.department} · {request.requester?.year}학년
                  </p>
                  {request.requester?.skill_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {request.requester.skill_tags.map((tag: string) => (
                        <span key={tag} className="badge-pill bg-gray-100 text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2">
                    <BadgeDisplay badges={request.requester?.badges || []} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(request.id, request.requester_id, request.course_id)}
                  className="btn-primary flex-1 py-2"
                >
                  수락
                </button>
                <button
                  onClick={() => handleReject(request.id)}
                  className="btn-outline flex-1 py-2 border-red-300 text-red-500 hover:bg-red-50"
                >
                  거절
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
