-- ============================================================
-- Aristo AI — Initial Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS
-- Extended profile on top of Supabase auth.users
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  learning_style text check (learning_style in ('technical', 'visual', 'metaphor', 'simple')) default 'visual',
  grade_level   text default 'middle-school',
  style_locked  boolean default false,   -- true once assessment is done
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- LEARNING STYLE ASSESSMENT
-- Results of the onboarding style test
-- ============================================================
create table public.style_assessments (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete cascade,
  technical     int default 0,
  visual        int default 0,
  metaphor      int default 0,
  simple        int default 0,
  result_style  text check (result_style in ('technical', 'visual', 'metaphor', 'simple')),
  taken_at      timestamptz default now()
);

-- ============================================================
-- CURRICULA
-- Top-level curriculum (from PDF upload or AI generation)
-- ============================================================
create table public.curricula (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  description   text,
  source_type   text check (source_type in ('pdf', 'ai_generated', 'manual')) default 'ai_generated',
  pdf_url       text,                    -- Supabase Storage URL if uploaded
  raw_content   text,                   -- extracted text from PDF
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz default now()
);

-- ============================================================
-- COURSES
-- Extracted from curricula, has ordered topic list
-- ============================================================
create table public.courses (
  id            uuid primary key default uuid_generate_v4(),
  curriculum_id uuid references public.curricula(id) on delete set null,
  title         text not null,
  description   text,
  topic_list    jsonb not null default '[]',   -- ["Topic 1", "Topic 2", ...]
  is_published  boolean default false,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- LEARNING SESSIONS
-- One session = one user going through a course
-- ============================================================
create table public.sessions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references public.profiles(id) on delete cascade,
  course_id           uuid references public.courses(id) on delete set null,
  current_topic_index int default 0,
  active_style        text check (active_style in ('technical', 'visual', 'metaphor', 'simple')) default 'visual',
  mode                text check (mode in ('course', 'free')) default 'course',
  started_at          timestamptz default now(),
  last_active_at      timestamptz default now()
);

-- ============================================================
-- QUIZ ATTEMPTS
-- Each quiz taken during a session
-- ============================================================
create table public.quiz_attempts (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid references public.sessions(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete cascade,
  topic         text not null,
  questions     jsonb not null default '[]',   -- full MCQ array
  answers       jsonb not null default '[]',   -- user's answers
  score         int not null,                  -- 0-5
  passed        boolean not null,
  style_used    text check (style_used in ('technical', 'visual', 'metaphor', 'simple')),
  attempted_at  timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.style_assessments enable row level security;
alter table public.curricula enable row level security;
alter table public.courses enable row level security;
alter table public.sessions enable row level security;
alter table public.quiz_attempts enable row level security;

-- Profiles: users can read/update their own
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- Style assessments: users manage their own
create policy "assessments: own all" on public.style_assessments for all using (auth.uid() = user_id);

-- Curricula: admins write, everyone reads published
create policy "curricula: read all"       on public.curricula for select using (true);
create policy "curricula: authenticated insert" on public.curricula for insert with check (auth.uid() = created_by);
create policy "curricula: own update"     on public.curricula for update using (auth.uid() = created_by);

-- Courses: published courses readable by all, admins manage
create policy "courses: read published"   on public.courses for select using (is_published = true or auth.uid() = created_by);
create policy "courses: authenticated insert" on public.courses for insert with check (auth.uid() = created_by);
create policy "courses: own update"       on public.courses for update using (auth.uid() = created_by);

-- Sessions: users manage their own
create policy "sessions: own all" on public.sessions for all using (auth.uid() = user_id);

-- Quiz attempts: users manage their own
create policy "quiz_attempts: own all" on public.quiz_attempts for all using (auth.uid() = user_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at   before update on public.profiles   for each row execute function public.set_updated_at();
create trigger courses_updated_at    before update on public.courses    for each row execute function public.set_updated_at();
