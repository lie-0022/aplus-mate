import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get user profile
  const { data: profileData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = profileData as any

  // Get enrolled courses
  const { data: userCoursesData } = await supabase
    .from('user_courses')
    .select(`
      *,
      courses (*)
    `)
    .eq('user_id', user.id)
  const userCourses = userCoursesData as any[]

  // Get pending match requests (received)
  const { data: pendingRequestsData } = await supabase
    .from('team_matches')
    .select('*')
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
  const pendingRequests = pendingRequestsData as any[]

  // Get active teams
  const { data: teamMembersData } = await supabase
    .from('team_members')
    .select(`
      *,
      teams (*, courses (*))
    `)
    .eq('user_id', user.id)
  const teamMembers = teamMembersData as any[]

  const activeTeams = teamMembers?.filter(
    (tm: any) => tm.teams?.status === 'active'
  ) || []

  const requestCount = pendingRequests?.length || 0

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          안녕하세요, {profile?.name || '사용자'}님 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          오늘도 좋은 팀원을 찾아보세요!
        </p>
      </div>

      {/* Match Request Alert */}
      {requestCount > 0 && (
        <Link href="/matching/requests">
          <div className="card mb-4 bg-primary-light border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-primary">새로운 매칭 요청</p>
                <p className="text-sm text-primary/70">{requestCount}건의 요청이 대기 중</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Enrolled Courses */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">수강 중인 과목</h2>
          <Link href="/courses" className="text-sm text-primary font-medium">
            + 추가
          </Link>
        </div>

        {!userCourses || userCourses.length === 0 ? (
          <EmptyState
            title="수강 중인 과목이 없습니다"
            description="수업을 추가하고 팀원을 찾아보세요!"
            actionLabel="수업 추가하기"
            actionHref="/courses"
          />
        ) : (
          <div className="space-y-3">
            {userCourses.map((uc: any) => (
              <Link key={uc.id} href={`/courses/${uc.course_id}`}>
                <div className="card hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {uc.courses?.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {uc.courses?.professor} 교수 · {uc.courses?.credits}학점
                      </p>
                    </div>
                    {uc.courses?.has_team_project && (
                      <span className="badge-pill bg-primary-light text-primary">
                        팀플
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Active Teams */}
      {activeTeams.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">진행 중인 팀</h2>
          <div className="space-y-3">
            {activeTeams.map((tm: any) => (
              <Link key={tm.team_id} href={`/teams/${tm.team_id}`}>
                <div className="card hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {tm.teams?.courses?.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {tm.teams?.courses?.professor} 교수
                      </p>
                    </div>
                    <span className="badge-pill bg-green-100 text-green-700">
                      진행 중
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
