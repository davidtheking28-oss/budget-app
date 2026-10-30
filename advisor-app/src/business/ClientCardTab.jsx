import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import ClientContextBar from '../components/ClientContextBar.jsx';
import Crm from '../crm/Crm.jsx';
import { useClientSummary } from '../crm/useClientSummary.js';
import { useClientProfile } from '../crm/useClientProfile.js';

export default function ClientCardTab({ advisorId, clientId, email, mode, onDirtyChange }) {
  const [crmAction, setCrmAction] = useState(null);
  const [hasMortgage, setHasMortgage] = useState(false);
  const { nextMeeting, openTasks, household, refresh: refreshSummary } = useClientSummary(advisorId, clientId);
  const { profile, reload: reloadProfile, addTag, removeTag } = useClientProfile(advisorId, clientId);

  useEffect(() => {
    setHasMortgage(false);
    let cancelled = false;
    supabase
      .from('budget_data')
      .select('mortgage_scenario')
      .eq('user_id', clientId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setHasMortgage(!!data?.mortgage_scenario?.tracks?.length);
      });
    return () => { cancelled = true; };
  }, [clientId]);

  const tags = [];
  if (hasMortgage) tags.push('משכנתא פעילה');
  if (nextMeeting) {
    const daysToMeeting = Math.ceil((new Date(nextMeeting) - new Date()) / 86400000);
    if (daysToMeeting >= 0 && daysToMeeting <= 7) tags.push('פגישה השבוע');
  }

  return (
    <>
      <ClientContextBar
        isVip={!!profile?.is_vip}
        phone={profile?.phone}
        createdAt={profile?.created_at}
        nextMeeting={nextMeeting}
        openTasks={openTasks}
        household={household}
        tags={tags}
        manualTags={profile?.tags || []}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onAction={type => setCrmAction({ type, id: Date.now() })}
        budgetMode={mode}
      />
      <Crm key={clientId} onDirtyChange={onDirtyChange} action={crmAction} advisorId={advisorId} clientId={clientId} email={email} onChange={() => { refreshSummary(); reloadProfile(); }} />
    </>
  );
}
