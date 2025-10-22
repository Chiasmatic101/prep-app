// src/hooks/useUserPeaks.ts (optional Firestore adapter stub)
// =============================================================


'use client'


import { useEffect, useState } from 'react'
import type { PeakPoint } from '@/types/peaks'
import { makeDemoPeaks } from '@/lib/peaks-demo'
// import { db } from '@/firebase/config'
// import { doc, getDoc } from 'firebase/firestore'


export function useUserPeaks(uid?: string, ymd?: string) {
const [data, setData] = useState<PeakPoint[] | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)


useEffect(() => {
let mounted = true
;(async () => {
try {
// DEMO first
// Replace with Firestore once ready:
// const ref = doc(db, `users/${uid}/peaks/${ymd}`)
// const snap = await getDoc(ref)
// if (snap.exists()) setData(snap.data().points as PeakPoint[])
// else setData(makeDemoPeaks())
setData(makeDemoPeaks())
} catch (e: any) {
setError(e?.message || 'Failed to load peaks')
} finally {
if (mounted) setLoading(false)
}
})()
return () => {
mounted = false
}
}, [uid, ymd])


return { data, loading, error }
}