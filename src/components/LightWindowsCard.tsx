'use client';

import React from 'react';
import type { ShiftPlanDay } from '../../../lib/insightsClient'; // adjust path if needed

export default function LightWindowsCard({ plan }: { plan: ShiftPlanDay[] }) {
  if (!plan?.length) return null;
  return (
    <div className="w-full max-w-3xl rounded-2xl border p-4 shadow-sm bg-white">
      <h2 className="text-xl font-semibold mb-3">Light Windows</h2>
      <div className="grid gap-3">
        {plan.map((d) => (
          <div key={d.date} className="rounded-xl border p-3">
            <div className="font-medium mb-1">{new Date(d.date).toDateString()}</div>
            <div className="grid sm:grid-cols-3 gap-2 text-sm">
              <Info label="Seek (bright/outdoor)" value={d.light_seek.map(([a,b]) => `${a}–${b}`).join(', ')} />
              <Info label="Reduce light (dim)" value={d.light_avoid.map(([a,b]) => `${a}–${b}`).join(', ')} />
              <Info label="Tip" value="Outdoors wins; in dim window keep room <50 lux" />
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
