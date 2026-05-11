'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BadgeDisplay from '@/components/ui/BadgeDisplay'

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [badges, setBadges] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [kakaoUrl, setKakaoUrl] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient() as any

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    const { data: badgeData } = await supabase
      .from('badges')
      .select('*')
      .eq('user_id', user.id)

    const { data: courseData } = await supabase
      .from('user_courses')
      .select(`
        *,
        courses (*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setProfile(profileData)
    setBadges(badgeData || [])
    setCourses(courseData || [])
    setKakaoUrl(profileData?.kakao_openchat_url || '')
    setLoading(false)
  }

  const handleAddSkill = async () => {
    if (!skillInput.trim() || !profile) return

    const newTags = [...(profile.skill_tags || []), skillInput.trim()]
    const { error } = await supabase
      .from('users')
      .update({ skill_tags: newTags })
      .eq('id', profile.id)

    if (!error) {
      setProfile({ ...profile, skill_tags: newTags })
      setSkillInput('')
    }
  }

  const handleRemoveSkill = async (tag: string) => {
    if (!profile) return

    const newTags = (profile.skill_tags || []).filter((t: string) => t !== tag)
    const { error } = await supabase
      .from('users')
      .update({ skill_tags: newTags })
      .eq('id', profile.id)

    if (!error) {
      setProfile({ ...profile, skill_tags: newTags })
    }
  }

  const handleUpdateKakao = async () => {
    if (!profile) return

    const { error } = await supabase
      .from('users')
      .update({ kakao_openchat_url: kakaoUrl || null })
      .eq('id', profile.id)

    if (!error) {
      setProfile({ ...profile, kakao_openchat_url: kakaoUrl || null })
      setMessage('카카오 오픈채팅 URL이 업데이트되었습니다.')
      setEditing(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
      </div>
    )
  }

  if (!profile) {
    return <div className="p-4 text-center text-gray-500">프로필을 불러올 수 없습니다.</div>
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">내 프로필</h1>

      {message && (
        <div className="mb-4 p-3 bg-primary-light border border-primary/20 rounded-lg text-primary text-sm">
          {message}
        </div>
      )}

      {/* Basic Info */}
      <div className="card p-6 mb-4">
        <div className="text-center mb-4">
          <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl font-bold text-primary">
              {profile.name?.charAt(0)}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
          <p className="text-sm text-gray-500">{profile.university}</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">학과</span>
            <span className="text-sm font-medium">{profile.department}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">학년</span>
            <span className="text-sm font-medium">{profile.year}학년</span>
          </div>
        </div>
      </div>

      {/* Skill Tags */}
      <div className="card p-4 mb-4">
        <h3 className="font-bold text-gray-900 mb-3">스킬 태그</h3>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {profile.skill_tags?.map((tag: string) => (
            <span
              key={tag}
              className="badge-pill bg-secondary-light text-secondary cursor-pointer"
              onClick={() => handleRemoveSkill(tag)}
            >
              {tag} ×
            </span>
          ))}
          {(!profile.skill_tags || profile.skill_tags.length === 0) && (
            <span className="text-sm text-gray-400">스킬 태그를 추가해보세요</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
            className="input-field flex-1"
            placeholder="예: Python, 디자인, PPT"
          />
          <button onClick={handleAddSkill} className="btn-outline text-sm px-3">
            추가
          </button>
        </div>
      </div>

      {/* Kakao OpenChat */}
      <div className="card p-4 mb-4">
        <h3 className="font-bold text-gray-900 mb-3">카카오 오픈채팅</h3>
        {editing ? (
          <div className="space-y-2">
            <input
              type="url"
              value={kakaoUrl}
              onChange={(e) => setKakaoUrl(e.target.value)}
              className="input-field"
              placeholder="https://open.kakao.com/o/..."
            />
            <div className="flex gap-2">
              <button onClick={handleUpdateKakao} className="btn-primary text-sm flex-1">
                저장
              </button>
              <button onClick={() => setEditing(false)} className="btn-outline text-sm flex-1">
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 truncate flex-1">
              {profile.kakao_openchat_url || '미등록'}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-primary font-medium ml-2"
            >
              편집
            </button>
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="card p-4 mb-4">
        <h3 className="font-bold text-gray-900 mb-3">획득한 배지</h3>
        {badges.length > 0 ? (
          <div className="space-y-3">
            {badges.map((badge) => {
              const config: Record<string, { label: string; emoji: string }> = {
                promise: { label: '약속 철저', emoji: '🤝' },
                idea: { label: '아이디어 뱅크', emoji: '💡' },
                deadline: { label: '마감 준수', emoji: '⏰' },
              }
              const c = config[badge.badge_type]
              return (
                <div key={badge.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{c.emoji}</span>
                    <span className="text-sm font-medium">{c.label}</span>
                  </div>
                  <span className="badge-pill bg-primary-light text-primary">
                    x{badge.count}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">아직 획득한 배지가 없습니다.</p>
        )}
      </div>

      {/* Course History */}
      <div className="card p-4 mb-4">
        <h3 className="font-bold text-gray-900 mb-3">수강 이력</h3>
        {courses.length > 0 ? (
          <div className="space-y-2">
            {courses.map((uc: any) => (
              <div key={uc.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{uc.courses?.name}</p>
                  <p className="text-xs text-gray-500">{uc.courses?.professor} 교수</p>
                </div>
                <span className="text-xs text-gray-400">{uc.semester}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">수강 이력이 없습니다.</p>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 text-red-500 font-medium text-center border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
      >
        로그아웃
      </button>
    </div>
  )
}
