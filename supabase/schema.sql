-- =====================================================================
-- KuisKu — Digitalisasi Quiz (Pre-test, Formatif, Post-test)
-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor.
-- =====================================================================

-- ---------- ENUM ----------
do $$ begin
  create type public.user_role as enum ('superadmin', 'mentor', 'siswa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assessment_type as enum ('pretest', 'formatif', 'posttest');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attempt_status as enum ('in_progress', 'submitted');
exception when duplicate_object then null; end $$;

-- ---------- UTIL ----------
create or replace function public.random_token(len int default 32)
returns text language sql volatile as $$
  select substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, len)
$$;

create or replace function public.gen_class_code()
returns text language plpgsql volatile as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes where code = result);
  end loop;
  return result;
end $$;

-- ---------- TABLES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text unique,
  email text,
  role public.user_role not null default 'siswa',
  nis text,
  login_token text unique default public.random_token(32),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  code text not null unique,
  mentor_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.classes alter column code set default public.gen_class_code();

create table if not exists public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  description text,
  content_intro text,        -- Bagian 1: dibuka setelah pre-test, sebelum formatif
  content_main text,         -- Bagian 2: dibuka setelah formatif, sebelum post-test
  video_url text,
  enforce_sequence boolean not null default true,
  is_published boolean not null default false,
  order_index int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  type public.assessment_type not null,
  title text not null,
  instructions text,
  duration_minutes int check (duration_minutes is null or duration_minutes > 0),
  passing_score int not null default 75 check (passing_score between 0 and 100),
  max_attempts int not null default 1 check (max_attempts >= 0), -- 0 = tak terbatas
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default false,
  show_score boolean not null default true,
  show_review boolean not null default false,
  is_open boolean not null default true,
  open_at timestamptz,
  close_at timestamptz,
  question_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (material_id, type)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  order_index int not null default 0,
  question text not null,
  image_url text,
  options jsonb not null default '[]'::jsonb,  -- [{"id":"A","text":"..."}]
  points int not null default 1 check (points > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.question_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_option text not null,
  explanation text
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_no int not null,
  status public.attempt_status not null default 'in_progress',
  question_order jsonb not null default '[]'::jsonb,  -- [{"q":uuid,"o":["A","C",...]}]
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  correct_count int,
  total_questions int,
  earned_points int,
  total_points int,
  score numeric(5,2),
  passed boolean,
  unique (assessment_id, student_id, attempt_no)
);

create table if not exists public.attempt_answers (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option text,
  is_correct boolean,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create index if not exists idx_classes_mentor on public.classes(mentor_id);
create index if not exists idx_members_student on public.class_members(student_id);
create index if not exists idx_materials_class on public.materials(class_id);
create index if not exists idx_assessments_material on public.assessments(material_id);
create index if not exists idx_questions_assessment on public.questions(assessment_id);
create index if not exists idx_attempts_assessment on public.attempts(assessment_id);
create index if not exists idx_attempts_student on public.attempts(student_id);

-- ---------- HELPER (security definer, hindari rekursi RLS) ----------
create or replace function public.auth_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'superadmin', false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('superadmin', 'mentor'), false)
$$;

create or replace function public.can_manage_class(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or (
    public.auth_role() = 'mentor'
    and exists (select 1 from public.classes where id = cid and mentor_id = auth.uid())
  )
$$;

create or replace function public.is_class_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.class_id = cid and cm.student_id = auth.uid() and c.is_active
  )
$$;

create or replace function public.can_manage_material(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_manage_class(class_id) from public.materials where id = mid), false)
$$;

create or replace function public.can_view_material(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.can_manage_class(m.class_id) or (m.is_published and public.is_class_member(m.class_id))
    from public.materials m where m.id = mid
  ), false)
$$;

create or replace function public.can_manage_assessment(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_manage_material(material_id) from public.assessments where id = aid), false)
$$;

create or replace function public.question_assessment(qid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select assessment_id from public.questions where id = qid
$$;

create or replace function public.attempt_assessment(atid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select assessment_id from public.attempts where id = atid
$$;

-- ---------- TRIGGERS ----------
-- Profil otomatis saat user dibuat. Role HANYA dibaca dari app_metadata
-- (hanya bisa di-set lewat service role), bukan user_metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := 'siswa';
begin
  begin
    v_role := coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'siswa');
  exception when others then
    v_role := 'siswa';
  end;
  insert into public.profiles (id, full_name, username, email, role, nis)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    nullif(lower(new.raw_user_meta_data ->> 'username'), ''),
    new.email,
    v_role,
    nullif(new.raw_user_meta_data ->> 'nis', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3 asesmen otomatis untuk setiap materi baru
create or replace function public.handle_new_material()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.assessments
    (material_id, type, title, instructions, duration_minutes, passing_score, max_attempts,
     shuffle_questions, shuffle_options, show_score, show_review)
  values
    (new.id, 'pretest', 'Pre-test: ' || new.title,
     'Kerjakan dengan jujur sesuai kemampuanmu saat ini. Nilai pre-test tidak memengaruhi kelulusan.',
     30, 0, 1, true, false, true, false),
    (new.id, 'formatif', 'Kuis Formatif: ' || new.title,
     'Kuis latihan untuk memantau pemahamanmu. Boleh dikerjakan berulang dan pembahasan akan ditampilkan.',
     null, 70, 0, true, true, true, true),
    (new.id, 'posttest', 'Post-test: ' || new.title,
     'Asesmen akhir untuk mengukur ketuntasan belajar. Pastikan koneksi stabil sebelum memulai.',
     45, 75, 2, true, true, true, false)
  on conflict (material_id, type) do nothing;
  return new;
end $$;

drop trigger if exists on_material_created on public.materials;
create trigger on_material_created
  after insert on public.materials
  for each row execute function public.handle_new_material();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists materials_touch on public.materials;
create trigger materials_touch
  before update on public.materials
  for each row execute function public.touch_updated_at();

-- Jumlah soal tersimpan di assessments (siswa tidak bisa membaca tabel questions)
create or replace function public.sync_question_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_aid uuid := coalesce(new.assessment_id, old.assessment_id);
begin
  update public.assessments
     set question_count = (select count(*) from public.questions where assessment_id = v_aid)
   where id = v_aid;
  if tg_op = 'UPDATE' and old.assessment_id is distinct from new.assessment_id then
    update public.assessments
       set question_count = (select count(*) from public.questions where assessment_id = old.assessment_id)
     where id = old.assessment_id;
  end if;
  return null;
end $$;

drop trigger if exists questions_count on public.questions;
create trigger questions_count
  after insert or update or delete on public.questions
  for each row execute function public.sync_question_count();

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.materials enable row level security;
alter table public.assessments enable row level security;
alter table public.questions enable row level security;
alter table public.question_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or public.is_staff()
  or exists (
    select 1 from public.classes c
    join public.class_members cm on cm.class_id = c.id
    where c.mentor_id = profiles.id and cm.student_id = auth.uid()
  )
);
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- classes
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select using (
  public.is_admin()
  or (mentor_id = auth.uid() and public.auth_role() = 'mentor')
  or public.is_class_member(id)
);
drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes for insert with check (
  public.is_admin() or (public.auth_role() = 'mentor' and mentor_id = auth.uid())
);
drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes for update
  using (public.can_manage_class(id))
  with check (public.is_admin() or mentor_id = auth.uid());
drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes for delete using (public.can_manage_class(id));

-- class_members
drop policy if exists members_select on public.class_members;
create policy members_select on public.class_members for select using (
  student_id = auth.uid() or public.can_manage_class(class_id)
);
drop policy if exists members_insert on public.class_members;
create policy members_insert on public.class_members for insert with check (
  public.can_manage_class(class_id)
  and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'siswa')
);
drop policy if exists members_delete on public.class_members;
create policy members_delete on public.class_members for delete using (public.can_manage_class(class_id));

-- materials
drop policy if exists materials_select on public.materials;
create policy materials_select on public.materials for select using (
  public.can_manage_class(class_id) or (is_published and public.is_class_member(class_id))
);
drop policy if exists materials_write on public.materials;
create policy materials_write on public.materials for all
  using (public.can_manage_class(class_id)) with check (public.can_manage_class(class_id));

-- assessments
drop policy if exists assessments_select on public.assessments;
create policy assessments_select on public.assessments for select using (public.can_view_material(material_id));
drop policy if exists assessments_update on public.assessments;
create policy assessments_update on public.assessments for update
  using (public.can_manage_material(material_id)) with check (public.can_manage_material(material_id));

-- questions & keys: hanya pengelola (siswa membaca soal lewat RPC tanpa kunci)
drop policy if exists questions_manage on public.questions;
create policy questions_manage on public.questions for all
  using (public.can_manage_assessment(assessment_id)) with check (public.can_manage_assessment(assessment_id));

drop policy if exists keys_manage on public.question_keys;
create policy keys_manage on public.question_keys for all
  using (public.can_manage_assessment(public.question_assessment(question_id)))
  with check (public.can_manage_assessment(public.question_assessment(question_id)));

-- attempts: siswa lihat miliknya; pengelola lihat & reset (hapus)
drop policy if exists attempts_select on public.attempts;
create policy attempts_select on public.attempts for select using (
  student_id = auth.uid() or public.can_manage_assessment(assessment_id)
);
drop policy if exists attempts_delete on public.attempts;
create policy attempts_delete on public.attempts for delete using (public.can_manage_assessment(assessment_id));

drop policy if exists answers_select on public.attempt_answers;
create policy answers_select on public.attempt_answers for select using (
  public.can_manage_assessment(public.attempt_assessment(attempt_id))
);

-- ---------- RPC: SISWA ----------
create or replace function public.join_class(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_class uuid;
begin
  if public.auth_role() is distinct from 'siswa' then
    raise exception 'Hanya siswa yang dapat bergabung ke kelas';
  end if;
  select id into v_class from public.classes
   where upper(code) = upper(trim(p_code)) and is_active;
  if v_class is null then
    raise exception 'Kode kelas tidak ditemukan atau kelas tidak aktif';
  end if;
  insert into public.class_members (class_id, student_id)
  values (v_class, auth.uid()) on conflict do nothing;
  return v_class;
end $$;

-- Penilaian (internal, tidak bisa dipanggil langsung oleh klien)
create or replace function public._grade_attempt(p_attempt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.attempts;
  v_pass int;
  v_total_q int; v_total_p int; v_correct int; v_earned int; v_score numeric;
begin
  select * into a from public.attempts where id = p_attempt for update;
  if not found or a.status = 'submitted' then return; end if;
  select passing_score into v_pass from public.assessments where id = a.assessment_id;

  update public.attempt_answers aa
     set is_correct = coalesce(aa.selected_option = k.correct_option, false)
    from public.questions q
    left join public.question_keys k on k.question_id = q.id
   where aa.attempt_id = p_attempt and q.id = aa.question_id;

  select count(*), coalesce(sum(q.points), 0),
         count(*) filter (where aa.is_correct),
         coalesce(sum(q.points) filter (where aa.is_correct), 0)
    into v_total_q, v_total_p, v_correct, v_earned
    from jsonb_array_elements(a.question_order) e
    join public.questions q on q.id = (e ->> 'q')::uuid
    left join public.attempt_answers aa on aa.attempt_id = p_attempt and aa.question_id = q.id;

  v_score := case when v_total_p > 0 then round(v_earned * 100.0 / v_total_p, 2) else 0 end;

  update public.attempts set
    status = 'submitted',
    submitted_at = case when expires_at is not null and now() > expires_at then expires_at else now() end,
    total_questions = v_total_q,
    total_points = v_total_p,
    correct_count = v_correct,
    earned_points = v_earned,
    score = v_score,
    passed = v_score >= v_pass
  where id = p_attempt;
end $$;

revoke all on function public._grade_attempt(uuid) from public, anon, authenticated;

create or replace function public.start_attempt(p_assessment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  asm public.assessments;
  mat public.materials;
  ex public.attempts;
  v_count int;
  v_order jsonb;
  v_expires timestamptz;
  v_id uuid;
  prev public.assessment_type;
begin
  if public.auth_role() is distinct from 'siswa' then
    raise exception 'Hanya siswa yang dapat mengerjakan asesmen';
  end if;

  select * into asm from public.assessments where id = p_assessment_id;
  if not found then raise exception 'Asesmen tidak ditemukan'; end if;
  select * into mat from public.materials where id = asm.material_id;
  if not mat.is_published or not public.is_class_member(mat.class_id) then
    raise exception 'Anda tidak memiliki akses ke materi ini';
  end if;

  -- Lanjutkan percobaan yang masih berjalan, selesaikan yang waktunya habis
  for ex in select * from public.attempts
             where assessment_id = asm.id and student_id = v_uid and status = 'in_progress' loop
    if ex.expires_at is not null and ex.expires_at <= now() then
      perform public._grade_attempt(ex.id);
    else
      return ex.id;
    end if;
  end loop;

  if not asm.is_open then raise exception 'Asesmen sedang ditutup oleh mentor'; end if;
  if asm.open_at is not null and now() < asm.open_at then
    raise exception 'Asesmen belum dibuka. Jadwal buka: %', to_char(asm.open_at at time zone 'Asia/Makassar', 'DD-MM-YYYY HH24:MI');
  end if;
  if asm.close_at is not null and now() > asm.close_at then
    raise exception 'Jadwal pengerjaan asesmen sudah berakhir';
  end if;
  if asm.question_count = 0 then raise exception 'Soal untuk asesmen ini belum tersedia'; end if;

  -- Urutan wajib: pre-test -> formatif -> post-test
  if mat.enforce_sequence and asm.type <> 'pretest' then
    foreach prev in array (case when asm.type = 'formatif'
                                then array['pretest']::public.assessment_type[]
                                else array['pretest', 'formatif']::public.assessment_type[] end) loop
      if exists (select 1 from public.assessments a2
                  where a2.material_id = mat.id and a2.type = prev and a2.question_count > 0)
         and not exists (select 1 from public.attempts t
                           join public.assessments a2 on a2.id = t.assessment_id
                          where a2.material_id = mat.id and a2.type = prev
                            and t.student_id = v_uid and t.status = 'submitted') then
        raise exception 'Selesaikan % terlebih dahulu',
          case prev when 'pretest' then 'Pre-test' else 'Kuis Formatif' end;
      end if;
    end loop;
  end if;

  if asm.type = 'posttest' and exists (
      select 1 from public.attempts where assessment_id = asm.id and student_id = v_uid and passed) then
    raise exception 'Anda sudah lulus post-test ini';
  end if;

  select count(*) into v_count from public.attempts where assessment_id = asm.id and student_id = v_uid;
  if asm.max_attempts > 0 and v_count >= asm.max_attempts then
    raise exception 'Kesempatan mengerjakan sudah habis (maksimal % kali)', asm.max_attempts;
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'q', q.id,
             'o', (select coalesce(jsonb_agg(o ->> 'id' order by
                          case when asm.shuffle_options then random() else ord::float8 end), '[]'::jsonb)
                     from jsonb_array_elements(q.options) with ordinality as t(o, ord))
           )
           order by case when asm.shuffle_questions then random() else q.order_index::float8 end, q.created_at
         )
    into v_order
    from public.questions q where q.assessment_id = asm.id;

  if asm.duration_minutes is not null then
    v_expires := now() + make_interval(mins => asm.duration_minutes);
  end if;
  if asm.close_at is not null then
    v_expires := least(coalesce(v_expires, asm.close_at), asm.close_at);
  end if;

  insert into public.attempts (assessment_id, student_id, attempt_no, question_order, expires_at)
  values (asm.id, v_uid, v_count + 1, v_order, v_expires)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.get_attempt(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.attempts;
  asm public.assessments;
  mat public.materials;
  v_questions jsonb := '[]'::jsonb;
begin
  select * into a from public.attempts where id = p_attempt_id;
  if not found or a.student_id <> auth.uid() then
    raise exception 'Percobaan tidak ditemukan';
  end if;
  if a.status = 'in_progress' and a.expires_at is not null and a.expires_at <= now() then
    perform public._grade_attempt(a.id);
    select * into a from public.attempts where id = p_attempt_id;
  end if;
  select * into asm from public.assessments where id = a.assessment_id;
  select * into mat from public.materials where id = asm.material_id;

  if a.status = 'in_progress' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', q.id,
             'question', q.question,
             'image_url', q.image_url,
             'points', q.points,
             'selected', aa.selected_option,
             'options', (select coalesce(jsonb_agg(jsonb_build_object('id', oid, 'text', opt ->> 'text') order by ord), '[]'::jsonb)
                           from jsonb_array_elements_text(x.e -> 'o') with ordinality as t(oid, ord)
                           join lateral (select o2 as opt from jsonb_array_elements(q.options) o2
                                          where o2 ->> 'id' = t.oid limit 1) l on true)
           ) order by x.n), '[]'::jsonb)
      into v_questions
      from jsonb_array_elements(a.question_order) with ordinality as x(e, n)
      join public.questions q on q.id = (x.e ->> 'q')::uuid
      left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id;
  end if;

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', a.id, 'status', a.status, 'attempt_no', a.attempt_no,
      'started_at', a.started_at, 'expires_at', a.expires_at, 'server_now', now()),
    'assessment', jsonb_build_object(
      'id', asm.id, 'type', asm.type, 'title', asm.title, 'instructions', asm.instructions,
      'material_id', mat.id, 'material_title', mat.title),
    'questions', v_questions
  );
end $$;

create or replace function public.save_answer(p_attempt_id uuid, p_question_id uuid, p_option text)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.attempts;
begin
  select * into a from public.attempts where id = p_attempt_id;
  if not found or a.student_id <> auth.uid() then raise exception 'Percobaan tidak ditemukan'; end if;
  if a.status <> 'in_progress' then raise exception 'Asesmen sudah dikumpulkan'; end if;
  if a.expires_at is not null and a.expires_at <= now() then
    raise exception 'Waktu pengerjaan habis';
  end if;
  if not (a.question_order @> jsonb_build_array(jsonb_build_object('q', p_question_id))) then
    raise exception 'Soal tidak valid';
  end if;
  if p_option is null then
    delete from public.attempt_answers where attempt_id = a.id and question_id = p_question_id;
  else
    insert into public.attempt_answers (attempt_id, question_id, selected_option, answered_at)
    values (a.id, p_question_id, p_option, now())
    on conflict (attempt_id, question_id)
    do update set selected_option = excluded.selected_option, answered_at = now(), is_correct = null;
  end if;
end $$;

create or replace function public.submit_attempt(p_attempt_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a public.attempts;
begin
  select * into a from public.attempts where id = p_attempt_id;
  if not found or a.student_id <> auth.uid() then raise exception 'Percobaan tidak ditemukan'; end if;
  perform public._grade_attempt(a.id);
  return a.id;
end $$;

-- Hasil + pembahasan (siswa pemilik, atau pengelola)
create or replace function public.get_attempt_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.attempts;
  asm public.assessments;
  mat public.materials;
  v_manager boolean;
  v_show_score boolean;
  v_show_review boolean;
  v_review jsonb := null;
  v_used int;
  v_student jsonb;
begin
  select * into a from public.attempts where id = p_attempt_id;
  if not found then raise exception 'Percobaan tidak ditemukan'; end if;
  v_manager := public.can_manage_assessment(a.assessment_id);
  if a.student_id <> auth.uid() and not v_manager then raise exception 'Percobaan tidak ditemukan'; end if;

  if a.status = 'in_progress' and a.expires_at is not null and a.expires_at <= now() then
    perform public._grade_attempt(a.id);
    select * into a from public.attempts where id = p_attempt_id;
  end if;

  select * into asm from public.assessments where id = a.assessment_id;
  select * into mat from public.materials where id = asm.material_id;
  v_show_score := v_manager or asm.show_score;
  v_show_review := a.status = 'submitted' and (v_manager or asm.show_review);
  select count(*) into v_used from public.attempts where assessment_id = asm.id and student_id = a.student_id;
  select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'nis', p.nis)
    into v_student from public.profiles p where p.id = a.student_id;

  if v_show_review then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', q.id, 'question', q.question, 'image_url', q.image_url, 'points', q.points,
             'options', q.options, 'selected', aa.selected_option,
             'correct', k.correct_option, 'is_correct', coalesce(aa.is_correct, false),
             'explanation', k.explanation
           ) order by x.n), '[]'::jsonb)
      into v_review
      from jsonb_array_elements(a.question_order) with ordinality as x(e, n)
      join public.questions q on q.id = (x.e ->> 'q')::uuid
      left join public.question_keys k on k.question_id = q.id
      left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id;
  end if;

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', a.id, 'status', a.status, 'attempt_no', a.attempt_no,
      'started_at', a.started_at, 'submitted_at', a.submitted_at,
      'score', case when v_show_score then a.score end,
      'passed', case when v_show_score then a.passed end,
      'correct_count', case when v_show_score then a.correct_count end,
      'total_questions', a.total_questions),
    'assessment', jsonb_build_object(
      'id', asm.id, 'type', asm.type, 'title', asm.title, 'passing_score', asm.passing_score,
      'max_attempts', asm.max_attempts, 'show_score', asm.show_score, 'show_review', asm.show_review,
      'material_id', mat.id, 'material_title', mat.title),
    'student', v_student,
    'attempts_used', v_used,
    'is_manager', v_manager,
    'review', v_review
  );
end $$;

-- ---------- RPC: PENGELOLA ----------
create or replace function public.finalize_expired(p_assessment_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  if not public.can_manage_assessment(p_assessment_id) then raise exception 'Akses ditolak'; end if;
  for r in select id from public.attempts
            where assessment_id = p_assessment_id and status = 'in_progress'
              and expires_at is not null and expires_at <= now() loop
    perform public._grade_attempt(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- STORAGE: gambar soal ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media');
drop policy if exists media_staff_insert on storage.objects;
create policy media_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_staff());
drop policy if exists media_staff_delete on storage.objects;
create policy media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_staff());
