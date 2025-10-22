'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Brain, TrendingUp, CheckCircle, Star, Zap } from 'lucide-react'
import { db, auth } from '@/firebase/config'
import { doc, getDoc, getDocs, query, collection, orderBy, limit, where } from 'firebase/firestore'

// Simple chronotype determination from survey responses
const determineChronotype = (responses: Record<string, any>): string => {
  const animal = responses.animalType || ''
  if (animal.includes('Lion')) return 'Lion'
  if (animal.includes('Wolf')) return 'Wolf'
  if (animal.includes('Dolphin')) return 'Dolphin'
  return 'Bear'
}

// Simple sync score calculation
const calculateSimpleSyncScore = (responses: Record<string, any>): number => {
  let score = 50 // Start at baseline
  
  // Natural wake vs school wake alignment
  const naturalWake = responses.naturalWake || ''
  const wakeSchool = responses.wakeSchool || ''
  
  if (naturalWake === 'Before 8 AM' && wakeSchool === 'Before 6 AM') score += 15
  else if (naturalWake === 'Before 8 AM' && wakeSchool === '6-6:59 AM') score += 10
  else if (naturalWake === '8-10 AM' && wakeSchool === '7-7:59 AM') score += 10
  else if (naturalWake === 'After 10 AM' && wakeSchool === '8 AM or later') score += 10
  else score -= 10
  
  // Focus time vs school schedule
  const focusTime = responses.focusTime || ''
  const schoolStart = responses.schoolStart || ''
  
  if (focusTime === 'Morning' && schoolStart !== 'After 8:00 AM') score += 10
  else if (focusTime === 'Afternoon') score += 5
  else if (focusTime === 'Evening') score -= 10
  
  // Best study time vs homework time alignment
  const bestStudyTime = responses.bestStudyTime || ''
  const homeworkTime = responses.homeworkTime || ''
  
  if (bestStudyTime.includes('morning') && homeworkTime === 'Right after school') score += 10
  else if (bestStudyTime.includes('Afternoon') && homeworkTime === 'Right after school') score += 10
  else if (bestStudyTime.includes('Evening') && homeworkTime === 'After dinner') score += 10
  else if (bestStudyTime.includes('Evening') && homeworkTime === 'Late at night') score += 5
  else score -= 5
  
  // Morning alertness
  const morningFeel = responses.morningFeel || responses.wakeFeel || responses.alertnessSchool || ''
  if (morningFeel.includes('Wide awake') || morningFeel.includes('Very alert')) score += 10
  else if (morningFeel.includes('groggy') || morningFeel.includes('sleepy')) score -= 10
  
  // Weekend sleep consistency
  const bedWeekend = responses.bedWeekend || responses.weekendSleep || ''
  if (bedWeekend === 'Before 10 PM') score += 5
  else if (bedWeekend === 'After Midnight') score -= 5
  
  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)))
}

// Simple cognitive score estimation
const estimateCognitiveScore = (cogProfile: any): number => {
  if (!cogProfile) return 0
  
  const scores: number[] = []
  
  // Processing Speed: score out of ~30-40 correct hits in 45 seconds
  if (cogProfile.processingSpeed?.score) {
    const normalizedPS = Math.min((cogProfile.processingSpeed.score / 35) * 100, 100)
    scores.push(normalizedPS)
  }
  
  // Working Memory: level reached (typically 3-8)
  if (cogProfile.workingMemory?.maxLevel) {
    const normalizedWM = Math.min(((cogProfile.workingMemory.maxLevel - 2) / 6) * 100, 100)
    scores.push(normalizedWM)
  }
  
  // Attention: accuracy percentage
  if (cogProfile.attention?.accuracy) {
    scores.push(cogProfile.attention.accuracy)
  }
  
  // Problem Solving: win rate percentage
  if (cogProfile.problemSolving?.winRate) {
    scores.push(cogProfile.problemSolving.winRate)
  }
  
  if (scores.length === 0) return 0
  
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

const getChronotypeEmoji = (c: string) => ({ 
  Lion: '🦁', 
  Bear: '🐻', 
  Wolf: '🐺', 
  Dolphin: '🐬' 
}[c] || '🧠')

const getSyncScoreMessage = (score: number) => {
  if (score >= 80) return 'Excellent alignment with your natural rhythm!'
  if (score >= 60) return 'Good alignment — room for optimization'
  if (score >= 40) return 'Moderate alignment — improvement possible'
  return 'Poor alignment — major improvement opportunities'
}

function AnimatedHelpBlocks() {
  const [activeIndex, setActiveIndex] = useState(0)
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
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % sections.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch">
      {sections.map((section, i) => (
        <motion.div
          key={i}
          animate={{ 
            opacity: activeIndex === i ? 1 : 0.3, 
            scale: activeIndex === i ? 1.05 : 1, 
            y: activeIndex === i ? 0 : 20 
          }}
          transition={{ duration: 0.8 }}
          className={`bg-gradient-to-br ${section.color} rounded-2xl p-6 w-full text-center border border-white/20 shadow-lg`}
        >
          <h3 className="text-xl font-bold mb-4 flex items-center justify-center gap-2 text-white">
            {section.icon}{section.title}
          </h3>
          <div className="space-y-3">
            {section.tips.map((tip, idx) => (
              <p key={idx} className="text-blue-100 text-sm leading-snug">{tip}</p>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default function SimplifiedWelcomeResultsPage() {
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const profile = userDoc.data() || {}

        console.log('📋 Profile data:', {
          hasChronotype: !!profile.chronotype,
          chronotypeKeys: profile.chronotype ? Object.keys(profile.chronotype) : [],
          responsesCount: profile.chronotype?.responses ? Object.keys(profile.chronotype.responses).length : 0,
          animalType: profile.chronotype?.responses?.animalType
        })

        // Get chronotype data with survey responses
        let chronotype = 'Bear'
        let syncScore = 50
        let responses = {}

        if (profile.chronotype?.responses) {
          responses = profile.chronotype.responses
          console.log('✅ Found responses:', {
            totalQuestions: Object.keys(responses).length,
            animalType: responses.animalType,
            naturalWake: responses.naturalWake,
            focusTime: responses.focusTime
          })
          chronotype = determineChronotype(responses)
          syncScore = calculateSimpleSyncScore(responses)
          console.log('🎯 Calculated:', { chronotype, syncScore })
        } else {
          console.log('❌ No responses found in profile.chronotype.responses')
        }

        // Get cognitive profile from onboarding assessment
        let cognitiveProfile: any = {}
        
        try {
          // Get the most recent onboarding assessment
          const onboardingQuery = query(
            collection(db, 'users', user.uid, 'cognitivePerformance'),
            orderBy('startedAt', 'desc'),
            limit(10)
          )
          const onboardingSnap = await getDocs(onboardingQuery)

         const onboardingDoc = onboardingSnap.docs.find(doc => {
  const data = doc.data()
  const type = data.summary?.type || data.type  // support both
  return type === 'onboardingAssessment' && data.completed === true
})

          
          if (onboardingDoc) {
            const stages = onboardingDoc.data().stages || {}
            console.log('🧠 Found completed onboarding assessment:', {
              hasStages: Object.keys(stages).length > 0,
              stageKeys: Object.keys(stages)
            })
            
            // Processing Speed Test
            if (stages['processing-speed']) {
              const psData = stages['processing-speed']
              cognitiveProfile.processingSpeed = {
                score: psData.correctHits || 0, // Use correctHits, not score
                accuracy: psData.accuracy || 0,
                averageReactionTime: psData.averageReactionTime || 0,
                totalSymbols: psData.totalSymbols || 0
              }
              console.log('⚡ Processing Speed:', cognitiveProfile.processingSpeed)
            }
            
            // Working Memory Test
            if (stages['working-memory']) {
              const wmData = stages['working-memory']
              cognitiveProfile.workingMemory = {
                maxLevel: wmData.finalLevel || wmData.maxLevel || 0,
                accuracy: wmData.accuracy || 0,
                correctSequences: wmData.correctSequences || 0,
                totalAttempts: wmData.totalAttempts || 0
              }
              console.log('🧩 Working Memory:', cognitiveProfile.workingMemory)
            }
            
            // Attention Test
            if (stages['attention']) {
              const attData = stages['attention']
              cognitiveProfile.attention = {
                accuracy: attData.accuracy || 0,
                maxRound: attData.maxRound || 0,
                correctRounds: attData.correctRounds || 0,
                totalRounds: attData.totalRounds || 0
              }
              console.log('👁️ Attention:', cognitiveProfile.attention)
            }
            
            // Problem Solving Test
            if (stages['problem-solving']) {
              const psData = stages['problem-solving']
              cognitiveProfile.problemSolving = {
                winRate: psData.winRate || 0,
                finalDifficulty: psData.finalDifficulty || 0,
                wins: psData.wins || 0,
                totalGames: psData.totalGames || 0,
                score: psData.score || 0
              }
              console.log('🎯 Problem Solving:', cognitiveProfile.problemSolving)
            }
          } else {
            console.log('❌ No completed onboarding assessment found')
          }
        } catch (cogError) {
          console.log('⚠️ Cognitive data fetch error:', cogError.message)
        }

        // Fallback to recent game data if no onboarding assessment
        if (Object.keys(cognitiveProfile).length === 0) {
          try {
            const gameSources = ['brainBattleSessions', 'memoryMatchSessions', 'soundMatchSessions']
            
            for (const source of gameSources) {
              const gameQuery = query(
                collection(db, 'users', user.uid, source),
                orderBy('timestamp', 'desc'),
                limit(10)
              )
              const gameSnap = await getDocs(gameQuery)
              
              gameSnap.forEach(doc => {
                const data = doc.data()
                
                if (source.includes('memory')) {
                  if (!cognitiveProfile.workingMemory) cognitiveProfile.workingMemory = { maxLevel: 0, accuracy: 0 }
                  if (data.finalLevel) cognitiveProfile.workingMemory.maxLevel = Math.max(cognitiveProfile.workingMemory.maxLevel, data.finalLevel)
                  if (data.accuracy) cognitiveProfile.workingMemory.accuracy = Math.max(cognitiveProfile.workingMemory.accuracy, data.accuracy)
                }
                
                if (source.includes('sound')) {
                  if (!cognitiveProfile.attention) cognitiveProfile.attention = { accuracy: 0, maxRound: 0 }
                  if (data.accuracy) cognitiveProfile.attention.accuracy = Math.max(cognitiveProfile.attention.accuracy, data.accuracy)
                  if (data.maxRound) cognitiveProfile.attention.maxRound = Math.max(cognitiveProfile.attention.maxRound, data.maxRound)
                }
                
                if (source.includes('brainBattle')) {
                  if (!cognitiveProfile.processingSpeed) cognitiveProfile.processingSpeed = { score: 0, accuracy: 0 }
                  if (data.score) cognitiveProfile.processingSpeed.score = Math.max(cognitiveProfile.processingSpeed.score, data.score)
                  if (data.accuracy) cognitiveProfile.processingSpeed.accuracy = Math.max(cognitiveProfile.processingSpeed.accuracy, data.accuracy)
                }
              })
            }
          } catch (gameError) {
            console.log('⚠️ Game data fetch skipped:', gameError.message)
          }
        }

        setUserData({
          name: profile.displayName || profile.name || user.displayName || 'Student',
          chronotype,
          syncScore,
          cognitiveProfile
        })

      } catch (error) {
        console.error('Error loading data:', error)
        setUserData({
          name: 'Student',
          chronotype: 'Bear',
          syncScore: 50,
          cognitiveProfile: {}
        })
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-lg">Loading your results...</p>
        </motion.div>
      </main>
    )
  }

  if (!userData) {
    return null
  }

  const cognitiveScore = estimateCognitiveScore(userData.cognitiveProfile)

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8 }} 
          className="text-center mb-12"
        >
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
            Assessment Complete!
          </h1>
          <p className="text-xl text-blue-200">Hi {userData.name}, here are your initial results</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6, delay: 0.1 }} 
          className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-blue-300/30 rounded-2xl p-6 mb-8 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-400/30 flex items-center justify-center">
              <span className="text-lg">ℹ️</span>
            </div>
            <h3 className="text-xl font-bold text-blue-100">Initial Assessment Results</h3>
          </div>
          <p className="text-blue-200 text-sm md:text-base max-w-2xl mx-auto">
            These scores are <span className="font-semibold text-blue-100">estimates based on your survey responses</span>. 
            Continue to your dashboard to track real data, play brain games, and get 
            <span className="font-semibold text-blue-100"> personalized insights</span> that improve over time!
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.6, delay: 0.2 }} 
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
          >
            <div className="text-center">
              <div className="text-5xl mb-3">{getChronotypeEmoji(userData.chronotype)}</div>
              <h3 className="text-xl font-bold mb-2">Your Chronotype</h3>
              <div className="text-2xl font-bold text-blue-300 mb-2">{userData.chronotype}</div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.6, delay: 0.4 }} 
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
          >
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold mb-2">Sync Score</h3>
              <div className="text-3xl font-bold text-yellow-300 mb-2">{userData.syncScore}/100</div>
              <p className="text-sm text-yellow-200">{getSyncScoreMessage(userData.syncScore)}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.6, delay: 0.6 }} 
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 relative"
          >
            <div className="absolute top-2 right-2">
              <div className="bg-yellow-500/80 text-white text-xs px-2 py-1 rounded-full font-medium">
                Estimate
              </div>
            </div>
            
            <div className="text-center">
              <Brain className="w-12 h-12 text-purple-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold mb-2">Cognitive Score</h3>
              <div className="text-3xl font-bold text-purple-300 mb-2">
                {cognitiveScore}
                <span className="text-lg">/100</span>
              </div>
              <p className="text-sm text-purple-200">
                {cognitiveScore > 0 
                  ? `Based on ${Object.keys(userData.cognitiveProfile).length} test${Object.keys(userData.cognitiveProfile).length > 1 ? 's' : ''}`
                  : 'Complete games to see your score'}
              </p>
              
              {Object.keys(userData.cognitiveProfile).length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {userData.cognitiveProfile.processingSpeed && (
                    <div className="bg-blue-500/20 rounded-lg p-2">
                      <div className="font-medium text-blue-200">Speed</div>
                      <div className="text-blue-100">
                        {userData.cognitiveProfile.processingSpeed.score} hits
                      </div>
                      <div className="text-blue-200 text-[10px]">
                        {Math.round(userData.cognitiveProfile.processingSpeed.accuracy)}% acc
                      </div>
                    </div>
                  )}
                  {userData.cognitiveProfile.workingMemory && (
                    <div className="bg-purple-500/20 rounded-lg p-2">
                      <div className="font-medium text-purple-200">Memory</div>
                      <div className="text-purple-100">
                        Level {userData.cognitiveProfile.workingMemory.maxLevel}
                      </div>
                      <div className="text-purple-200 text-[10px]">
                        {Math.round(userData.cognitiveProfile.workingMemory.accuracy)}% acc
                      </div>
                    </div>
                  )}
                  {userData.cognitiveProfile.attention && (
                    <div className="bg-green-500/20 rounded-lg p-2">
                      <div className="font-medium text-green-200">Attention</div>
                      <div className="text-green-100">
                        {Math.round(userData.cognitiveProfile.attention.accuracy)}% acc
                      </div>
                      <div className="text-green-200 text-[10px]">
                        Round {userData.cognitiveProfile.attention.maxRound}
                      </div>
                    </div>
                  )}
                  {userData.cognitiveProfile.problemSolving && (
                    <div className="bg-orange-500/20 rounded-lg p-2">
                      <div className="font-medium text-orange-200">Strategy</div>
                      <div className="text-orange-100">
                        {Math.round(userData.cognitiveProfile.problemSolving.winRate)}% wins
                      </div>
                      <div className="text-orange-200 text-[10px]">
                        Level {userData.cognitiveProfile.problemSolving.finalDifficulty}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8, delay: 1.0 }} 
          className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm rounded-2xl p-8 border border-white/20 mb-12"
        >
          <h2 className="text-3xl font-bold text-center mb-10 flex items-center justify-center gap-3 text-white">
            <Zap className="w-8 h-8 text-yellow-400" /> How We Can Help You
          </h2>
          <AnimatedHelpBlocks />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8, delay: 1.2 }} 
          className="text-center"
        >
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