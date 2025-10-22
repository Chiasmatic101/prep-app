import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../firebase/config'; // adjust path if needed
import { collection, getDocs, orderBy, limit, query } from 'firebase/firestore';

function median(xs:number[]){ if(!xs.length) return 0; const s=[...xs].sort((a,b)=>a-b); const i=Math.floor(s.length/2); return s.length%2?s[i]:(s[i-1]+s[i])/2; }
const abs=(x:number)=>Math.abs(x);

export async function POST(req: NextRequest) {
  const { uid, lookbackDays = 60, maxSessions = 400 } = await req.json();
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });

  // Pull precomputed features if available, else raw sessions
  const featSnap = await getDocs(query(
    collection(db, 'users', uid, 'features_sessions'),
    orderBy('createdAt','desc'),
    limit(Math.min(maxSessions, 500))
  ));
  let items:any[] = featSnap.docs.map(d=>d.data());

  if (items.length < 30) {
    const rawSnap = await getDocs(query(
      collection(db, 'users', uid, 'gameSessions'),
      orderBy('timestamp','desc'),
      limit(Math.min(maxSessions, 500))
    ));
    const raw = rawSnap.docs.map(d=>d.data() as any);
    if (!raw.length) return NextResponse.json({ error: 'no sessions' }, { status: 404 });
    const rts = raw.map(s=>Number(s.rtMedianMs)).filter(Number.isFinite);
    const rtMed = median(rts);
    const rtMAD = median(rts.map(v=>abs(v-rtMed))) || 1;
    items = raw.map(s=>{
      const start = new Date(s.gameStartAt ?? s.timestamp?.toDate?.() ?? Date.now());
      const h = start.getHours();
      const rt = Number(s.rtMedianMs) || rtMed;
      const rtZ = (rt-rtMed)/rtMAD;
      // naive minsSinceLastMeal = unknown in raw; skip bucket if missing
      return { timeOfDayHour: h, rtZ, minsSinceLastMeal: s.minsSinceLastMeal, lastMealType: s.lastMealType };
    });
  }

  // Bucket by time since last meal (<=90, 90-180, >180)
  const buckets: Record<string, number[]> = { '≤90m':[], '90–180m':[], '>180m':[] };
  items.forEach(f=>{
    const t = Number(f.minsSinceLastMeal);
    if (!Number.isFinite(t)) return;
    const score = -Number(f.rtZ); // higher = faster
    if (t <= 90) buckets['≤90m'].push(score);
    else if (t <= 180) buckets['90–180m'].push(score);
    else buckets['>180m'].push(score);
  });

  const summary = Object.entries(buckets).map(([k,arr])=>({
    bucket: k,
    n: arr.length,
    medianScore: median(arr),
  })).sort((a,b)=>b.medianScore - a.medianScore);

  return NextResponse.json({ summary });
}

export const dynamic = 'force-dynamic';
