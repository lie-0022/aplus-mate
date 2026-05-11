'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface EvaluationData {
  evaluatee_id: string
  evaluatee_name: string
  promise_score: number
  idea_score: number
  deadline_score: number
  grade: string
}

export default function EvaluatePage() {
  const params = useParams()
  const teamId = params.id as string
  const router = useRouter()
  const [members, setMembers] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [evaluations, setEvaluations] = useState<EvaluationData[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [alreadyEvaluated, setAlreadyEvaluated] = useState(false)
  const supabase = createClient() as any

  useEffect(() => {
    loadMembers()
  }, [teamId])

  const loadMembers = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if already evaluated
    const { data: myMembership } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    if (myMembership?.has_evaluated) {
      setAlreadyEvaluated(true)
      setLoading(false)
      return
    }

    // Load other team members
    const { data: memberData } = await supabase
      .from('team_members')
      .select(`
        *,
        users (id, name, department, year)
      `)
      .eq('team_id', teamId)
      .neq('user_id', user.id)

    if (memberData) {
      setMembers(memberData)
      setEvaluations(
        memberData.map((m: any) => ({
          evaluatee_id: m.user_id,
          evaluatee_name: m.users?.name || '',
          promise_score: 3,
          idea_score: 3,
          deadline_score: 3,
          grade: 'A',
        }))
      )
    }

    setLoading(false)
  }

  const updateEvaluation = (field: string, value: number | string) => {
    setEvaluations((prev) =>
      prev.map((ev, idx) =>
        idx === currentIndex ? { ...ev, [field]: value } : ev
      )
    )
  }

  const handleNext = () => {
    if (currentIndex < members.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Insert all evaluations
    const evalInserts = evaluations.map((ev) => ({
      team_id: teamId,
      evaluator_id: user.id,
      evaluatee_id: ev.evaluatee_id,
      promise_score: ev.promise_score,
      idea_score: ev.idea_score,
      deadline_score: ev.deadline_score,
      grade: ev.grade,
    }))

    const { error: evalError } = await supabase.from('evaluations').insert(evalInserts)

    if (evalError) {
      setSubmitting(false)
      return
    }

    // Mark as evaluated
    await supabase
      .from('team_members')
      .update({ has_evaluated: true })
      .eq('team_id', teamId)
      .eq('user_id', user.id)

    // Check if all members have evaluated
    const { data: allMembers } = await supabase
      .from('team_members')
      .select('has_evaluated')
      .eq('team_id', teamId)

    const allEvaluated = allMembers?.every((m: any) => m.has_evaluated)

    if (allEvaluated) {
      // Call badge award function via RPC
      await supabase.rpc('award_badges', { p_team_id: teamId })
    }

    router.push(`/teams/${teamId}/evaluate/done`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
      </div>
    )
  }

  if (alreadyEvaluated) {
    return (
      <div className="p-4 text-center">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">이미 평가를 완료했습니다</h2>
          <p className="text-gray-500 mb-4">다른 팀원들의 평가를 기다려주세요.</p>
          <Link href="/teams" className="btn-primary">
            팀 목록으로
          </Link>
        </div>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        평가할 팀원이 없습니다.
      </div>
    )
  }

  const currentEval = evaluations[currentIndex]
  const grades = ['A+', 'A', 'B+', 'B', 'C+']

  const StarRating = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors ${
              star <= value
                ? 'bg-yellow-400 text-white'
                : 'bg-gray-100 text-gray-300'
            }`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="p-4">
      <Link href={`/teams/${teamId}`} className="text-sm text-gray-500 flex items-center gap-1 mb-4">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        뒤로
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">팀원 평가</h1>
      <p className="text-sm text-gray-500 mb-6">
        {currentIndex + 1} / {members.length} 번째 팀원
      </p>

      <div className="card p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-2xl font-bold text-primary">
              {currentEval?.evaluatee_name?.charAt(0)}
            </span>
          </div>
          <h2 className="text-lg font-bold text-gray-900">{currentEval?.evaluatee_name}</h2>
        </div>

        <StarRating
          value={currentEval?.promise_score || 3}
          onChange={(v) => updateEvaluation('promise_score', v)}
          label="🤝 약속 철저"
        />

        <StarRating
          value={currentEval?.idea_score || 3}
          onChange={(v) => updateEvaluation('idea_score', v)}
          label="💡 아이디어 기여"
        />

        <StarRating
          value={currentEval?.deadline_score || 3}
          onChange={(v) => updateEvaluation('deadline_score', v)}
          label="⏰ 마감 준수"
        />

        {/* Grade */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">학점 결과</label>
          <div className="flex gap-2">
            {grades.map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => updateEvaluation('grade', grade)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentEval?.grade === grade
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {grade}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentIndex > 0 && (
            <button onClick={handlePrev} className="btn-outline flex-1 py-3">
              이전
            </button>
          )}
          {currentIndex < members.length - 1 ? (
            <button onClick={handleNext} className="btn-primary flex-1 py-3">
              다음
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary flex-1 py-3"
            >
              {submitting ? '제출 중...' : '평가 제출'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
