'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import {
  ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
  LineChart, Line
} from 'recharts'

/** ========= Types ========= */
interface CognitiveScore {
  date: string
  displayDate: string
  memory: number
  attention: number
  recall: number
  problemSolving: number
  creativity: number
  timestamp?: any
}
type DomainKey = 'memory' | 'attention' | 'recall' | 'problemSolving' | 'creativity'

/** ========= Helpers ========= */
const clamp01 = (v: any) => Math.max(0, Math.min(100, typeof v === 'number' ? v : 0))

// Map UI selection -> actual data field (camelCase for problemSolving)
const domainKeyMap: Record<string, DomainKey> = {
  memory: 'memory',
  attention: 'attention',
  recall: 'recall',
  problemsolving: 'problemSolving',
  creativity: 'creativity',
}

const getDomainEmoji = (domain: string) => {
  switch (domain) {
    case 'Memory': return '🧠'
    case 'Attention': return '👁️'
    case 'Recall': return '💭'
    case 'Problem Solving': return '🧩'
    case 'Creativity': return '🎨'
    default: return '📊'
  }
}

const getDomainColor = (domain: string) => {
  switch (domain.toLowerCase()) {
    case 'memory': return '#8B5CF6'
    case 'attention': return '#EC4899'
    case 'recall': return '#06B6D4'
    case 'problemsolving':
    case 'problem solving': return '#10B981'
    case 'creativity': return '#F59E0B'
    default: return '#6B7280'
  }
}

/** ========= Page ========= */
export default function MyBrainPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const debug = searchParams?.get('debug') === '1'

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cognitiveData, setCognitiveData] = useState<CognitiveScore[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string>('memory')

  // Debug state
  const [debugInfo, setDebugInfo] = useState<any>({
    projectId: '',
    userId: '',
    triggerStatus: '',
    fetchStatus: '',
    snapshotSize: 0,
    docIds: [] as string[],
    error: '',
  })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        const projectId = getApp().options.projectId as string
        setDebugInfo((d: any) => ({ ...d, projectId }))

        if (!user) {
          setDebugInfo((d: any) => ({ ...d, userId: '(none)', error: 'No auth user' }))
          router.push('/auth')
          return
        }

        setUserId(user.uid)
        setDebugInfo((d: any) => ({ ...d, userId: user.uid }))

        // 1) Trigger the Cloud Function (non-blocking)
        try {
          const url = `https://us-central1-prepapp-fae61.cloudfunctions.net/testDailyScores?userId=${encodeURIComponent(
            user.uid
          )}`
          const res = await fetch(url)
          const txt = await res.text()
          setDebugInfo((d: any) => ({
            ...d,
            triggerStatus: `HTTP ${res.status} ${res.statusText} • ${txt.slice(0, 140)}`
          }))
          console.log('[MyBrain] trigger response:', res.status, txt)
        } catch (e: any) {
          setDebugInfo((d: any) => ({ ...d, triggerStatus: `Trigger error: ${e?.message || e}` }))
          console.warn('[MyBrain] trigger failed:', e)
        }

        // 2) Tiny pause to let serverTimestamp write land
        await new Promise((r) => setTimeout(r, 600))

        // 3) Fetch & render
        await fetchCognitiveScores(user.uid)
      } catch (e: any) {
        console.error('[MyBrain] auth effect error:', e)
        setDebugInfo((d: any) => ({ ...d, error: e?.message || String(e) }))
      }
    })
    return () => unsub()
  }, [router])

  const fetchCognitiveScores = async (uid: string) => {
    try {
      setLoading(true)
      setDebugInfo((d: any) => ({ ...d, fetchStatus: 'starting…' }))

      // Option A: read full subcollection (no orderBy), sort by doc.id 'YYYY-MM-DD'
      const colRef = collection(db, 'users', uid, 'dailyCognitiveScores')
      const snap = await getDocs(colRef)

      const docIds = snap.docs.map((d) => d.id)
      setDebugInfo((d: any) => ({
        ...d,
        fetchStatus: 'got snapshot',
        snapshotSize: snap.size,
        docIds,
      }))
      console.log('[MyBrain] snapshot size:', snap.size, 'docIds:', docIds)

      const rows: CognitiveScore[] = []
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any
        const date = docSnap.id // 'YYYY-MM-DD'
        rows.push({
          date,
          displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          memory: clamp01(data.memory),
          attention: clamp01(data.attention),
          recall: clamp01(data.recall),
          problemSolving: clamp01(data.problemSolving),
          creativity: clamp01(data.creativity),
          timestamp: data.timestamp ?? null,
        })
      })

      // Sort oldest -> newest lexicographically
      rows.sort((a, b) => a.date.localeCompare(b.date))
      const last30 = rows.slice(-30)

      setCognitiveData(last30)
      setError(last30.length ? '' : 'No cognitive data found')
      setDebugInfo((d: any) => ({ ...d, fetchStatus: `prepared ${last30.length} rows` }))
      console.log('[MyBrain] prepared rows:', last30.length, last30)
    } catch (err: any) {
      console.error('Error fetching cognitive scores:', err)
      setError('Failed to load cognitive data')
      setDebugInfo((d: any) => ({ ...d, fetchStatus: 'error', error: err?.message || String(err) }))
    } finally {
      setLoading(false)
    }
  }

  const latestScores = () => {
    if (!cognitiveData.length) return []
    const latest = cognitiveData[cognitiveData.length - 1]
    return [
      { domain: 'Memory', score: latest.memory, fullMark: 100 },
      { domain: 'Attention', score: latest.attention, fullMark: 100 },
      { domain: 'Recall', score: latest.recall, fullMark: 100 },
      { domain: 'Problem Solving', score: latest.problemSolving, fullMark: 100 },
      { domain: 'Creativity', score: latest.creativity, fullMark: 100 },
    ]
  }

  const averageScores = () => {
    if (!cognitiveData.length) return []
    const domains: DomainKey[] = ['memory', 'attention', 'recall', 'problemSolving', 'creativity']
    const names = ['Memory', 'Attention', 'Recall', 'Problem Solving', 'Creativity']

    return domains.map((key, idx) => {
      const avg = cognitiveData.reduce((sum, d) => sum + (d[key] ?? 0), 0) / cognitiveData.length
      const latest = cognitiveData[cognitiveData.length - 1][key] ?? 0
      return {
        domain: names[idx],
        average: Math.round(avg),
        latest,
        emoji: getDomainEmoji(names[idx]),
      }
    })
  }

  /** ===== UI States ===== */
 if (loading) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 px-6 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/Prep/AboutMe"
            className="inline-flex items-center gap-2 text-purple-700 hover:text-purple-800 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to About Me
          </Link>
        </div>

        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
            <p className="text-purple-600 font-medium">Loading your cognitive data...</p>
          </div>
        </div>
      </div>
    </main>
  )
}


  if (error || !cognitiveData.length) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-white/40 backdrop-blur-sm p-10 rounded-[2rem] border border-white/40 shadow-lg max-w-md"
        >
          <div className="text-4xl mb-4">🧠</div>
          <h2 className="text-2xl font-bold text-purple-700 mb-4">No Cognitive Data Yet</h2>
          <p className="text-gray-700 mb-6">
            {error || 'Complete some cognitive assessments to see your brain performance data here.'}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/cognitive-assessment')}
              className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-full font-medium w-full hover:scale-105 transition-all"
            >
              🧪 Start Assessment
            </button>
            <button
              onClick={() => router.push('/Prep/AboutMe')}
              className="bg-white/50 text-purple-700 px-6 py-3 rounded-full font-medium border border-purple-300 w-full hover:scale-105 transition-all"
            >
              👤 Back to Profile
            </button>
          </div>

          {/* Debug overlay even on empty */}
          {debug && (
            <div className="mt-6 p-4 bg-black/80 text-green-200 rounded-xl text-sm text-left">
              <div className="font-semibold text-green-300 mb-2">Debug</div>
              <pre className="whitespace-pre-wrap">
{JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </motion.div>
      </main>
    )
  }

  const latest = latestScores()
  const averages = averageScores()
  const selectedDataKey: DomainKey = domainKeyMap[selectedDomain] ?? 'memory'

  return (
    <main className="min-h-screen font-sans bg-gradient-to-br from-yellow-50 to-pink-100 text-gray-900 px-6 py-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
 <div className="mb-6">
        <Link href="/Prep/AboutMe" className="inline-flex items-center gap-2 text-purple-700 hover:text-purple-800 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to About Me
        </Link>
      </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            <span className="text-purple-700">My Brain</span> 🧠
          </h1>
          <p className="text-lg text-gray-700">
            Track your cognitive performance across key domains • {cognitiveData.length} days of data
          </p>
        </motion.div>

        {/* Snapshot (Radar + Averages Bar) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          <h2 className="text-2xl font-bold text-purple-700 mb-6 text-center">📊 Current Performance Snapshot</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Radar */}
            <div className="bg-white/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Latest Scores</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={latest}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="domain" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="Score" dataKey="score" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Averages Bar */}
            <div className="bg-white/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Performance Averages</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={averages}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="domain" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="average" fill="#EC4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Domain tiles */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
        >
          {averages.map((item) => {
            const key = item.domain.toLowerCase().replace(/\s+/g, '')
            return (
              <div
                key={item.domain}
                className={`bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/40 shadow-lg text-center cursor-pointer transition-all hover:scale-105 ${
                  selectedDomain === key ? 'ring-2 ring-purple-500 bg-white/60' : ''
                }`}
                onClick={() => setSelectedDomain(key)}
              >
                <div className="text-2xl mb-2">{item.emoji}</div>
                <h3 className="font-semibold text-sm text-gray-800 mb-1">{item.domain}</h3>
                <div className="text-lg font-bold text-purple-700">{item.latest}</div>
                <div className="text-xs text-gray-600">latest • avg {item.average}</div>
              </div>
            )
          })}
        </motion.div>

        {/* Line chart */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-purple-700 mb-4 md:mb-0">
              📈 {averages.find((s) => s.domain.toLowerCase().replace(/\s+/g, '') === selectedDomain)?.domain || 'Memory'} Performance Over Time
            </h2>
            <div className="text-sm text-gray-600">
              {cognitiveData.length} days • Last date:{' '}
              {cognitiveData.length ? new Date(cognitiveData[cognitiveData.length - 1].date).toLocaleDateString() : 'N/A'}
            </div>
          </div>
          <div className="bg-white/50 rounded-xl p-6">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={cognitiveData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayDate" />
                <YAxis domain={[0, 100]} />
                <Tooltip labelFormatter={(label) => `Date: ${label}`} formatter={(value, name) => [`${value}`, name]} />
                <Line
                  type="monotone"
                  dataKey={domainKeyMap[selectedDomain] ?? 'memory'}
                  stroke={getDomainColor(selectedDomain)}
                  strokeWidth={3}
                  dot={{ fill: getDomainColor(selectedDomain), strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Simple insights / actions */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          <h2 className="text-2xl font-bold text-purple-700 mb-6 text-center">💡 Cognitive Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-semibold text-gray-800 mb-2">Best Performance</h3>
              <p className="text-sm text-gray-600">
                Your {
                  averages.reduce((best: any, cur: any) => (cur.average > best.average ? cur : best), averages[0]).domain
                } scores are consistently strong.
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">📈</div>
              <h3 className="font-semibold text-gray-800 mb-2">Data Collected</h3>
              <p className="text-sm text-gray-600">{cognitiveData.length} days of cognitive performance data</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-semibold text-gray-800 mb-2">Quick Tip</h3>
              <p className="text-sm text-gray-600">Take assessments during your peak hours for best results.</p>
            </div>
          </div>
        </motion.div>

        {/* Debug overlay (open with ?debug=1) */}
        {debug && (
          <div className="mt-6 p-4 bg-black/80 text-green-200 rounded-xl text-sm overflow-auto">
            <div className="font-semibold text-green-300 mb-2">Debug</div>
            <pre className="whitespace-pre-wrap">
{JSON.stringify(debugInfo, null, 2)}
            </pre>
            <div className="mt-3">
              <div className="font-semibold text-green-300 mb-1">Loaded rows (last 30):</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left">
                    <th className="pr-2">Date</th>
                    <th className="pr-2">Mem</th>
                    <th className="pr-2">Attn</th>
                    <th className="pr-2">Recall</th>
                    <th className="pr-2">ProbSolv</th>
                    <th className="pr-2">Creat</th>
                  </tr>
                </thead>
                <tbody>
                  {cognitiveData.map((r) => (
                    <tr key={r.date}>
                      <td className="pr-2">{r.date}</td>
                      <td className="pr-2">{r.memory}</td>
                      <td className="pr-2">{r.attention}</td>
                      <td className="pr-2">{r.recall}</td>
                      <td className="pr-2">{r.problemSolving}</td>
                      <td className="pr-2">{r.creativity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
