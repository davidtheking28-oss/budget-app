import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ values: [], refs: [], effects: [], si: 0, ri: 0, capture: true, offlineRead: false, offlineWrite: false, tasks: [] }));
vi.mock('react', () => ({
  useState: initial => { const i = state.si++; if (!(i in state.values)) state.values[i] = initial; return [state.values[i], next => { state.values[i] = typeof next === 'function' ? next(state.values[i]) : next; }]; },
  useRef: initial => { const i = state.ri++; return state.refs[i] ||= { current: initial }; },
  useCallback: fn => fn,
  useEffect: fn => { if (state.capture) state.effects.push(fn); }
}));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../supabaseClient.js', () => ({ SUPA_URL: '', supabase: {
  auth: { getSession: async () => ({ data: { session: null } }) },
  from: table => {
    let write = null;
    const q = { select: () => q, eq: () => q, order: () => q, single: () => q,
      insert: rows => { write = () => { const made = (Array.isArray(rows) ? rows : [rows]).map((row, i) => ({ id: 'new' + i, done: false, ...row })); state.tasks.push(...made); return made; }; return q; },
      delete: () => { write = () => { state.tasks = []; return []; }; return q; },
      update: patch => { write = () => { state.tasks = state.tasks.map(row => ({ ...row, ...patch })); return state.tasks; }; return q; },
      then: (ok, bad) => {
        if (write ? state.offlineWrite : state.offlineRead) return Promise.reject(new TypeError('Failed to fetch')).then(ok, bad);
        return Promise.resolve({ data: write ? write() : structuredClone(table === 'advisor_tasks' ? state.tasks : []), error: null }).then(ok, bad);
      }
    };
    return q;
  }
} }));
beforeEach(() => {
  Object.assign(state, { values: [], refs: [], effects: [], si: 0, ri: 0, capture: true, offlineRead: false, offlineWrite: false, tasks: [{ id: 'task', title: 'בדיקה', done: false }] });
  const window = new EventTarget(); window.setInterval = vi.fn(() => 1); window.clearInterval = vi.fn();
  vi.stubGlobal('window', window); const document = new EventTarget(); document.hidden = false; vi.stubGlobal('document', document);
});
afterEach(() => vi.unstubAllGlobals());
async function setup() {
  const { useClientCrm: readCrm } = await import('./useClientCrm.js');
  const render = () => { state.si = 0; state.ri = 0; return readCrm('advisor', 'client'); };
  render(); state.capture = false; state.effects.forEach(effect => effect());
  await vi.waitFor(() => expect(render().loading).toBe(false)); return render;
}
describe('client task round-trip refresh and offline recovery', () => {
  it('shows a retryable initial network read error', async () => {
    state.offlineRead = true; const view = await setup(); expect(view().error.message).toBe('Failed to fetch');
    state.offlineRead = false; await view().reload(); expect(view().error).toBeNull(); expect(view().tasks).toHaveLength(1);
  });
  it('refreshes completion on focus without replacing the screen with loading', async () => {
    const view = await setup(); state.tasks[0] = { ...state.tasks[0], done: true, done_by: 'client' };
    window.dispatchEvent(new Event('focus')); expect(view().loading).toBe(false);
    await vi.waitFor(() => expect(view().tasks[0].done_by).toBe('client')); expect(window.setInterval).toHaveBeenCalledWith(expect.any(Function), 15000);
  });
  it('keeps a task when deletion fails and removes it after retry', async () => {
    const view = await setup(); state.offlineWrite = true;
    expect(await view().deleteTask('task')).toBe(false); expect(view().tasks).toHaveLength(1);
    state.offlineWrite = false; expect(await view().deleteTask('task')).toBe(true); expect(view().tasks).toHaveLength(0);
  });
  it('shares new client tasks automatically without a visibility argument', async () => {
    const view = await setup();
    expect(await view().addTasks('משימה ראשונה\nמשימה שנייה', '2026-11-10')).toBe(true);
    const added = state.tasks.filter(task => task.id !== 'task');
    expect(added).toHaveLength(2); expect(added.every(task => task.for_client === true)).toBe(true);
  });
  it('shares an edited task without a visibility control', async () => {
    const view = await setup();
    expect(await view().editTask('task', 'משימה מעודכנת', '', 'client', 'document')).toBe(true);
    expect(view().tasks[0]).toMatchObject({ title: 'משימה מעודכנת', for_client: true, responsible: 'client', task_kind: 'document' });
  });
  it('rejects failed creates and rolls back failed completion before retry', async () => {
    const view = await setup(); state.offlineWrite = true;
    expect(await view().addTasks('חדשה', '')).toBe(false); expect(view().tasks).toHaveLength(1);
    await view().toggleTask('task', true); expect(view().tasks[0].done).toBe(false);
    state.offlineWrite = false; await view().toggleTask('task', true); expect(view().tasks[0].done).toBe(true);
  });
});
