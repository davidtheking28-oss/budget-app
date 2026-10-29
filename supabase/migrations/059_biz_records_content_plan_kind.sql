alter table public.advisor_biz_records drop constraint advisor_biz_records_kind_check;

alter table public.advisor_biz_records add constraint advisor_biz_records_kind_check
  check (kind in ('task', 'project', 'system', 'marketing_month', 'video_idea', 'finance_entry', 'content_plan_progress'));
