'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import EmptyState from '@/components/ui/EmptyState'

export default function TeamsPage() {
  const [activeTeams, setActiveTeams] = useState<any[]>([])
  const [completedTeams, setCompletedTeams] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: memberships } = await supabase
      .from('team_members')
      .select(`
        *,
        teams (
          *,
          courses (*),
          team_members (
            *,
            users (name, department)
          )
        )
      `)
      .eq('user_id', user.id)

    if (memberships) {
      const active = memberships.filter((m: any) => m.teams?.status === 'active')
      const completed = memberships.filter((m: any) => m.teams?.status === 'completed')
      setActiveTeams(active)
      setCompletedTeams(completed)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
      </div>
    )
  }

  const currentTeams = activeTab === 'active' ? activeTeams : completedTeams

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">내 팀</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500'
          }`}
        >
          진행 중 ({activeTeams.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'completed'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500'
          }`}
        >
          완료 ({completedTeams.length})
        </button>
      </div>

      {/* Team List */}
      {currentTeams.length === 0 ? (
        <EmptyState
          title={activeTab === 'active' ? '진행 중인 팀이 없습니다' : '완료된 팀이 없습니다'}
          description={activeTab === 'active' ? '매칭을 통해 팀을 만들어보세요!' : '팀플을 완료하면 여기에 표시됩니다.'}
        />
      ) : (
        <div className="space-y-3">
          {currentTeams.map((membership: any) => (
            <Link key={membership.team_id} href={`/teams/${membership.team_id}`}>
              <div className="card hover:shadow-md transition-shadow mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">
                    {membership.teams?.courses?.name}
                  </h3>
                  <span className={`badge-pill ${
                    membership.teams?.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {membership.teams?.status === 'active' ? '진행 중' : '완료'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  {membership.teams?.courses?.professor} 교수
                </p>
                <div className="flex flex-wrap gap-1">
                  {membership.teams?.team_members?.map((member: any) => (
                    <span key={member.id} className="badge-pill bg-primary-light text-primary">
                      {member.users?.name}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
