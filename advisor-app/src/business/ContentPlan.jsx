export default function ContentPlan() {
  return (
    <iframe
      title="לוח תוכן ל-4 שבועות"
      src={`${import.meta.env.BASE_URL}content-plan.html`}
      style={{ width: '100%', height: 'calc(100dvh - 150px)', minHeight: 560, border: 0, borderRadius: 18, background: 'transparent' }}
    />
  );
}
