'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import ShiftPlanCard from '../../../components/ShiftPlanCard';
import StudyBlocks from '../../../components/StudyBlocks';
import LightWindowsCard from '../../../components/LightWindowsCard';
import { getShiftPlan, type Direction, type ShiftPlanDay } from '../../../lib/insightsClient';

// Client-only load for PeakChip (avoids Firebase-on-SSR issues)
const PeakChip = dynamic(() => import('../../../components/PeakChip'), {
  ssr: false,
  loading: () => (
    <div className="inline-flex items-center rounded-full px-3 py-1 text-sm border bg-gray-50 text-gray-600 border-gray-200">
      Calculating peak…
    </div>
  ),
});

export default function InsightsPage() {
  const defaultTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; }
    catch { return 'America/New_York'; }
  }, []);

  const [tz, setTz] = useState(defaultTz);
  const [direction, setDirection] = useState<Direction>('advance');
  const [currentWake, setCurrentWake] = useState('08:30');
  const [targetWake, setTargetWake] = useState('06:30');
  const [days, setDays] = useState(7);

  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<ShiftPlanDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Peak → Study Blocks
  const [bestStartHour, setBestStartHour] = useState<number | null>(null);

  async function onBuildPlan(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await getShiftPlan({ tz, direction, currentWake, targetWake, days });
      setPlan(res.plan);
    } catch (err: any) {
      setError(err?.message || 'Unable to build plan.');
    } finally {
      setLoading(false);
    }
  }

  function copyToday(p: ShiftPlanDay[]) {
    const today = p[0];
    const text = [
      `Wake ${today.wake}`,
      `Bright light ${today.light_seek.map(([a,b])=>`${a}-${b}`).join(', ')}`,
      `Dim ${today.light_avoid.map(([a,b])=>`${a}-${b}`).join(', ')}`,
      `Exercise ${today.exercise_window[0]}-${today.exercise_window[1]}`,
      (today as any).meals?.breakfast_by ? `Breakfast ≤ ${(today as any).meals.breakfast_by}` : '',
      `Dinner ≤ ${(today as any).meals.dinner_end_by}`,
      `Bed ${today.bed}`
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
  }

  async function remindIn(minutes:number, message:string){
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return alert('Notifications not supported');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return alert('Enable notifications to receive reminders');
    setTimeout(() => new Notification(message), minutes*60*1000);
  }

  function scheduleDimReminder() {
    if (!plan?.length) return;
    const [start] = plan[0].light_avoid[0]; // "HH:mm"
    const [h,m] = start.split(':').map(Number);
    const now = new Date();
    const target = new Date(); target.setHours(h, m, 0, 0);
    const diffMin = Math.max(0, Math.round((target.getTime() - now.getTime())/60000) - 15);
    remindIn(diffMin, 'Lights down in 15 min 🌙');
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Prep Insights</h1>

      {/* Peak window chip (always visible; shows a friendly message if not enough data) */}
      <div className="mb-4">
        <PeakChip onBestStartHour={setBestStartHour} />
      </div>

      {/* Shift Plan form */}
      <form
        onSubmit={onBuildPlan}
        className="rounded-2xl border p-4 mb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white"
      >
        <Field label="Timezone">
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={tz}
            onChange={e => setTz(e.target.value)}
            placeholder="America/New_York"
          />
        </Field>

        <Field label="Direction">
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={direction}
            onChange={e => setDirection(e.target.value as Direction)}
          >
            <option value="advance">Advance (earlier)</option>
            <option value="delay">Delay (later)</option>
          </select>
        </Field>

        <Field label="Current Wake">
          <input
            type="time"
            className="w-full border rounded-lg px-3 py-2"
            value={currentWake}
            onChange={e => setCurrentWake(e.target.value)}
          />
        </Field>

        <Field label="Target Wake">
          <input
            type="time"
            className="w-full border rounded-lg px-3 py-2"
            value={targetWake}
            onChange={e => setTargetWake(e.target.value)}
          />
        </Field>

        <Field label="Days">
          <input
            type="number"
            min={3}
            max={14}
            className="w-full border rounded-lg px-3 py-2"
            value={days}
            onChange={e => setDays(parseInt(e.target.value || '7', 10))}
          />
        </Field>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl bg-purple-600 text-white px-4 py-2 font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Building…' : 'Build 7-Day Plan'}
          </button>
        </div>
      </form>

      {/* Any errors from plan generation */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2">
          {error}
        </div>
      )}

      {/* The plan itself */}
      {plan && <ShiftPlanCard plan={plan} />}

      {/* Quick actions + Light windows, only when a plan exists */}
      {plan && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => copyToday(plan)} className="rounded-lg border px-3 py-2 text-sm">
              Copy today’s plan
            </button>
            <button onClick={scheduleDimReminder} className="rounded-lg border px-3 py-2 text-sm">
              Remind me to dim (15m before)
            </button>
          </div>

          <div className="mt-6">
            <LightWindowsCard plan={plan} />
          </div>
        </>
      )}

      {/* Study blocks appear when we have both a plan and a peak start hour */}
      {plan && bestStartHour !== null && (
        <div className="mt-6">
          <StudyBlocks plan={plan} bestStartHour={bestStartHour} />
        </div>
      )}

      {!plan && !loading && (
        <p className="text-sm text-gray-600">
          Tip: Use <b>Advance</b> to move earlier; <b>Delay</b> to move later. This uses only light, meals, exercise, and bedtime—teen friendly.
        </p>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      {children}
    </label>
  );
}
