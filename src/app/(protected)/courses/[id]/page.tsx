'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BadgeDisplay from '@/components/ui/BadgeDisplay'

export default function CourseDetailPage() {
  const params = useParams()
  const courseId = params.id as string
  const [course, setCourse] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'info' | 'team'>('info')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCourse()
    loadPosts()
  }, [courseId])

  const loadCourse = async () => {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single()
    setCourse(data)
    setLoading(false)
  }

  const loadPosts = async () => {
    let query = supabase
      .from('posts')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })

    if (categoryFilter !== 'all') {
      query = query.eq('category', categoryFilter)
    }

    const { data } = await query
    setPosts(data || [])
  }

  useEffect(() => {
    loadPosts()
  }, [categoryFilter])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="p-4 text-center text-gray-500">
        수업을 찾을 수 없습니다.
      </div>
    )
  }

  const categories = ['all', '족보', '과제팁', '후기', '스터디']

  return (
    <div className="p-4">
      {/* Course Header */}
      <div className="mb-4">
        <Link href="/courses" className="text-sm text-gray-500 flex items-center gap-1 mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          뒤로
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
        <p className="text-gray-500">
          {course.professor} 교수 · {course.credits}학점
          {course.has_team_project && ' · 팀플 있음'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'info'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500'
          }`}
        >
          정보
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'team'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500'
          }`}
        >
          팀플
        </button>
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div>
          {/* Category Filter */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  categoryFilter === cat
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cat === 'all' ? '전체' : cat}
              </button>
            ))}
          </div>

          {/* Write Button */}
          <Link
            href={`/courses/${courseId}/post/new`}
            className="btn-outline w-full text-center block mb-4"
          >
            글쓰기
          </Link>

          {/* Posts */}
          {posts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              아직 게시글이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className="badge-pill bg-gray-100 text-gray-600 mb-2">
                        {post.category}
                      </span>
                      <h3 className="font-medium text-gray-900 mt-1">{post.title}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {post.content}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                    <span>익명</span>
                    <span>조회 {post.view_count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div>
          {course.has_team_project ? (
            <div className="space-y-4">
              <Link
                href={`/matching?course_id=${courseId}`}
                className="btn-primary w-full text-center block"
              >
                팀원 찾기
              </Link>
              <div className="text-center py-8 text-gray-400 text-sm">
                팀원을 찾고 함께 A+를 받아보세요!
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              이 수업은 팀플이 없는 수업입니다.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
