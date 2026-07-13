revoke execute on function public.claim_advisor_invite(text) from public;
revoke execute on function public.claim_advisor_invite(text) from anon;
grant execute on function public.claim_advisor_invite(text) to authenticated;
