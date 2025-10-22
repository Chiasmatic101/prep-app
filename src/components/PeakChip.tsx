'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase/config'; // adjust path if you use '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, orderBy, limit, query } from 'firebase/firestore';

type BestWindow = { startHour: number; endHour: number; samples: number };
const median = (xs:number[]) => { if(!xs.length) return 0; const s=[...xs].sort((a,b)=>a-b); const i=Math.floor(s.length/2); return s.length%2?s[i]:(s[i-1]+s[i])/2; };
const abs = (x:number)=>Math.abs(x);
const hh = (h:number)=>String(((h%24)+24)%24).padStart(2,'0')+':00';

export default function PeakChip({
  lookback = 200,
  onBestStartHour,
}: { lookback?: number; onBestStartHour?: (h:number|null)=>void }) {
  const [best, setBest] = useState<BestWindow|null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>('Calculating peak…');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMsg('Sign in to compute your peak window.');
        setLoading(false);
        onBestStartHour?.(null);
        return;
      }

      try {
        setLoading(true);
        setMsg('Calculating peak…');

        // --- TRY FEATURES FIRST (new path: users/{uid}/features_sessions)
        let items: any[] = [];
        try {
          const featSnap = await getDocs(query(
            collection(db, 'users', user.uid, 'features_sessions'),
            orderBy('createdAt','desc'),
            limit(Math.min(lookback, 500))
          ));
          items = featSnap.docs.map(d => d.data());
        } catch (e) {
          // If path/permission/index issues occur, we’ll just fall back
          console.warn('[PeakChip] skipping features_sessions due to error:', e);
        }

        // --- FALLBACK: raw gameSessions
        if (items.length < 5) {
          const rawSnap = await getDocs(query(
            collection(db, 'users', user.uid, 'gameSessions'),
            orderBy('timestamp','desc'),
            limit(Math.min(lookback, 500))
          ));
          const raw = rawSnap.docs.map(d => d.data() as any);
          if (raw.length < 5) {
            setMsg('Not enough recent sessions (need ≥ 5). Play at a few different times of day.');
            onBestStartHour?.(null);
            setBest(null);
            setLoading(false);
            return;
          }
          const rts = raw.map(s => Number(s.rtMedianMs)).filter(Number.isFinite);
          const rtMed = median(rts);
          const rtMAD = median(rts.map(v => abs(v-rtMed))) || 1;
          items = raw.map(s => {
            const start = new Date(s.gameStartAt ?? s.timestamp?.toDate?.() ?? Date.now());
            const h = start.getHours();
            const rt = Number(s.rtMedianMs) || rtMed;
            const rtZ = (rt - rtMed) / rtMAD;     // lower is better
            return { timeOfDayHour: h, rtZ };
          });
        } else {
          // Ensure a score is present
          const rts = items.map((f:any)=>Number(f.rtMedianMs)).filter(Number.isFinite);
          const rtMed = rts.length ? median(rts) : 0;
          const rtMAD = rts.length ? median(rts.map(v=>abs(v-rtMed))) || 1 : 1;
          items = items.map((f:any)=>{
            if (typeof f.rtZ === 'number') return f;
            const rt = Number(f.rtMedianMs);
            const rtZ = Number.isFinite(rt) ? (rt - rtMed)/rtMAD : 0;
            return { ...f, rtZ };
          });
        }

        // --- Build hour bins (invert rtZ so faster RT → higher score)
        const byHour = new Map<number, number[]>();
        for (const f of items) {
          const h = typeof f.timeOfDayHour === 'number'
            ? f.timeOfDayHour
            : new Date(f.gameStartAt ?? Date.now()).getHours();
          const score = typeof f.rtZ === 'number' ? -f.rtZ : 0;
          if (!byHour.has(h)) byHour.set(h, []);
          byHour.get(h)!.push(score);
        }

        // --- Rolling 2h windows
        let bestWin: BestWindow = { startHour: 9, endHour: 11, samples: 0 };
        let bestScore = -Infinity;
        for (let h=0; h<24; h++) {
          const xs = (byHour.get(h)||[]).concat(byHour.get((h+1)%24)||[]);
          if (xs.length < 5) continue;
          const score = median(xs);
          if (score > bestScore) {
            bestScore = score;
            bestWin = { startHour: h, endHour: (h+2)%24, samples: xs.length };
          }
        }

        if (bestWin.samples === 0) {
          setMsg('Need more variety across the day to estimate a peak (try morning + afternoon sessions).');
          setBest(null);
          onBestStartHour?.(null);
        } else {
          setMsg('');
          setBest(bestWin);
          onBestStartHour?.(bestWin.startHour);
        }
      } catch (err:any) {
        console.error('[PeakChip] fatal error:', err);
        setMsg(err?.message || 'Unable to compute peak window.');
        setBest(null);
        onBestStartHour?.(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [lookback, onBestStartHour]);

  // Always render something
  if (loading || msg) return <Chip muted>{msg}</Chip>;
  if (!best) return <Chip muted>Peak window unavailable.</Chip>;
  return (
    <Chip>
      <span className="font-semibold">Best 2h:</span>&nbsp;{hh(best.startHour)}–{hh(best.endHour)}
      <span className="ml-2 text-xs text-gray-600">({best.samples} sessions)</span>
    </Chip>
  );
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm border ${
      muted ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-purple-50 text-purple-800 border-purple-200'
    }`}>
      {children}
    </div>
  );
}
