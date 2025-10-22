'use client';

import React, { useMemo } from 'react';
import type { ShiftPlanDay } from '@/lib/insightsClient';

export default function StudyBlocks({
  plan,
  bestStartHour,
  days = 7
}: { plan: ShiftPlanDay[]; bestStartHour: number; days?: number }) {

  const rows = useMemo(() => {
    const take = Math.min(days, plan.length);
    const out: { date: string; blocks: [string,string][] }[] = [];
    for (let i = 0; i < take; i++) {
      const d = plan[i];
      const primary: [string, string] = [hhmm(bestStartHour, 0), hhmm((bestStartHour + 2) % 24, 0)];
      // A fallback block earlier in the day (e.g., late morning)
      const fallback: [string, string] = ['11:00', '12:00'];

      // Avoid overlap with dim window (light_avoid)
      const safe: [string, string][] = [];
      const dim = d.light_avoid?.[0] || null; // ["HH:mm","HH:mm"]
      const cand = [primary, fallback];

      for (const c of cand) {
        if (!overlaps(c, dim)) safe.push(c);
        if (safe.length === 2) break;
      }
      // If both overlapped, shift earlier by 60 min
      while (safe.length < 2 && cand.length) {
        const c = shift(cand[0], -60);
        if (!overlaps(c, dim)) safe.push(c);
        cand.shift();
      }

      out.push({ date: d.date, blocks: safe.length ? safe : [primary] });
    }
    return out;
  }, [plan, bestStartHour, days]);

  return (
    <div className="w-full max-w-3xl rounded-2xl border p-4 shadow-sm bg-white">
      <h2 className="text-xl font-semibold mb-3">Suggested Study Blocks</h2>
      <div className="grid gap-3">
        {rows.map(r => (
          <div key={r.date} className="rounded-xl border p-3">
            <div className="font-medium mb-1">{new Date(r.date).toDateString()}</div>
            <div className="flex flex-wrap gap-2 text-sm">
              {r.blocks.map((b, i) => (
                <span key={i} className="rounded-lg bg-blue-50 border border-blue-200 text-blue-800 px-2 py-1">
                  {b[0]}–{b[1]}
                </span>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              We avoid the evening dim window so your study doesn’t push sleep later.
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- helpers (HH:mm math)
function toMin(hhmm: string){ const [H,M]=hhmm.split(':').map(Number); return H*60+M; }
function fromMin(m:number){ m=((m%1440)+1440)%1440; const H=Math.floor(m/60), M=m%60; return `${String(H).padStart(2,'0')}:${String(M).padStart(2,'0')}`; }
function hhmm(H:number, M:number){ return `${String(H).padStart(2,'0')}:${String(M).padStart(2,'0')}`; }
function overlaps(a:[string,string], dim:[string,string]|null){
  if (!dim) return false;
  const [as,ae]=a.map(toMin); const [ds,de]=dim.map(toMin);
  return !(ae<=ds || as>=de);
}
function shift(b:[string,string], delta:number):[string,string]{
  return [fromMin(toMin(b[0])+delta), fromMin(toMin(b[1])+delta)];
}
