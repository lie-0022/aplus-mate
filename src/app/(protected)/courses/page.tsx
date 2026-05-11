'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function CoursesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [courses, setCourses] = useState<any[]>([])
  const [myCourses, setMyCourses] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [semester, setSemester] = useState('2026-1')
  const [newCourse, setNewCourse] = useState({
    name: '',
    professor: '',
    credits: 3,
    has_team_project: false,
  })
  const [message, setMessage] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadMyCourses()
  }, [])

  const loadMyCourses = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('user_courses')
      .select('course_id')
      .eq('user_id', user.id)

    setMyCourses(data?.map((uc: any) => uc.course_id) || [])
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setLoading(true)

    const { data } = await supabase
      .from('courses')
      .select('*')
      .or(`name.ilike.%${searchQuery}%,professor.ilike.%${searchQuery}%`)
      .limit(20)

    setCourses(data || [])
    setLoading(false)
  }

  const handleEnroll = async (courseId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('user_courses').insert({
      user_id: user.id,
      course_id: courseId,
      semester,
    } as any)

    if (error) {
      if (error.code === '23505') {
        setMessage('이미 수강 중인 과목입니다.')
      } else {
        setMessage('수강 추가 중 오류가 발생했습니다.')
      }
    } else {
      setMessage('수강이 추가되었습니다!')
      setMyCourses([...myCourses, courseId])
    }

    setTimeout(() => setMessage(''), 3000)
  }

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from('users')
      .select('university')
      .eq('id', user.id)
      .single()

    const profile = profileData as any
    if (!profile) return

    const { data: course, error } = await supabase
      .from('courses')
      .insert({
        name: newCourse.name,
        professor: newCourse.professor,
        credits: newCourse.credits,
        has_team_project: newCourse.has_team_project,
        university: profile.university,
      } as any)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        setMessage('이미 등록된 수업입니다.')
      } else {
        setMessage('수업 생성 중 오류가 발생했습니다.')
      }
    } else if (course) {
      setMessage('수업이 생성되었습니다!')
      setCourses([course, ...courses])
      setShowCreateForm(false)
      setNewCourse({ name: '', professor: '', credits: 3, has_team_project: false })
    }

    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">수업 검색</h1>

      {message && (
        <div className="mb-4 p-3 bg-primary-light border border-primary/20 rounded-lg text-primary text-sm">
          {message}
        </div>
      )}

      {/* Semester Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">학기</label>
        <select
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          className="input-field"
        >
          <option value="2026-1">2026년 1학기</option>
          <option value="2026-2">2026년 2학기</option>
          <option value="2025-2">2025년 2학기</option>
          <option value="2025-1">2025년 1학기</option>
        </select>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="input-field flex-1"
          placeholder="수업명 또는 교수명 검색"
        />
        <button onClick={handleSearch} className="btn-primary" disabled={loading}>
          검색
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {courses.map((course) => (
            <div key={course.id} className="card">
              <div className="flex items-center justify-between">
                <Link href={`/courses/${course.id}`} className="flex-1">
                  <h3 className="font-medium text-gray-900">{course.name}</h3>
                  <p className="text-sm text-gray-500">
                    {course.professor} 교수 · {course.credits}학점
                    {course.has_team_project && ' · 팀플 있음'}
                  </p>
                </Link>
                {myCourses.includes(course.id) ? (
                  <span className="text-xs text-gray-400 font-medium">수강 중</span>
                ) : (
                  <button
                    onClick={() => handleEnroll(course.id)}
                    className="btn-outline text-sm py-1.5 px-3"
                  >
                    수강 추가
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Course */}
      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-primary font-medium text-sm flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          찾는 수업이 없나요? 직접 등록하기
        </button>

        {showCreateForm && (
          <form onSubmit={handleCreateCourse} className="mt-4 space-y-3">
            <input
              type="text"
              value={newCourse.name}
              onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
              className="input-field"
              placeholder="수업명"
              required
            />
            <input
              type="text"
              value={newCourse.professor}
              onChange={(e) => setNewCourse({ ...newCourse, professor: e.target.value })}
              className="input-field"
              placeholder="교수명"
              required
            />
            <div className="flex gap-3">
              <select
                value={newCourse.credits}
                onChange={(e) => setNewCourse({ ...newCourse, credits: Number(e.target.value) })}
                className="input-field flex-1"
              >
                <option value={1}>1학점</option>
                <option value={2}>2학점</option>
                <option value={3}>3학점</option>
                <option value={4}>4학점</option>
              </select>
              <label className="flex items-center gap-2 flex-1">
                <input
                  type="checkbox"
                  checked={newCourse.has_team_project}
                  onChange={(e) => setNewCourse({ ...newCourse, has_team_project: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
                <span className="text-sm text-gray-700">팀플 있음</span>
              </label>
            </div>
            <button type="submit" className="btn-primary w-full">
              수업 등록
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
