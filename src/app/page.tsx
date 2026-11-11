"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, db, firebaseEnabled, googleProvider } from "@/lib/firebase";
import {
  DEFAULT_ACTIVITIES,
  formatDuration,
  formatDurationLong,
  loadLocalActivities,
  saveLocalActivities,
  type Activity,
} from "@/lib/activities";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [activities, setActivities] = useState<Activity[]>(DEFAULT_ACTIVITIES);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(DEFAULT_ACTIVITIES[0].durationSeconds);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState("");
  const [syncNote, setSyncNote] = useState("");
  const [loaded, setLoaded] = useState(false);

  // New-activity form
  const [newName, setNewName] = useState("");
  const [newHours, setNewHours] = useState("");
  const [newMinutes, setNewMinutes] = useState("25");
  const [newSeconds, setNewSeconds] = useState("");
  const [formError, setFormError] = useState("");

  const endAtRef = useRef<number | null>(null);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;
  const activitiesRef = useRef(activities);
  activitiesRef.current = activities;

  const current = activities[Math.min(index, Math.max(0, activities.length - 1))] || DEFAULT_ACTIVITIES[0];
  const total = current?.durationSeconds || 0;
  const progress = total > 0 ? 1 - remaining / total : 0;

  // ---- Auth ----
  useEffect(() => {
    if (!firebaseEnabled || !auth) return;
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // ---- Load activities: Firestore when signed in, else localStorage ----
  useEffect(() => {
    if (firebaseEnabled && db && user) {
      const q = query(
        collection(db, "users", user.uid, "activities"),
        orderBy("createdAt", "asc")
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Activity, "id">) }));
          if (list.length > 0) {
            setActivities(list);
            setSyncNote("Saved to your account");
          } else {
            // First sign-in: seed Firestore with whatever is local / default
            const seed = activitiesRef.current;
            seed.forEach((a) => {
              void setDoc(doc(db as never, "users", user.uid, "activities", a.id), {
                name: a.name,
                durationSeconds: a.durationSeconds,
                createdAt: a.createdAt,
              } as never);
            });
            setSyncNote("Saved to your account");
          }
          setLoaded(true);
        },
        () => {
          setSyncNote("Could not reach Firestore — using this device only");
          setLoaded(true);
        }
      );
      return () => unsub();
    }
    if (!loaded) {
      const local = loadLocalActivities();
      if (local) setActivities(local);
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Persist locally whenever activities change and we are NOT cloud-synced
  useEffect(() => {
    if (!loaded) return;
    if (!(firebaseEnabled && user)) saveLocalActivities(activities);
  }, [activities, loaded, user]);

  // Keep timer in sync when the selected activity changes
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

  useEffect(() => {
    document.title = running || remaining !== total
      ? `${formatDuration(remaining)} — ${current?.name || "Enzi Timer"}`
      : "Enzi Timer — Focus, beautifully timed";
  }, [remaining, running, total, current?.name]);

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

  const handleGoogle = async () => {
    setAuthError("");
    if (!firebaseEnabled || !auth || !googleProvider) {
      setAuthError("Firebase is not configured yet — sign-in will work once the Firebase keys are added in Vercel.");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setAuthError("Google sign-in was cancelled or blocked. Please try again.");
    }
  };

  const persistActivity = async (a: Activity) => {
    if (firebaseEnabled && db && user) {
      await setDoc(doc(db, "users", user.uid, "activities", a.id), {
        name: a.name,
        durationSeconds: a.durationSeconds,
        createdAt: a.createdAt,
      });
    }
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
    const a: Activity = { id: uid(), name, durationSeconds, createdAt: Date.now() };
    const next = [...activities, a];
    // Firestore onSnapshot will echo this back; local mode updates state directly.
    if (!(firebaseEnabled && user)) setActivities(next);
    await persistActivity(a).catch(() => setActivities(next));
    if (firebaseEnabled && user) setActivities(next);
    setNewName("");
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
    if (firebaseEnabled && db && user) {
      await deleteDoc(doc(db, "users", user.uid, "activities", id)).catch(() => undefined);
    }
    const removedIndex = activities.findIndex((a) => a.id === id);
    if (removedIndex <= index) selectActivity(Math.max(0, index - 1), list);
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="text-[15px] font-semibold tracking-tight">Enzi Timer</span>
            <span className="hidden sm:inline text-xs tracking-[0.18em] uppercase text-zinc-400">Focus — beautifully timed</span>
          </div>
          <div className="flex items-center gap-2">
            {firebaseEnabled && user ? (
              <>
                <span className="hidden sm:block text-sm text-zinc-600 max-w-[160px] truncate">{user.displayName || user.email}</span>
                <button onClick={() => void signOut(auth!)} className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-zinc-900 transition-colors">Sign out</button>
              </>
            ) : (
              <button onClick={() => void handleGoogle()} className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:border-zinc-900 transition-colors">
                Sign in with Google
              </button>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-full bg-zinc-900 text-white px-3.5 py-1.5 text-sm hover:bg-zinc-700 transition-colors"
            >
              + New activity
            </button>
          </div>
        </div>
      </header>

      {authError && (
        <div className="mx-auto w-full max-w-5xl px-5 md:px-8 pt-4">
          <p className="border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">{authError}</p>
        </div>
      )}

      {/* Timer */}
      <section className="flex-1 mx-auto w-full max-w-5xl px-5 md:px-8 py-10 md:py-16">
        <div className="grid md:grid-cols-[1fr_320px] gap-10 md:gap-14">
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-zinc-400">
              Activity {String(Math.min(index + 1, activities.length)).padStart(2, "0")} / {String(activities.length).padStart(2, "0")}
              {syncNote ? <span className="normal-case tracking-normal"> · {syncNote}</span> : null}
              {!firebaseEnabled ? <span className="normal-case tracking-normal"> · Local mode — add Firebase keys to sync across devices</span> : null}
            </p>

            {/* Prev / Next */}
            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                onClick={() => selectActivity(index - 1)}
                aria-label="Previous activity"
                className="h-11 w-11 shrink-0 rounded-full border border-zinc-300 bg-white text-xl leading-none hover:border-zinc-900 transition-colors"
              >‹</button>
              <h1 className="text-center text-3xl md:text-[40px] leading-tight font-semibold tracking-tight truncate px-2">
                {current?.name}
              </h1>
              <button
                onClick={() => selectActivity(index + 1)}
                aria-label="Next activity"
                className="h-11 w-11 shrink-0 rounded-full border border-zinc-300 bg-white text-xl leading-none hover:border-zinc-900 transition-colors"
              >›</button>
            </div>

            <p className="mt-2 text-center text-sm text-zinc-500">
              Total duration <span className="text-zinc-900 font-medium tabular-nums">{formatDurationLong(total)}</span>
              {finished ? <span className="text-accent font-medium"> · Done — nice work.</span> : null}
            </p>

            {/* Countdown */}
            <div className="mt-8 md:mt-10 text-center">
              <div className="timer-digits text-[84px] leading-none md:text-[148px] font-semibold tracking-tight">
                {formatDuration(remaining)}
              </div>
              <div className="mt-6 h-[3px] w-full bg-zinc-200 overflow-hidden">
                <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
              </div>
              <p className="mt-3 text-xs tracking-[0.18em] uppercase text-zinc-400">
                {running ? "Running" : finished ? "Finished" : remaining !== total ? "Paused" : "Ready"}
                {" · "}
                {Math.round(progress * 100)}% elapsed
              </p>
            </div>

            {/* Controls */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {!running ? (
                <button onClick={start} className="rounded-full bg-accent px-8 py-3 text-white text-[15px] font-medium hover:opacity-90 transition-opacity min-w-[120px]">
                  {remaining !== total && remaining > 0 ? "Resume" : "Start"}
                </button>
              ) : (
                <button onClick={pause} className="rounded-full bg-zinc-900 px-8 py-3 text-white text-[15px] font-medium hover:bg-zinc-700 transition-colors min-w-[120px]">Pause</button>
              )}
              <button onClick={reset} className="rounded-full border border-zinc-300 bg-white px-8 py-3 text-[15px] font-medium hover:border-zinc-900 transition-colors min-w-[120px]">Stop / Reset</button>
            </div>

            <p className="mt-8 text-center text-xs text-zinc-400">
              Tip: use ‹ › to move between activities. Your timer keeps time even if the tab is throttled.
            </p>
          </div>

          {/* Activity list */}
          <aside className="md:border-l md:border-zinc-200 md:pl-8">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs tracking-[0.2em] uppercase text-zinc-400">Activities</h2>
              <button onClick={() => setSettingsOpen(true)} className="text-sm underline underline-offset-4 hover:text-zinc-900">Manage</button>
            </div>
            <ul className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200">
              {activities.map((a, i) => (
                <li key={a.id}>
                  <button
                    onClick={() => selectActivity(i)}
                    className={`w-full flex items-center justify-between gap-3 py-3.5 text-left ${i === index ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${i === index ? "bg-accent" : "bg-zinc-300"}`} />
                      <span className="truncate text-[15px] font-medium">{a.name}</span>
                    </span>
                    <span className="tabular-nums text-sm shrink-0">{formatDuration(a.durationSeconds)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">
              Sign in with Google to save activities to your account with Firestore. Without sign-in, they stay on this device.
            </p>
          </aside>
        </div>
      </section>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto max-w-5xl px-5 md:px-8 py-5 flex items-center justify-between text-xs text-zinc-400">
          <span>ENZI TIMER — 01</span>
          <span>{firebaseEnabled ? "Firebase connected" : "Firebase — add keys to enable cloud sync"}</span>
        </div>
      </footer>

      {/* Settings / New activity — slide-over */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Activity settings">
          <button aria-label="Close settings" onClick={() => setSettingsOpen(false)} className="absolute inset-0 bg-zinc-900/30" />
          <div className="relative w-full max-w-md bg-white h-full overflow-y-auto border-l border-zinc-200 shadow-none">
            <div className="p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">New activity</h2>
                  <p className="mt-1 text-sm text-zinc-500">Name it, set a duration, and it joins your list.</p>
                </div>
                <button onClick={() => setSettingsOpen(false)} aria-label="Close" className="h-9 w-9 rounded-full border border-zinc-300 text-lg leading-none hover:border-zinc-900">×</button>
              </div>

              <form onSubmit={createActivity} className="mt-8 space-y-5">
                <label className="block">
                  <span className="text-xs tracking-[0.16em] uppercase text-zinc-500">Activity name</span>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Focus, Reading, Workout"
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-[15px] outline-none focus:border-zinc-900 placeholder:text-zinc-400"
                  />
                </label>

                <div>
                  <span className="text-xs tracking-[0.16em] uppercase text-zinc-500">Set duration</span>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    <label className="block">
                      <input inputMode="numeric" value={newHours} onChange={(e) => setNewHours(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-center text-[15px] tabular-nums outline-none focus:border-zinc-900" />
                      <span className="mt-1.5 block text-center text-xs text-zinc-500">Hours</span>
                    </label>
                    <label className="block">
                      <input inputMode="numeric" value={newMinutes} onChange={(e) => setNewMinutes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="25" className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-center text-[15px] tabular-nums outline-none focus:border-zinc-900" />
                      <span className="mt-1.5 block text-center text-xs text-zinc-500">Minutes</span>
                    </label>
                    <label className="block">
                      <input inputMode="numeric" value={newSeconds} onChange={(e) => setNewSeconds(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-center text-[15px] tabular-nums outline-none focus:border-zinc-900" />
                      <span className="mt-1.5 block text-center text-xs text-zinc-500">Seconds</span>
                    </label>
                  </div>
                </div>

                {formError && <p className="text-sm text-accent">{formError}</p>}

                <button type="submit" className="w-full rounded-full bg-zinc-900 py-3 text-white text-[15px] font-medium hover:bg-zinc-700 transition-colors">
                  Add activity
                </button>
              </form>

              <div className="mt-10">
                <h3 className="text-xs tracking-[0.16em] uppercase text-zinc-500">Your activities</h3>
                <ul className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200">
                  {activities.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-medium">{a.name}</span>
                        <span className="text-sm text-zinc-500 tabular-nums">{formatDuration(a.durationSeconds)}</span>
                      </span>
                      <button
                        onClick={() => void removeActivity(a.id)}
                        disabled={activities.length <= 1}
                        className="shrink-0 rounded-full border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:border-zinc-900"
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
