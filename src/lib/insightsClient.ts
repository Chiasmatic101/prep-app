// src/lib/insightsClient.ts
export type Direction = 'advance' | 'delay';

export interface ShiftPlanDay {
  date: string;
  tz: string;
  wake: string;         // "HH:mm"
  bed: string;          // "HH:mm"
  light_seek: [string, string][];  // [["HH:mm","HH:mm"], ...]
  light_avoid: [string, string][];
  exercise_window: [string, string];
  meals: Record<string, any>;
  nap: { allowed: boolean; latest: string; max_minutes: number };
}

export interface ShiftPlanResponse {
  plan: ShiftPlanDay[];
}

const toHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

const addMinutes = (hhmm: string, m: number) => {
  const [H, M] = hhmm.split(':').map(Number);
  const d = new Date(Date.UTC(2000,0,1,H,M,0));
  d.setUTCMinutes(d.getUTCMinutes() + m);
  return toHHMM(d);
};

// A tiny local generator so the UI still works even if the API isn't deployed yet.
function generatePlanLocal(opts: {
  tz: string; currentWake: string; targetWake: string; direction: Direction; days?: number; sleepNeedMin?: number;
}): ShiftPlanResponse {
  const { tz, currentWake, targetWake, direction, days = 7, sleepNeedMin = 9*60 } = opts;
  const step = direction === 'advance' ? -30 : 30; // 30 min/day
  const daysOut: ShiftPlanDay[] = [];
  let wake = currentWake;

  const diffMin = (a: string, b: string) => {
    const [ah, am] = a.split(':').map(Number);
    const [bh, bm] = b.split(':').map(Number);
    return (bh*60+bm) - (ah*60+am);
  };

  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0,10);

    const remaining = diffMin(wwake(wake), wwake(targetWake));
    const stepThis = Math.abs(remaining) < Math.abs(step) ? remaining : step;
    const nextWake = addMinutes(wake, stepThis);
    const bed = addMinutes(nextWake, -sleepNeedMin);

    const light_seek = direction === 'advance'
      ? [[addMinutes(nextWake, 15), addMinutes(nextWake, 60)]]
      : [[addMinutes(nextWake, 540), addMinutes(nextWake, 600)]]; // ~9–10h after wake

    const light_avoid = direction === 'advance'
      ? [[addMinutes(bed, -180), bed]] // last 3h
      : [[addMinutes(bed, -90), bed]]; // shorter dim

    const meals = direction === 'advance'
      ? { breakfast_by: addMinutes(nextWake, 90), lunch: ["12:00","13:30"], dinner_end_by: addMinutes(bed, -180) }
      : { breakfast: ["08:00","10:00"], lunch: ["12:30","14:00"], dinner_end_by: addMinutes(bed, -120) };

    const exercise_window = direction === 'advance'
      ? [addMinutes(nextWake, 120), addMinutes(nextWake, 240)]
      : [addMinutes(nextWake, 540), addMinutes(nextWake, 660)];

    daysOut.push({
      date, tz,
      wake: nextWake,
      bed,
      light_seek: light_seek as [string,string][],
      light_avoid: light_avoid as [string,string][],
      exercise_window: exercise_window as [string,string],
      meals,
      nap: { allowed: true, latest: addMinutes(nextWake, 480-90), max_minutes: 20 },
    });

    wake = nextWake;
  }

  function wwake(x: string){ return x; } // placeholder to mirror the diffMin signature
  return { plan: daysOut };
}

export async function getShiftPlan(input: {
  tz: string;
  currentWake: string;
  targetWake: string;
  direction: Direction;
  days?: number;
}): Promise<ShiftPlanResponse> {
  try {
    const res = await fetch('/api/insights/shift-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('API not available');
    return await res.json();
  } catch {
    // Fallback so you can develop the UI immediately
    return generatePlanLocal({ ...input });
  }
}
