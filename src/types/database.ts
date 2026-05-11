export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          university: string
          department: string
          year: number
          skill_tags: string[]
          kakao_openchat_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          name: string
          university: string
          department: string
          year: number
          skill_tags?: string[]
          kakao_openchat_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          university?: string
          department?: string
          year?: number
          skill_tags?: string[]
          kakao_openchat_url?: string | null
          created_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          name: string
          professor: string
          credits: number
          has_team_project: boolean
          university: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          professor: string
          credits: number
          has_team_project?: boolean
          university: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          professor?: string
          credits?: number
          has_team_project?: boolean
          university?: string
          created_at?: string
        }
      }
      user_courses: {
        Row: {
          id: string
          user_id: string
          course_id: string
          semester: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          semester: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          semester?: string
          created_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          course_id: string
          user_id: string
          title: string
          content: string
          category: '족보' | '과제팁' | '후기' | '스터디'
          view_count: number
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          user_id: string
          title: string
          content: string
          category: '족보' | '과제팁' | '후기' | '스터디'
          view_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          user_id?: string
          title?: string
          content?: string
          category?: '족보' | '과제팁' | '후기' | '스터디'
          view_count?: number
          created_at?: string
        }
      }
      team_matches: {
        Row: {
          id: string
          requester_id: string
          receiver_id: string
          course_id: string
          status: 'pending' | 'accepted' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          receiver_id: string
          course_id: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          receiver_id?: string
          course_id?: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          match_id: string
          course_id: string
          status: 'active' | 'completed'
          evaluation_status: 'pending' | 'in_progress' | 'done'
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          course_id: string
          status?: 'active' | 'completed'
          evaluation_status?: 'pending' | 'in_progress' | 'done'
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          course_id?: string
          status?: 'active' | 'completed'
          evaluation_status?: 'pending' | 'in_progress' | 'done'
          created_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          has_evaluated: boolean
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          has_evaluated?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          has_evaluated?: boolean
          created_at?: string
        }
      }
      evaluations: {
        Row: {
          id: string
          team_id: string
          evaluator_id: string
          evaluatee_id: string
          promise_score: number
          idea_score: number
          deadline_score: number
          grade: 'A+' | 'A' | 'B+' | 'B' | 'C+'
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          evaluator_id: string
          evaluatee_id: string
          promise_score: number
          idea_score: number
          deadline_score: number
          grade: 'A+' | 'A' | 'B+' | 'B' | 'C+'
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          evaluator_id?: string
          evaluatee_id?: string
          promise_score?: number
          idea_score?: number
          deadline_score?: number
          grade?: 'A+' | 'A' | 'B+' | 'B' | 'C+'
          created_at?: string
        }
      }
      badges: {
        Row: {
          id: string
          user_id: string
          badge_type: 'promise' | 'idea' | 'deadline'
          count: number
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          badge_type: 'promise' | 'idea' | 'deadline'
          count?: number
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          badge_type?: 'promise' | 'idea' | 'deadline'
          count?: number
          updated_at?: string
        }
      }
    }
  }
}
