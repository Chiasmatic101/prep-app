

'use client'


import { useEffect, useState } from 'react'
import type { ScheduleBlock } from '@/types/peaks'
import { demoSchedule } from '@/lib/peaks-demo'
// import { db } from '@/firebase/config'
// import { collection, getDocs } from 'firebase/firestore'


export function useUserSchedule(uid?: string) {
const [data, setData] = useState<ScheduleBlock[] | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)


useEffect(() => {
let mounted = true
;(async () => {
try {
// DEMO first
// const ref = collection(db, `users/${uid}/schedule`)
// const snap = await getDocs(ref)
// const arr: ScheduleBlock[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
// setData(arr)
setData(demoSchedule)
} catch (e: any) {
setError(e?.message || 'Failed to load schedule')
} finally {
if (mounted) setLoading(false)
}
})()
return () => {
mounted = false
}
}, [uid])


return { data, loading, error }
}