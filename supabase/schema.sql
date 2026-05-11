-- A+ Mate Database Schema
-- Run this in Supabase SQL Editor

-- Users table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name varchar NOT NULL,
  university varchar NOT NULL,
  department varchar NOT NULL,
  year integer NOT NULL CHECK (year >= 1 AND year <= 4),
  skill_tags text[] DEFAULT '{}',
  kakao_openchat_url varchar,
  created_at timestamp DEFAULT now()
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  professor varchar NOT NULL,
  credits integer NOT NULL,
  has_team_project boolean DEFAULT false,
  university varchar NOT NULL,
  created_at timestamp DEFAULT now(),
  UNIQUE (name, professor, university)
);

-- User Courses (enrollment)
CREATE TABLE IF NOT EXISTS user_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  semester varchar NOT NULL,
  created_at timestamp DEFAULT now(),
  UNIQUE (user_id, course_id, semester)
);

-- Posts (course info board)
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title varchar NOT NULL,
  content text NOT NULL,
  category varchar NOT NULL CHECK (category IN ('족보', '과제팁', '후기', '스터디')),
  view_count integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- Team Matches
CREATE TABLE IF NOT EXISTS team_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  status varchar DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamp DEFAULT now()
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES team_matches(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  status varchar DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  evaluation_status varchar DEFAULT 'pending' CHECK (evaluation_status IN ('pending', 'in_progress', 'done')),
  created_at timestamp DEFAULT now()
);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  has_evaluated boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- Evaluations
CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  evaluator_id uuid REFERENCES users(id) ON DELETE CASCADE,
  evaluatee_id uuid REFERENCES users(id) ON DELETE CASCADE,
  promise_score integer NOT NULL CHECK (promise_score >= 1 AND promise_score <= 5),
  idea_score integer NOT NULL CHECK (idea_score >= 1 AND idea_score <= 5),
  deadline_score integer NOT NULL CHECK (deadline_score >= 1 AND deadline_score <= 5),
  grade varchar NOT NULL CHECK (grade IN ('A+', 'A', 'B+', 'B', 'C+')),
  created_at timestamp DEFAULT now()
);

-- Badges
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  badge_type varchar NOT NULL CHECK (badge_type IN ('promise', 'idea', 'deadline')),
  count integer DEFAULT 1,
  updated_at timestamp DEFAULT now(),
  UNIQUE (user_id, badge_type)
);

-- Row Level Security Policies

-- Users: can read all, update own
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Courses: anyone can read, authenticated can insert
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create courses" ON courses FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- User Courses: can read all, manage own
ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view enrollments" ON user_courses FOR SELECT USING (true);
CREATE POLICY "Users can manage own enrollments" ON user_courses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own enrollments" ON user_courses FOR DELETE USING (auth.uid() = user_id);

-- Posts: anyone can read, own can manage
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Team Matches
ALTER TABLE team_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own matches" ON team_matches FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can create match requests" ON team_matches FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Receivers can update match status" ON team_matches FOR UPDATE USING (auth.uid() = receiver_id);

-- Teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view teams" ON teams FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = teams.id AND team_members.user_id = auth.uid())
);
CREATE POLICY "Authenticated can insert teams" ON teams FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Team members can update teams" ON teams FOR UPDATE USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = teams.id AND team_members.user_id = auth.uid())
);

-- Team Members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view members" ON team_members FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert members" ON team_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own membership" ON team_members FOR UPDATE USING (auth.uid() = user_id);

-- Evaluations
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view evaluations for their teams" ON evaluations FOR SELECT USING (
  auth.uid() = evaluator_id OR auth.uid() = evaluatee_id
);
CREATE POLICY "Users can create evaluations" ON evaluations FOR INSERT WITH CHECK (auth.uid() = evaluator_id);

-- Badges
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view badges" ON badges FOR SELECT USING (true);
CREATE POLICY "System can manage badges" ON badges FOR ALL USING (auth.role() = 'authenticated');

-- Function to award badges after all evaluations are complete
CREATE OR REPLACE FUNCTION award_badges(p_team_id uuid)
RETURNS void AS $$
DECLARE
  member_record RECORD;
  avg_promise NUMERIC;
  avg_idea NUMERIC;
  avg_deadline NUMERIC;
BEGIN
  -- Check if all members have evaluated
  IF EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = p_team_id AND has_evaluated = false
  ) THEN
    RETURN;
  END IF;

  -- Update team evaluation status
  UPDATE teams SET evaluation_status = 'done' WHERE id = p_team_id;

  -- For each team member, calculate averages and award badges
  FOR member_record IN 
    SELECT user_id FROM team_members WHERE team_id = p_team_id
  LOOP
    -- Calculate average scores received
    SELECT 
      COALESCE(AVG(promise_score), 0),
      COALESCE(AVG(idea_score), 0),
      COALESCE(AVG(deadline_score), 0)
    INTO avg_promise, avg_idea, avg_deadline
    FROM evaluations 
    WHERE team_id = p_team_id AND evaluatee_id = member_record.user_id;

    -- Award promise badge
    IF avg_promise >= 4.0 THEN
      INSERT INTO badges (user_id, badge_type, count, updated_at)
      VALUES (member_record.user_id, 'promise', 1, now())
      ON CONFLICT (user_id, badge_type)
      DO UPDATE SET count = badges.count + 1, updated_at = now();
    END IF;

    -- Award idea badge
    IF avg_idea >= 4.0 THEN
      INSERT INTO badges (user_id, badge_type, count, updated_at)
      VALUES (member_record.user_id, 'idea', 1, now())
      ON CONFLICT (user_id, badge_type)
      DO UPDATE SET count = badges.count + 1, updated_at = now();
    END IF;

    -- Award deadline badge
    IF avg_deadline >= 4.0 THEN
      INSERT INTO badges (user_id, badge_type, count, updated_at)
      VALUES (member_record.user_id, 'deadline', 1, now())
      ON CONFLICT (user_id, badge_type)
      DO UPDATE SET count = badges.count + 1, updated_at = now();
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
