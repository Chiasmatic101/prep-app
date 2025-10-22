'use client';

import React from 'react';
import type { ShiftPlanDay } from '@/lib/insightsClient';

export default function ShiftPlanCard({ plan }: { plan: ShiftPlanDay[] }) {
  if (!plan?.length) return null;

  return (
    <div className="w-full max-w-3xl rounded-2xl border p-4 shadow-sm bg-white">
      <h2 className="text-xl font-semibold mb-3">7-Day Shift Plan</h2>
      <div className="grid grid-cols-1 gap-3">
        {plan.map((d) => (
          <div key={d.date} className="rounded-xl border p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium">{new Date(d.date).toDateString()}</div>
              <div className="text-sm text-gray-500">TZ: {d.tz}</div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              <Info label="Wake" value={d.wake} />
              <Info label="Bed" value={d.bed} />
              <Info label="Exercise" value={`${d.exercise_window[0]}–${d.exercise_window[1]}`} />
              <Info label="Light (seek)" value={d.light_seek.map(([a,b]) => `${a}–${b}`).join(', ')} />
              <Info label="Dim (reduce light)" value={d.light_avoid.map(([a,b]) => `${a}–${b}`).join(', ')} />
              <Info label="Meals" value={
                d.meals.breakfast_by
                  ? `Breakfast ≤ ${d.meals.breakfast_by}, Dinner ≤ ${d.meals.dinner_end_by}`
                  : `Dinner ≤ ${d.meals.dinner_end_by}`
              } />
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Tips: Keep room &lt;50 lux during dim window • Screens in night mode • Optional nap ≤20 min before {d.nap.latest}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
