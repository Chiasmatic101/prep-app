'use client';
import React, { useEffect, useState } from 'react';
import { db, auth } from '../../../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, orderBy, limit, query } from 'firebase/firestore';

export default function SynchScoreCard() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return setRows([]);
      const snap = await getDocs(query(
        collection(db, 'users', user.uid, 'synchScores'),
        orderBy('date','desc'),
        limit(14)
      ));
      setRows(snap.docs.map(d => d.data()));
    });
    return () => unsub();
  }, []);
  if (!rows.length) return null;

  return (
    <div className="w-full max-w-3xl rounded-2xl border p-4 shadow-sm bg-white">
      <h2 className="text-xl font-semibold mb-3">Synch Score (last 2 weeks)</h2>
      <div className="grid gap-2 text-sm">
        {rows.map(r=>(
          <div key={r.date} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="font-medium">{r.date}</div>
            <div className="flex items-center gap-4">
              <span className="font-semibold">{Math.round(r.total)}</span>
              <span className="text-gray-500">Light {r.lightPoints ?? 0} · Meals {r.mealPoints ?? 0} · Ex {r.exercisePoints ?? 0} · Phase {r.phasePoints ?? 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
