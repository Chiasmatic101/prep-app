'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { motion, useAnimation } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Brain, TrendingUp, CheckCircle, Star, Zap, ArrowRight } from 'lucide-react'
import { db, auth } from '@/firebase/config'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where
} from 'firebase/firestore'

// -------------------------------
// Types
// -------------------------------
interface CognitiveProfile {
  processingSpeed?: { score: number; percentile: number; accuracy: number; averageReactionTime: number }
  workingMemory?: { maxLevel: number; percentile: number; accuracy: number }
  attention?: { accuracy: number; percentile: number; maxRound: number }
  problemSolving?: { winRate: number; percentile: number; finalDifficulty: number }
}
interface ChronotypeData {
  chronotype: string
  syncScore?: number
  outOfSync?: number
  bedtime?: string
  wakeTime?: string
  schoolStartTime?: string
  sleepDuration?: number
}
interface UserData {
  name: string
  email?: string
  chronotype?: ChronotypeData
  syncScore?: number
  cognitiveProfile?: CognitiveProfile
}

// -------------------------------
// Helpers
// -------------------------------
const estimatePercentile = (value: number, maxValue: number): number => {
  if (!maxValue || maxValue <= 0) return 20
  const ratio = Math.max(0, Math.min(value / maxValue, 1))
  return Math.round(20 + ratio * 70) // 20–90
}

const getChronotypeEmoji = (c: string) => ({ Lion:'🦁', Bear:'🐻', Wolf:'🐺', Dolphin:'🐬' }[c] || '🧠')

const getSyncScoreMessage = (score: number) => {
  if (score >= 80) return 'Excellent alignment with your natural rhythm!'
  if (score >= 60) return 'Good alignment — room for optimization'
  if (score >= 40) return 'Moderate alignment — improvement possible'
  return 'Poor alignment — major improvement opportunities'
}

const calculateOverallCognitiveScore = (p: CognitiveProfile) => {
  const scores = [
    p.processingSpeed?.percentile || 0,
    p.workingMemory?.percentile || 0,
    p.attention?.percentile || 0,
    p.problemSolving?.percentile || 0
  ].filter(n => n > 0)
  if (!scores.length) return 0
  return Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)
}

// Light fallback if we *must* compute sync from a survey-only doc
const fallbackSync = (chronotype: ChronotypeData): number => {
  if (!chronotype.wakeTime || !chronotype.schoolStartTime) return 50
  const parse = (t:string)=>{ const [h,m]=t.split(':').map(Number); return h + (m||0)/60 }
  const wake = parse(chronotype.wakeTime)
  const school = parse(chronotype.schoolStartTime)
  const prep = school - wake
  const idealMap: Record<string, number> = { Lion:2.5, Bear:2, Wolf:3, Dolphin:2.5 }
  const ideal = idealMap[chronotype.chronotype] ?? 2.5
  let score = Math.max(0, 100 - Math.abs(prep-ideal)*25)
  if (chronotype.sleepDuration) {
    const idealSleep = chronotype.chronotype === 'Wolf' ? 8 : 7.5
    score -= Math.abs(chronotype.sleepDuration - idealSleep)*10
  }
  return Math.round(Math.max(0, Math.min(100, score)))
}

// -------------------------------
// Animated blocks
// -------------------------------
function AnimatedHelpBlocks() {
  const [activeIndex, setActiveIndex] = useState(0)
  const controls = useAnimation()
  const sections = [
    {
      title: 'Improve Your Sync Score',
      icon: <CheckCircle className="w-5 h-5 text-green-400" />,
      tips: [
        'We can improve your sync score through lifestyle and sleep alignment.',
        'Personalized schedule experiments help improve focus and energy.',
        'Optimize study timing to match natural peaks.'
      ],
      color: 'from-blue-500/30 to-blue-700/30'
    },
    {
      title: 'Can We Improve Your Grades?',
      icon: <Star className="w-5 h-5 text-yellow-400" />,
      tips: [
        '✅ Better sleep improves memory and learning.',
        '🌙 Improved sync enhances attention and performance.',
        '🧩 Cognitive training targets specific skill gaps.'
      ],
      color: 'from-purple-500/30 to-purple-700/30'
    }
  ]
  useEffect(() => {
    const i = setInterval(()=>setActiveIndex(p=>(p+1)%sections.length), 5000)
    return ()=>clearInterval(i)
  },[])
  return (
    <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch">
      {sections.map((section, i) => (
        <motion.div
          key={i}
          animate={{ opacity: activeIndex===i?1:0.3, scale: activeIndex===i?1.05:1, y: activeIndex===i?0:20 }}
          transition={{ duration: 0.8 }}
          className={`bg-gradient-to-br ${section.color} rounded-2xl p-6 w-full text-center border border-white/20 shadow-lg`}
        >
          <h3 className="text-xl font-bold mb-4 flex items-center justify-center gap-2 text-white">
            {section.icon}{section.title}
          </h3>
          <div className="space-y-3">
            {section.tips.map((tip, idx)=>(<p key={idx} className="text-blue-100 text-sm leading-snug">{tip}</p>))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// -------------------------------
// Main
// -------------------------------
export default function WelcomeResultsPage() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login')
        return
      }
      try {
        // 1) Try AboutMe root doc first (AboutMe stores chronotype & syncScore on user doc) :contentReference[oaicite:6]{index=6}
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const profile = userDoc.data() || {}

        // 2) Try computed/enhancedSync if you decide to persist it
        let chronotype: ChronotypeData | undefined = profile.chronotype
        if (!chronotype || !chronotype.chronotype) {
          const enhRef = doc(db, 'users', user.uid, 'computed', 'enhancedSync')
          const enhDoc = await getDoc(enhRef)
          if (enhDoc.exists()) {
            const enh = enhDoc.data() as any
            chronotype = enh?.chronotype || chronotype
            if (typeof enh?.syncScore === 'number') {
              chronotype = { ...(chronotype||{ chronotype: 'Bear' }), syncScore: enh.syncScore }
            }
          }
        }

        // 3) Fallback to surveys/chronotype (will lightly re-calc sync if needed) :contentReference[oaicite:7]{index=7}
        if (!chronotype || !chronotype.chronotype) {
          const surveyRef = doc(db, 'users', user.uid, 'surveys', 'chronotype')
          const surveyDoc = await getDoc(surveyRef)
          if (surveyDoc.exists()) {
            const s = surveyDoc.data() as any
            const responses = s?.responses || {}
            const ct = responses?.chronotype || 'Bear'
            const bed = responses?.bedtime
            const wake = responses?.wakeTime
            const sch = responses?.schoolStart || responses?.workStart
            const dur = (bed && wake) ? (()=> {
              const [bh,bm]=(bed||'0:0').split(':').map(Number)
              const [wh,wm]=(wake||'0:0').split(':').map(Number)
              let hours = wh - bh + (wm - (bm||0))/60
              if (hours < 0) hours += 24
              return Math.round(hours*10)/10
            })() : undefined
            chronotype = { chronotype: ct, bedtime: bed, wakeTime: wake, schoolStartTime: sch, sleepDuration: dur }
            chronotype.syncScore = fallbackSync(chronotype)
            chronotype.outOfSync = Math.round((100 - (chronotype.syncScore||50))/10)
          }
        }

        // Cognitive: prefer onboardingAssessment doc; otherwise estimate from game collections :contentReference[oaicite:8]{index=8}:contentReference[oaicite:9]{index=9}:contentReference[oaicite:10]{index=10}
        let cognitiveProfile: CognitiveProfile | undefined
        const onboardingQ = query(
          collection(db, 'users', user.uid, 'cognitivePerformance'),
          where('type', '==', 'onboardingAssessment'),
          orderBy('completedAt', 'desc'),
          limit(1)
        )
        const onboardingSnap = await getDocs(onboardingQ)

        if (!onboardingSnap.empty) {
          const stages = (onboardingSnap.docs[0].data() as any).stages || {}
          cognitiveProfile = {
            processingSpeed: stages['processing-speed'] ? {
              score: stages['processing-speed'].score || 0,
              accuracy: stages['processing-speed'].accuracy || 0,
              averageReactionTime: stages['processing-speed'].averageReactionTime || 0,
              percentile: estimatePercentile(stages['processing-speed'].score || 0, 40)
            } : undefined,
            workingMemory: stages['working-memory'] ? {
              maxLevel: stages['working-memory'].finalLevel || stages['working-memory'].maxLevel || 0,
              accuracy: stages['working-memory'].accuracy || 0,
              percentile: estimatePercentile(stages['working-memory'].finalLevel || stages['working-memory'].maxLevel || 0, 8)
            } : undefined,
            attention: stages['attention'] ? {
              accuracy: stages['attention'].accuracy || 0,
              maxRound: stages['attention'].maxRound || 0,
              percentile: estimatePercentile(stages['attention'].accuracy || 0, 100)
            } : undefined,
            // If you have a problem-solving stage in onboarding, it will show up:
            problemSolving: stages['problem-solving'] ? {
              winRate: stages['problem-solving'].winRate || 0,
              finalDifficulty: stages['problem-solving'].finalDifficulty || 0,
              percentile: estimatePercentile(stages['problem-solving'].winRate || 0, 100)
            } : undefined
          }
        } else {
          // No onboarding doc found — estimate from recent sessions across your game collections :contentReference[oaicite:11]{index=11}
          const sources = [
            'brainBattleSessions',
            'memoryMatchSessions',
            'soundMatchSessions',
            'ultimateTTTSessions',
            'gameSessionsDetailed'
          ]
          const since = Date.now() - 7*24*60*60*1000
          let psScore = 0, psAcc = 0, psN = 0, psRT = 0
          let wmLvl = 0, wmAcc = 0, wmN = 0
          let attAcc = 0, attRound = 0, attN = 0
          let psMax = 40, wmMax = 8 // heuristic caps for percentile mapping

          for (const src of sources) {
            const q = query(
              collection(db, 'users', user.uid, src),
              orderBy('timestamp', 'desc'),
              limit(100)
            )
            const snap = await getDocs(q)
            snap.forEach(d => {
              const v:any = d.data()
              const ts = typeof v.timestamp?.toMillis === 'function' ? v.timestamp.toMillis() : (typeof v.timestamp==='number'?v.timestamp:Date.now())
              if (ts < since) return

              // Heuristic mapping by known fields from your onboarding tests:contentReference[oaicite:12]{index=12}
              if (src.includes('memory')) {
                if (typeof v.finalLevel === 'number') { wmLvl = Math.max(wmLvl, v.finalLevel) }
                if (typeof v.accuracy === 'number') { wmAcc += v.accuracy; wmN++ }
              }
              if (src.includes('sound') || (v.domain && v.domain === 'attention')) {
                if (typeof v.accuracy === 'number') { attAcc += v.accuracy; attN++ }
                if (typeof v.maxRound === 'number') { attRound = Math.max(attRound, v.maxRound) }
              }
              if (src.includes('brainBattle') || (v.domain && v.domain === 'processingSpeed')) {
                if (typeof v.score === 'number') { psScore = Math.max(psScore, v.score) }
                if (typeof v.accuracy === 'number') { psAcc += v.accuracy; psN++ }
                if (typeof v.averageReactionTime === 'number') { psRT = psRT ? (psRT+v.averageReactionTime)/2 : v.averageReactionTime }
              }
            })
          }

          cognitiveProfile = {
            processingSpeed: (psScore || psAcc || psRT) ? {
              score: psScore,
              accuracy: psN ? psAcc/psN : 0,
              averageReactionTime: psRT || 0,
              percentile: estimatePercentile(psScore, psMax)
            } : undefined,
            workingMemory: (wmLvl || wmAcc) ? {
              maxLevel: wmLvl,
              accuracy: wmN ? wmAcc/wmN : 0,
              percentile: estimatePercentile(wmLvl, wmMax)
            } : undefined,
            attention: (attAcc || attRound) ? {
              accuracy: attN ? attAcc/attN : 0,
              maxRound: attRound,
              percentile: estimatePercentile(attN ? attAcc/attN : 0, 100)
            } : undefined
          }
        }

        const finalChrono: ChronotypeData = chronotype || { chronotype: 'Bear', syncScore: 50, outOfSync: 5 }
        if (typeof finalChrono.outOfSync !== 'number' && typeof finalChrono.syncScore === 'number') {
          finalChrono.outOfSync = Math.round((100 - finalChrono.syncScore)/10)
        }

        setUserData({
          name: profile.displayName || profile.name || user.displayName || 'Student',
          email: user.email || undefined,
          chronotype: finalChrono,
          syncScore: finalChrono.syncScore,
          cognitiveProfile
        })
      } catch (err) {
        console.error('WelcomeResults load error:', err)
        setUserData({ name: 'Student', chronotype: { chronotype:'Unknown', syncScore:50, outOfSync:5 }, syncScore:50 })
      } finally {
        setLoading(false)
      }
    })
    return ()=>unsub()
  }, [router])

  // Loading
  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-lg">Analyzing your results...</p>
        </motion.div>
      </main>
    )
  }
  if (!userData) return null

  const overallCognitive = userData.cognitiveProfile ? calculateOverallCognitiveScore(userData.cognitiveProfile) : 0
  const syncScore = userData.syncScore ?? userData.chronotype?.syncScore ?? 0

  // Render
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
            Congratulations on Completing Your Initial Assessment!
          </h1>
          <p className="text-xl text-blue-200">Hi {userData.name}, here are your personalized results</p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Chronotype */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="text-center">
              <div className="text-5xl mb-3">{getChronotypeEmoji(userData.chronotype?.chronotype || 'Bear')}</div>
              <h3 className="text-xl font-bold mb-2">Your Chronotype</h3>
              <div className="text-2xl font-bold text-blue-300 mb-2">{userData.chronotype?.chronotype || 'Bear'}</div>
            </div>
          </motion.div>

          {/* Sync Score */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold mb-2">Your Sync Score</h3>
              <div className="text-3xl font-bold text-yellow-300 mb-2">{syncScore}/100</div>
              <p className="text-sm text-yellow-200">{getSyncScoreMessage(syncScore)}</p>
            </div>
          </motion.div>

          {/* Cognitive Score */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="text-center">
              <Brain className="w-12 h-12 text-purple-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold mb-2">Cognitive Score</h3>
              <div className="text-3xl font-bold text-purple-300 mb-2">{overallCognitive}th</div>
              <p className="text-sm text-purple-200">Estimated percentile across 4 domains</p>
            </div>
          </motion.div>
        </div>

        {/* Help Section */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.0 }} className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm rounded-2xl p-8 border border-white/20 mb-12">
          <h2 className="text-3xl font-bold text-center mb-10 flex items-center justify-center gap-3 text-white">
            <Zap className="w-8 h-8 text-yellow-400" /> How We Can Help You
          </h2>
          <AnimatedHelpBlocks />
        </motion.div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.2 }} className="text-center">
          <h3 className="text-2xl font-bold mb-6">Ready to Begin?</h3>
          <button
            onClick={() => router.push('/Prep/AboutMePage')}
            className="bg-gradient-to-r from-green-500 via-teal-500 to-blue-600 hover:from-green-400 hover:via-teal-400 hover:to-blue-500 text-white px-10 py-4 rounded-full font-semibold text-lg shadow-lg transition-all hover:scale-110"
          >
            🌟 Continue to Your Dashboard
          </button>
        </motion.div>
      </div>
    </main>
  )
}
