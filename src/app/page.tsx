"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  DEFAULT_ACTIVITIES,
  formatDuration,
  getVisitorId,
  loadLocalActivities,
  saveLocalActivities,
  type Activity,
} from "@/lib/activities";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Visitor-only app, styled like enzi-ws:
// Helvetica Neue only, everywhere. BSI palette: teal #00A39D,
// gold #F8AD3C, deep teal #003D36. Buttons rounded-xl, chips
// rounded-full, one type scale, white pages, slate text.
// No Google Sign-In, no login button anywhere. Activity settings
// are stored in the SAME Supabase project as enzi-ws, in the
// enzi_timer_activities table only — no workshop table is touched.
// Each visitor is keyed by a per-browser visitor id (localStorage),
// so no account is needed. If Supabase is not configured,
// activities save to localStorage.
const TABLE = "enzi_timer_activities";

export default function Home() {
  const [activities, setActivities] = useState<Activity[]>(DEFAULT_ACTIVITIES);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(DEFAULT_ACTIVITIES[0].durationSeconds);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [visitorId, setVisitorId] = useState("");
  const [loaded, setLoaded] = useState(false);

  // New-activity form
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newHours, setNewHours] = useState("");
  const [newMinutes, setNewMinutes] = useState("25");
  const [newSeconds, setNewSeconds] = useState("");
  const [formError, setFormError] = useState("");

  // Description editor (below the activity title)
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");

  const endAtRef = useRef<number | null>(null);
  const activitiesRef = useRef(activities);
  activitiesRef.current = activities;

  const current = activities[Math.min(index, Math.max(0, activities.length - 1))] || DEFAULT_ACTIVITIES[0];
  const total = current?.durationSeconds || 0;
  const progress = total > 0 ? 1 - remaining / total : 0;

  // ---- Visitor id (per browser, no sign-in) ----
  useEffect(() => {
    setVisitorId(getVisitorId());
  }, []);

  // ---- Load activities: Supabase for this visitor, else localStorage ----
  useEffect(() => {
    if (!visitorId) return;
    if (!isSupabaseConfigured || !supabase) {
      const local = loadLocalActivities();
      if (local) setActivities(local);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      // Try the full column set first; if the description column
      // does not exist yet in Supabase, fall back to the old set.
      const first = await supabase
        .from(TABLE)
        .select("id, name, duration_seconds, created_at, description")
        .eq("visitor_id", visitorId)
        .order("created_at", { ascending: true });
      type Row = {
        id: unknown;
        name: unknown;
        duration_seconds: unknown;
        created_at: unknown;
        description?: unknown;
      };
      let rows: Row[] | null = (first.data as Row[] | null) ?? null;
      let error = first.error;
      if (error && /description/i.test(error.message)) {
        const second = await supabase
          .from(TABLE)
          .select("id, name, duration_seconds, created_at")
          .eq("visitor_id", visitorId)
          .order("created_at", { ascending: true });
        rows = (second.data as Row[] | null) ?? null;
        error = second.error;
      }
      const data = rows;
      if (cancelled) return;
      if (error) {
        const local = loadLocalActivities();
        if (local) setActivities(local);
          setLoaded(true);
        return;
      }
      const list: Activity[] = (data || [])
        .filter(
          (r) =>
            Boolean(r && typeof r.name === "string" && Number(r.duration_seconds) > 0)
        )
        .map((r) => ({
          id: String(r.id),
          name: String(r.name),
          durationSeconds: Number(r.duration_seconds),
          createdAt: Number(r.created_at),
          description: typeof (r as { description?: unknown }).description === "string"
            ? String((r as { description?: unknown }).description)
            : "",
        }));
      if (list.length > 0) {
        setActivities(list);
      } else {
        // First visit: seed Supabase with the current list
        const seed = activitiesRef.current;
        const rows = seed.map((a) => ({
          id: a.id,
          visitor_id: visitorId,
          name: a.name,
          duration_seconds: a.durationSeconds,
          created_at: a.createdAt,
          description: a.description || "",
        }));
        const seedRes = await supabase.from(TABLE).insert(rows);
        if (seedRes.error && /description/i.test(seedRes.error.message)) {
          await supabase.from(TABLE).insert(
            rows.map(({ description: _d, ...rest }) => rest)
          );
        }
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [visitorId]);

  // Persist locally as well, so the timer works offline / before Supabase loads
  useEffect(() => {
    if (!loaded) return;
    saveLocalActivities(activities);
  }, [activities, loaded]);

  const selectActivity = useCallback((i: number, list: Activity[] = activitiesRef.current) => {
    if (list.length === 0) return;
    const next = ((i % list.length) + list.length) % list.length;
    setIndex(next);
    setRemaining(list[next].durationSeconds);
    setRunning(false);
    setFinished(false);
    endAtRef.current = null;
  }, []);

  // ---- Countdown (driven by an end timestamp, so tab throttling can't drift it) ----
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (endAtRef.current == null) return;
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setRunning(false);
        setFinished(true);
        endAtRef.current = null;
        try {
          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          [0, 0.35, 0.7].forEach((delay) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.frequency.value = 880;
            g.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
            g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + delay + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.3);
            o.start(ctx.currentTime + delay);
            o.stop(ctx.currentTime + delay + 0.32);
          });
        } catch {
          // audio unavailable — visual finish state is enough
        }
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running]);

  // Web title is just "Enzi Timer" — always, even while running.
  useEffect(() => {
    document.title = "Enzi Timer";
  }, []);

  const start = () => {
    if (remaining <= 0) {
      setRemaining(total);
      endAtRef.current = Date.now() + total * 1000;
    } else {
      endAtRef.current = Date.now() + remaining * 1000;
    }
    setFinished(false);
    setRunning(true);
  };
  const pause = () => {
    if (endAtRef.current != null) {
      setRemaining(Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000)));
    }
    endAtRef.current = null;
    setRunning(false);
  };
  const reset = () => {
    endAtRef.current = null;
    setRunning(false);
    setFinished(false);
    setRemaining(total);
  };

  const createActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const name = newName.trim();
    const h = Math.max(0, parseInt(newHours || "0", 10) || 0);
    const m = Math.max(0, parseInt(newMinutes || "0", 10) || 0);
    const s = Math.max(0, parseInt(newSeconds || "0", 10) || 0);
    const durationSeconds = h * 3600 + m * 60 + s;
    if (!name) return setFormError("Give the activity a name.");
    if (durationSeconds <= 0) return setFormError("Set a duration longer than 0.");
    if (durationSeconds > 24 * 3600) return setFormError("Keep it under 24 hours.");
    const a: Activity = { id: uid(), name, durationSeconds, createdAt: Date.now(), description: newDescription.trim() };
    const next = [...activities, a];
    setActivities(next);
    if (isSupabaseConfigured && supabase && visitorId) {
      const row = {
        id: a.id,
        visitor_id: visitorId,
        name: a.name,
        duration_seconds: a.durationSeconds,
        created_at: a.createdAt,
        description: a.description || "",
      };
      const { error } = await supabase.from(TABLE).insert(row);
      if (error && /description/i.test(error.message)) {
        const { description: _d, ...legacyRow } = row;
        await supabase.from(TABLE).insert(legacyRow);
      }
    }
    setNewName("");
    setNewDescription("");
    setNewHours("");
    setNewMinutes("25");
    setNewSeconds("");
    setIndex(next.length - 1);
    setRemaining(a.durationSeconds);
    setRunning(false);
    setFinished(false);
    endAtRef.current = null;
    setSettingsOpen(false);
  };

  const removeActivity = async (id: string) => {
    if (activities.length <= 1) return;
    const list = activities.filter((a) => a.id !== id);
    setActivities(list);
    if (isSupabaseConfigured && supabase && visitorId) {
      await supabase.from(TABLE).delete().eq("id", id).eq("visitor_id", visitorId);
    }
    const removedIndex = activities.findIndex((a) => a.id === id);
    if (removedIndex <= index) selectActivity(Math.max(0, index - 1), list);
  };

  const saveDescription = async (id: string, description: string) => {
    const next = activities.map((a) => (a.id === id ? { ...a, description } : a));
    setActivities(next);
    setEditingDescription(false);
    if (isSupabaseConfigured && supabase && visitorId) {
      const { error } = await supabase
        .from(TABLE)
        .update({ description })
        .eq("id", id)
        .eq("visitor_id", visitorId);
      if (error && /description/i.test(error.message)) {
        // description column not in Supabase yet — the text is still
        // kept on this device and will sync once the column exists.
      }
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-white">
      {/* Header — visitor only, no sign-in */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">Enzi Timer</span>
            <span className="chip chip-bsi">Visitor</span>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="btn-primary">
            + New activity
          </button>
        </div>
      </header>

      {/* Timer — full width */}
      <section className="flex-1 mx-auto w-full max-w-5xl px-5 md:px-8 py-10 md:py-16">
        <div>
          <div>
            <p className="eyebrow">
              Activity {String(Math.min(index + 1, activities.length)).padStart(2, "0")} / {String(activities.length).padStart(2, "0")}
            </p>

            {/* Prev / Next */}
            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                onClick={() => selectActivity(index - 1)}
                aria-label="Previous activity"
                className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white text-xl leading-none text-slate-700 hover:bg-slate-50 transition-colors"
              >‹</button>
              <h1 className="text-center text-3xl md:text-4xl leading-tight font-semibold tracking-tight text-bsi-900 truncate px-2">
                {current?.name}
              </h1>
              <button
                onClick={() => selectActivity(index + 1)}
                aria-label="Next activity"
                className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white text-xl leading-none text-slate-700 hover:bg-slate-50 transition-colors"
              >›</button>
            </div>

            {/* Description — below the title, replaces the total duration line */}
            <div className="mt-3 text-center">
              {editingDescription ? (
                <div className="mx-auto max-w-xl">
                  <textarea
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    placeholder="Write a short description for this activity…"
                    rows={3}
                    autoFocus
                    className="input w-full resize-none text-left"
                  />
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <button
                      onClick={() => void saveDescription(current.id, descriptionDraft.trim())}
                      className="btn-primary px-5 py-2 text-sm"
                    >
                      Save description
                    </button>
                    <button
                      onClick={() => setEditingDescription(false)}
                      className="btn-secondary px-5 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : current.description ? (
                <button
                  onClick={() => {
                    setDescriptionDraft(current.description || "");
                    setEditingDescription(true);
                  }}
                  className="mx-auto block max-w-xl text-base leading-relaxed text-slate-600 hover:text-slate-900"
                  title="Click to edit the description"
                >
                  {current.description}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setDescriptionDraft("");
                    setEditingDescription(true);
                  }}
                  className="text-sm text-slate-400 underline underline-offset-4 decoration-dotted hover:text-bsi-700"
                >
                  Add a description…
                </button>
              )}
            </div>

            {/* Countdown — Helvetica Neue, deep teal */}
            <div className="mt-8 md:mt-10 text-center">
              <div className="timer-digits text-[84px] leading-none md:text-[148px] font-semibold tracking-tight text-bsi-900">
                {formatDuration(remaining)}
              </div>
              <div className="mt-6 h-[3px] w-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-bsi-500 transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
              </div>
              <p className="eyebrow mt-3">
                {running ? "Running" : finished ? "Finished" : remaining !== total ? "Paused" : "Ready"}
                {" · "}
                {Math.round(progress * 100)}% elapsed
              </p>
            </div>

            {/* Controls — rounded-xl buttons, primary is BSI teal */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {!running ? (
                <button onClick={start} className="btn-primary px-8 py-3 text-base min-w-[120px]">
                  {remaining !== total && remaining > 0 ? "Resume" : "Start"}
                </button>
              ) : (
                <button onClick={pause} className="btn-dark px-8 py-3 text-base min-w-[120px]">Pause</button>
              )}
              <button onClick={reset} className="btn-secondary px-8 py-3 text-base min-w-[120px]">Stop / Reset</button>
            </div>

            <p className="mt-8 text-center text-xs text-slate-400">
              Tip: use ‹ › to move between activities. Your timer keeps time even if the tab is throttled.
            </p>
          </div>

          {/* Activities — horizontal scrollable chips below the timer */}
          <div className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 className="eyebrow">Activities</h2>
              <button onClick={() => setSettingsOpen(true)} className="text-sm font-semibold text-bsi-700 underline underline-offset-4 hover:text-bsi-900">Manage</button>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activities.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => selectActivity(i)}
                  className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                    i === index
                      ? "border-bsi-600 bg-bsi-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${i === index ? "bg-gold-400" : "bg-slate-300"}`} />
                  {a.name}
                  <span className={`tabular-nums ${i === index ? "text-white/80" : "text-slate-400"}`}>{formatDuration(a.durationSeconds)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-5xl px-5 md:px-8 py-5 text-center text-xs text-slate-400">
          Enzi Timer
        </div>
      </footer>

      {/* Settings / New activity — slide-over */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Activity settings">
          <button aria-label="Close settings" onClick={() => setSettingsOpen(false)} className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-full max-w-md bg-white h-full overflow-y-auto border-l border-slate-200 shadow-none">
            <div className="p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-900">New activity</h2>
                  <p className="mt-1 text-sm text-slate-500">Name it, set a duration, and it joins your list.</p>
                </div>
                <button onClick={() => setSettingsOpen(false)} aria-label="Close" className="h-9 w-9 rounded-xl border border-slate-200 text-lg leading-none text-slate-700 hover:bg-slate-50">×</button>
              </div>

              <form onSubmit={createActivity} className="mt-8 space-y-5">
                <label className="block">
                  <span className="field-label">Activity name</span>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Focus, Reading, Workout"
                    className="input mt-2 w-full"
                  />
                </label>

                <label className="block">
                  <span className="field-label">Description <span className="normal-case font-normal text-slate-400">(optional)</span></span>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="What is this activity about?"
                    rows={3}
                    className="input mt-2 w-full resize-none"
                  />
                </label>

                <div>
                  <span className="field-label">Set duration</span>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    <label className="block">
                      <input inputMode="numeric" value={newHours} onChange={(e) => setNewHours(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="input w-full text-center tabular-nums" />
                      <span className="mt-1.5 block text-center text-xs text-slate-500">Hours</span>
                    </label>
                    <label className="block">
                      <input inputMode="numeric" value={newMinutes} onChange={(e) => setNewMinutes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="25" className="input w-full text-center tabular-nums" />
                      <span className="mt-1.5 block text-center text-xs text-slate-500">Minutes</span>
                    </label>
                    <label className="block">
                      <input inputMode="numeric" value={newSeconds} onChange={(e) => setNewSeconds(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="input w-full text-center tabular-nums" />
                      <span className="mt-1.5 block text-center text-xs text-slate-500">Seconds</span>
                    </label>
                  </div>
                </div>

                {formError && <p className="text-sm text-rose-600">{formError}</p>}

                <button type="submit" className="btn-primary w-full py-3 text-base">
                  Add activity
                </button>
              </form>

              <div className="mt-10">
                <h3 className="field-label">Your activities</h3>
                <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
                  {activities.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-medium text-slate-900">{a.name}</span>
                        <span className="text-sm text-slate-500 tabular-nums">{formatDuration(a.durationSeconds)}</span>
                        {a.description ? (
                          <span className="mt-0.5 block text-sm leading-snug text-slate-500 line-clamp-2">{a.description}</span>
                        ) : null}
                      </span>
                      <button
                        onClick={() => void removeActivity(a.id)}
                        disabled={activities.length <= 1}
                        className="btn-secondary px-3 py-1.5 text-sm shrink-0"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
