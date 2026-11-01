export async function saveBusinessPatch(db, advisorId, id, patch) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: fresh, error: readError } = await db.from('advisor_biz_records').select('data,updated_at').eq('id', id).eq('advisor_id', advisorId).maybeSingle();
    if (readError || !fresh) return { error: readError || { code: 'not_found' } };
    const data = { ...fresh.data, ...patch };
    const updated_at = new Date(Math.max(Date.now(), (Date.parse(fresh.updated_at) || 0) + 1)).toISOString();
    let query = db.from('advisor_biz_records').update({ data, updated_at }).eq('id', id).eq('advisor_id', advisorId);
    query = fresh.updated_at == null ? query.is('updated_at', null) : query.eq('updated_at', fresh.updated_at);
    const { data: saved, error } = await query.select('data').maybeSingle();
    if (error) return { error };
    if (saved) return { data: saved.data, error: null };
  }
  return { error: { code: 'sync_conflict' } };
}

export async function loadBusinessRecords(db, advisorId, kind, period) {
  const records = [];
  for (;;) {
    let query = db.from('advisor_biz_records').select('*', { count: 'exact' }).eq('advisor_id', advisorId).eq('kind', kind);
    if (period) query = query.eq('period', period);
    const { data, count, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(records.length, records.length + 999);
    if (error) return { data: null, error };
    records.push(...(data || []));
    if (!data?.length || (count != null ? records.length >= count : data.length < 1000)) return { data: records, error: null };
  }
}