export function summarizeSigns(agreements, views) {
  const seen = new Set((views || []).map(v => v.agreement_id));
  const signedClientIds = new Set();
  const unseenClientIds = new Set();
  let unseenCount = 0;
  for (const a of agreements || []) {
    signedClientIds.add(a.user_id);
    if (!seen.has(a.id)) {
      unseenCount += 1;
      unseenClientIds.add(a.user_id);
    }
  }
  return { signedClientIds, unseenClientIds, unseenCount };
}
