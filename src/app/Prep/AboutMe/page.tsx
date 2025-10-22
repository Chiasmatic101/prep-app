'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { doc, getDoc, addDoc, collection, setDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { TrendingUp, Brain, Target, Zap, BarChart, Activity, CheckCircle, Moon } from 'lucide-react'
import { calculateEnhancedSyncScore, type CognitiveSession, type SleepEntry } from '../../../utils/enhancedsyncScoreCalculator'
import LearningTimeline from '../../../components/LearningTimeline'

// Import the separated modal components
import NutritionModal from '../../../components/AboutMeModals/NutritionModal'
import ActivityModal from '../../../components/AboutMeModals/ActivityModal'
import SleepModal from '../../../components/AboutMeModals/SleepModal'
import ActiveChallengesStrip from '../../../components/AboutMeModals/ActiveChallengesStrip'

// Challenge-related type definitions
interface ChallengeProgress {
  challengeId: string
  startDate: string
  isActive: boolean
  currentDay: number
  totalDays: number
  dailyProgress: { [day: number]: boolean }
  targetValue?: string
  points: number
  completedDays: number
  notes?: string[]
}

interface UserChallengeData {
  activeChallenges: ChallengeProgress[]
  completedChallenges: ChallengeProgress[]
  totalPoints: number
  streaks: { [challengeId: string]: number }
}

// Updated UserData interface for AboutMe page to match Firebase structure
interface UserData {
  name: string
  email: string
  age?: number
  chronotype?: {
    chronotype: string
    outOfSync: number
    responses: Record<string, string>  // Complete survey responses
    timestamp: string
    syncScore?: number
  }
  syncScore?: number
  learningPhase?: number
  alignmentScores?: {
    school: number
    study: number
  }
}

interface EnhancedSyncData {
  syncScore: number
  schoolAlignment: number
  studyAlignment: number
  learningPhase: number
  adaptiveComponents: {
    observedAlignment: { school: number; study: number }
    predictedAlignment: { school: number; study: number }
    adaptationLevel: number
    domainReliability: Record<string, number>
  }
  sleepMetrics: {
    averageQuality: number
    consistency: number
    duration: number
  }
  learningTimeline: number[]
  chronotype: { chronotype: string; outOfSync: number }
}

interface DietEntry {
  time: string
  type: 'Light' | 'Medium' | 'Heavy'
  description?: string
}

interface HydrationEntry {
  time: string
  type: 'Water' | 'Coffee' | 'Tea' | 'Energy Drink' | 'Soda'
  amount: number
  caffeineContent?: number
}

interface ActivityEntry {
  time: string
  type: 'Light' | 'Medium' | 'Intense'
  activity: string
  duration: number
}

interface SleepEntryForm {
  bedTime: string
  wakeTime: string
  date: string
  wakingEvents?: number
}

// Complete mapping function for AboutMe page
const mapSurveyResponsesToQuizFormat = (surveyResponses: Record<string, string>) => {
  // Helper function to map natural wake time
  const mapNaturalWake = (response: string): 'Before 8 AM' | '8–10 AM' | 'After 10 AM' => {
    if (response === 'Before 8 AM') return 'Before 8 AM'
    if (response === '8–10 AM') return '8–10 AM'
    if (response === 'After 10 AM') return 'After 10 AM'
    // Fallback mapping from older survey format
    if (response.includes('Before 6') || response.includes('6–7') || response.includes('6–8')) return 'Before 8 AM'
    if (response.includes('7–8') || response.includes('8–10')) return '8–10 AM'
    return 'After 10 AM'
  }

  // Helper function to map focus time
  const mapFocusTime = (response: string): 'Morning' | 'Afternoon' | 'Evening' => {
    if (response === 'Morning') return 'Morning'
    if (response === 'Afternoon') return 'Afternoon'
    if (response === 'Evening') return 'Evening'
    // Fallback for older survey
    if (response === 'Late Night') return 'Evening'
    return 'Afternoon' // Default
  }

  // Helper function to map test time preference
  const mapTestTime = (response: string): 'Morning' | 'Midday' | 'Evening' => {
    if (response === 'Morning') return 'Morning'
    if (response === 'Midday') return 'Midday'
    if (response === 'Evening') return 'Evening'
    return 'Midday' // Default
  }

  // Helper function to map school start time
  const mapSchoolStart = (response: string): 'Before 7:30 AM' | '7:30–8:00 AM' | 'After 8:00 AM' => {
    if (response === 'Before 7:30 AM' || response.includes('Before 7')) return 'Before 7:30 AM'
    if (response === '7:30–8:00 AM' || response.includes('7:30–8:00') || response.includes('7–8')) return '7:30–8:00 AM'
    if (response === 'After 8:00 AM' || response.includes('After 8') || response.includes('8–9') || response.includes('After 9')) return 'After 8:00 AM'
    return '7:30–8:00 AM' // Default
  }

  // Helper function to map homework time
  const mapHomeworkTime = (response: string): 'Right after school' | 'After dinner' | 'Late at night' | 'Depends' => {
    if (response === 'Right after school') return 'Right after school'
    if (response === 'After dinner') return 'After dinner'
    if (response === 'Late at night') return 'Late at night'
    if (response === 'Depends') return 'Depends'
    
    // Map based on best study time if homework time is missing
    const bestStudyTime = surveyResponses.bestStudyTime
    if (bestStudyTime === 'Early morning' || bestStudyTime === 'Late morning') return 'Right after school'
    if (bestStudyTime === 'Afternoon') return 'Right after school'
    if (bestStudyTime === 'Evening') return 'After dinner'
    
    return 'After dinner' // Default
  }

  // Helper function to map wake school time
  const mapWakeSchool = (response: string): 'Before 6 AM' | '6–6:59 AM' | '7–7:59 AM' | '8 AM or later' => {
    if (response === 'Before 6 AM' || response.includes('Before 6')) return 'Before 6 AM'
    if (response === '6–6:59 AM' || response.includes('6–6:59')) return '6–6:59 AM'
    if (response === '7–7:59 AM' || response.includes('7–7:59')) return '7–7:59 AM'
    if (response === '8 AM or later' || response.includes('8 AM or later')) return '8 AM or later'
    return '7–7:59 AM' // Default
  }

  // Helper function to map morning feeling
  const mapWakeFeel = (response: string): 'Wide awake' | 'A bit slow' | 'Super groggy' => {
    if (response === 'Wide awake' || response === 'Very alert') return 'Wide awake'
    if (response === 'A bit slow' || response === 'Somewhat alert') return 'A bit slow'
    if (response === 'Super groggy' || response === 'Very tired' || response === 'Somewhat sleepy' || response === 'Very sleepy') return 'Super groggy'
    return 'A bit slow' // Default
  }

  // Helper function to map weekend bedtime
  const mapBedWeekend = (response: string): 'Before 10 PM' | '10 PM–Midnight' | 'After Midnight' => {
    if (response === 'Before 10 PM' || response.includes('Before 10')) return 'Before 10 PM'
    if (response === '10 PM–Midnight' || response.includes('10 PM–Midnight') || response.includes('10–11')) return '10 PM–Midnight'
    if (response === 'After Midnight' || response.includes('After Midnight') || response.includes('After 11')) return 'After Midnight'
    return '10 PM–Midnight' // Default
  }

  // Helper function to map home time
  const mapHomeTime = (response: string): 'Before 3:30 PM' | '3:30–4:30 PM' | 'After 4:30 PM' => {
    if (response === 'Before 3:30 PM' || response.includes('Before 3')) return 'Before 3:30 PM'
    if (response === '3:30–4:30 PM' || response.includes('3:30–4:30') || response.includes('3–4')) return '3:30–4:30 PM'
    if (response === 'After 4:30 PM' || response.includes('After 4:30') || response.includes('After 4')) return 'After 4:30 PM'
    return '3:30–4:30 PM' // Default
  }

  // Helper function to map extra time
  const mapExtraTime = (response: string): 'Before 4 PM' | '4–6 PM' | 'After 6 PM' | 'Varies' => {
    if (response === 'Before 4 PM') return 'Before 4 PM'
    if (response === '4–6 PM') return '4–6 PM'
    if (response === 'After 6 PM') return 'After 6 PM'
    if (response === 'Varies') return 'Varies'
    
    // Infer from after-school academic programs
    const afterSchoolAcademics = surveyResponses.afterSchoolAcademics || surveyResponses.extras
    if (afterSchoolAcademics === 'Yes, every day' || afterSchoolAcademics !== 'None') return 'After 6 PM'
    if (afterSchoolAcademics === 'Yes, occasionally') return 'Varies'
    
    return 'Varies' // Default
  }

  // Helper function to map extras
  const mapExtras = (response: string): 'AoPS' | 'RSM' | 'Kumon' | 'Other' | 'None' => {
    if (response === 'AoPS') return 'AoPS'
    if (response === 'RSM') return 'RSM'
    if (response === 'Kumon') return 'Kumon'
    if (response === 'Other') return 'Other'
    if (response === 'None') return 'None'
    
    // Map from afterSchoolAcademics if extras is missing
    const afterSchoolAcademics = surveyResponses.afterSchoolAcademics
    if (afterSchoolAcademics === 'No') return 'None'
    if (afterSchoolAcademics?.includes('Yes')) return 'Other'
    
    return 'None' // Default
  }

  // Return the mapped quiz format responses
  return {
    // Core chronotype questions (required by sync calculator)
    naturalWake: mapNaturalWake(surveyResponses.naturalWake || surveyResponses.idealWakeTime || ''),
    focusTime: mapFocusTime(surveyResponses.focusTime || surveyResponses.alertTime || ''),
    testTime: mapTestTime(surveyResponses.testTime || surveyResponses.bestMentalTime || ''),
    schoolStart: mapSchoolStart(surveyResponses.schoolStart || ''),
    homeworkTime: mapHomeworkTime(surveyResponses.homeworkTime || ''),
    
    // School schedule details (required by sync calculator)
    wakeSchool: mapWakeSchool(surveyResponses.wakeSchool || surveyResponses.schoolWake || ''),
    wakeFeel: mapWakeFeel(surveyResponses.wakeFeel || surveyResponses.morningFeel || surveyResponses.alertnessSchool || ''),
    bedWeekend: mapBedWeekend(surveyResponses.bedWeekend || surveyResponses.weekendSleep || ''),
    homeTime: mapHomeTime(surveyResponses.homeTime || surveyResponses.schoolEnd || ''),
    extraTime: mapExtraTime(surveyResponses.extraTime || ''),
    extras: mapExtras(surveyResponses.extras || ''),
    
    // Additional fields that enhance the calculation
    weekendWake: surveyResponses.weekendWake || 'After 10 AM',
    bestStudyTime: surveyResponses.bestStudyTime || 'Afternoon',
    concentrationTime: surveyResponses.concentrationTime || 'Afternoon (12 PM–5 PM)',
    memoryTime: surveyResponses.memoryTime || 'Morning',
    homeworkDuration: surveyResponses.homeworkDuration || '1–2 hours',
    studyBreaks: surveyResponses.studyBreaks || 'Every 45–60 minutes',
    mealTimes: surveyResponses.mealTimes || '6–7 PM',
    screenTime: surveyResponses.screenTime || '1 hour before bed'
  }
}

// Main Component
export default function AboutMePage() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [cognitiveData, setCognitiveData] = useState<CognitiveSession[]>([])
  const [sleepData, setSleepData] = useState<SleepEntry[]>([])
  const [enhancedSyncData, setEnhancedSyncData] = useState<EnhancedSyncData | null>(null)
  const [challengeData, setChallengeData] = useState<UserChallengeData>({
    activeChallenges: [],
    completedChallenges: [],
    totalPoints: 0,
    streaks: {}
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [nutritionModalOpen, setNutritionModalOpen] = useState(false)
  const [sleepModalOpen, setSleepModalOpen] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const router = useRouter()

  // Fetch functions
  const fetchCognitiveData = async (userId: string) => {
    try {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
      const cognitiveQuery = query(
        collection(db, 'users', userId, 'cognitivePerformance'),
        where('timestamp', '>=', sevenDaysAgo),
        orderBy('timestamp', 'desc'),
        limit(200)
      )
      
      const cognitiveSnapshot = await getDocs(cognitiveQuery)
      const sessions: CognitiveSession[] = cognitiveSnapshot.docs.map(doc => doc.data() as CognitiveSession)
      
      setCognitiveData(sessions)
      return sessions
    } catch (error) {
      console.error('Error fetching cognitive data:', error)
      return []
    }
  }

  const fetchChallengeData = async (userId: string) => {
    try {
      const challengeDoc = await getDoc(doc(db, 'users', userId, 'challenges', 'shifting'))
      if (challengeDoc.exists()) {
        setChallengeData(challengeDoc.data() as UserChallengeData)
      }
    } catch (error) {
      console.error('Error fetching challenge data:', error)
    }
  }

  const fetchSleepData = async (userId: string) => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const sleepQuery = query(
        collection(db, 'users', userId, 'sleepEntries'),
        orderBy('date', 'desc'),
        limit(30)
      )
      
      const sleepSnapshot = await getDocs(sleepQuery)
      const entries: SleepEntry[] = sleepSnapshot.docs.map(doc => ({
        ...doc.data(),
        date: doc.id
      } as SleepEntry))
      
      setSleepData(entries)
      return entries
    } catch (error) {
      console.error('Error fetching sleep data:', error)
      return []
    }
  }

  // Handle functions
  const handleLogProgress = async (challengeId: string, success: boolean) => {
    if (!auth.currentUser || !challengeData) return

    const challengeIndex = challengeData.activeChallenges.findIndex(c => c.challengeId === challengeId)
    if (challengeIndex === -1) return

    const updatedChallenges = [...challengeData.activeChallenges]
    const challenge = updatedChallenges[challengeIndex]

    challenge.dailyProgress[challenge.currentDay] = success
    if (success) {
      challenge.completedDays += 1
      challenge.points += 50 // base points for challenge
    }

    challenge.currentDay += 1

    if (challenge.currentDay > challenge.totalDays) {
      challenge.isActive = false
      
      const updatedData = {
        ...challengeData,
        activeChallenges: updatedChallenges.filter(c => c.challengeId !== challengeId),
        completedChallenges: [...challengeData.completedChallenges, challenge],
        totalPoints: challengeData.totalPoints + challenge.points
      }
      setChallengeData(updatedData)
    } else {
      const updatedData = {
        ...challengeData,
        activeChallenges: updatedChallenges
      }
      setChallengeData(updatedData)
    }

    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'challenges', 'shifting'), 
        challenge.currentDay > challenge.totalDays ? 
        {
          ...challengeData,
          activeChallenges: updatedChallenges.filter(c => c.challengeId !== challengeId),
          completedChallenges: [...challengeData.completedChallenges, challenge],
          totalPoints: challengeData.totalPoints + challenge.points
        } : 
        {
          ...challengeData,
          activeChallenges: updatedChallenges
        }
      )
      
      setSaveSuccess(`Challenge progress logged!`)
      setTimeout(() => setSaveSuccess(''), 2000)
    } catch (error) {
      console.error('Error logging progress:', error)
      setError('Failed to log progress')
    }
  }

  const handleSaveNutrition = async (data: { meals: DietEntry[], hydration: HydrationEntry[], date: string }) => {
    try {
      if (auth.currentUser) {
        const totalCaffeine = data.hydration.reduce((total, entry) => total + (entry.caffeineContent || 0), 0)
        const totalFluids = data.hydration.reduce((total, entry) => total + entry.amount, 0)
        const mealCount = data.meals.length

        const nutritionEntry = {
          ...data,
          timestamp: new Date(),
          totalCaffeine,
          totalFluids,
          mealCount
        }

        await setDoc(doc(db, 'users', auth.currentUser.uid, 'nutritionEntries', data.date), nutritionEntry)
        
        setSaveSuccess(`Nutrition entry saved: ${mealCount} meals, ${data.hydration.length} beverages`)
        setTimeout(() => setSaveSuccess(''), 3000)
      }
    } catch (error) {
      console.error('Error saving nutrition entry:', error)
      setError('Failed to save nutrition entry')
    }
  }

  const handleSaveActivity = async (data: ActivityEntry) => {
    try {
      if (auth.currentUser) {
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'activityEntries'), {
          ...data,
          timestamp: new Date(),
          date: new Date().toISOString().split('T')[0]
        })
        setSaveSuccess('Activity entry saved successfully')
        setTimeout(() => setSaveSuccess(''), 3000)
      }
    } catch (error) {
      console.error('Error saving activity entry:', error)
      setError('Failed to save activity entry')
    }
  }

  const handleSaveSleep = async (data: SleepEntryForm) => {
    try {
      if (auth.currentUser) {
        const calculateSleepDurationObject = (bedTime: string, wakeTime: string, date: string, wakingEvents?: number) => {
          const bedDateTime = new Date(`${date}T${bedTime}`)
          let wakeDateTime = new Date(`${date}T${wakeTime}`)
          
          if (wakeDateTime <= bedDateTime) {
            wakeDateTime.setDate(wakeDateTime.getDate() + 1)
          }
          
          const diffMs = wakeDateTime.getTime() - bedDateTime.getTime()
          const hours = Math.floor(diffMs / (1000 * 60 * 60))
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
          
          return { 
            hours, 
            minutes, 
            totalMinutes: Math.floor(diffMs / (1000 * 60))
          }
        }

        const sleepDuration = calculateSleepDurationObject(data.bedTime, data.wakeTime, data.date, data.wakingEvents)
        
        // Calculate sleep quality score
        const totalHours = sleepDuration.totalMinutes / 60
        const w_dur = 0.7, w_wake = 0.3, alpha = 0.10
        const f_dur = Math.min(totalHours / 7.5, 1.0)
        const f_wake = Math.max(Math.min(1 - alpha * (data.wakingEvents || 0), 1), 0)
        const sleepQualityScore = Math.round(100 * (w_dur * f_dur + w_wake * f_wake))

        await setDoc(doc(db, 'users', auth.currentUser.uid, 'sleepEntries', data.date), {
          ...data,
          timestamp: new Date(),
          sleepDuration,
          sleepQualityScore
        })
        
        setSaveSuccess('Sleep entry saved successfully')
        setTimeout(() => setSaveSuccess(''), 3000)
        
        // Refresh sleep data and recalculate sync score
        const updatedSleepData = await fetchSleepData(auth.currentUser.uid)
        if (userData?.chronotype?.responses) {
          const mappedResponses = mapSurveyResponsesToQuizFormat(userData.chronotype.responses)
          const enhancedData = calculateEnhancedSyncScore(
            mappedResponses,
            cognitiveData,
            updatedSleepData
          )
          setEnhancedSyncData(enhancedData)
        }

      }
    } catch (error) {
      console.error('Error saving sleep entry:', error)
      setError('Failed to save sleep entry')
    }
  }

  // Helper functions
  const getChronotypeEmoji = (chronotype: string) => {
    switch (chronotype) {
      case 'Lion': return '🦁'
      case 'Bear': return '🐻'
      case 'Wolf': return '🐺'
      case 'Dolphin': return '🐬'
      default: return '🧠'
    }
  }

  const getSyncScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getAlignmentColor = (score: number) => {
    if (score >= 75) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatTime = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.floor((hours % 1) * 60)
    return `${h}:${String(m).padStart(2, '0')}`
  }

  const getChronotypeDescription = (chronotype: string, isYoungerStudent = false) => {
    if (isYoungerStudent) {
      switch (chronotype) {
        case 'Lion': return 'Early risers who are most productive in the morning. Natural leaders who prefer to wake up early and get things done.'
        case 'Bear': return 'Follow the solar cycle and are most productive during the day. They make up about 55% of the population.'
        case 'Wolf': return 'Night owls who are most creative and productive in the evening. They prefer to sleep in and stay up late.'
        case 'Dolphin': return 'Light sleepers with erratic routines who struggle with traditional schedules. Highly intelligent and cautious.'
        default: return 'Your unique sleep and energy patterns that help us understand when you learn best.'
      }
    } else {
      switch (chronotype) {
        case 'Lion': return 'Early chronotypes with peak cognitive performance in morning hours. Natural tendency toward leadership and structured scheduling.'
        case 'Bear': return 'Solar-aligned chronotypes following natural circadian rhythms. Peak productivity during standard daylight hours.'
        case 'Wolf': return 'Evening chronotypes with enhanced creativity during late hours. Optimal performance in afternoon and evening periods.'
        case 'Dolphin': return 'Variable chronotypes with sensitive sleep patterns. Highly analytical with irregular but intense focus periods.'
        default: return 'Individual circadian patterns that influence optimal performance timing.'
      }
    }
  }

  // Usage in AboutMe page useEffect:
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserData
            setUserData(userData)
            
            const [cognitiveData, sleepData] = await Promise.all([
              fetchCognitiveData(user.uid),
              fetchSleepData(user.uid),
              fetchChallengeData(user.uid)
            ])
            
            // Use chronotype.responses with comprehensive mapping
            if (userData.chronotype?.responses) {
              try {
                const mappedResponses = mapSurveyResponsesToQuizFormat(userData.chronotype.responses)
                
                const enhancedData = calculateEnhancedSyncScore(
                  mappedResponses,
                  cognitiveData,
                  sleepData
                )
                setEnhancedSyncData(enhancedData)
              } catch (error) {
                console.error('Error calculating enhanced sync score:', error)
                // Fallback to stored chronotype data
                setEnhancedSyncData({
                  syncScore: userData.chronotype.syncScore || userData.syncScore || 0,
                  schoolAlignment: userData.alignmentScores?.school || 0,
                  studyAlignment: userData.alignmentScores?.study || 0,
                  learningPhase: userData.learningPhase || 12,
                  chronotype: { 
                    chronotype: userData.chronotype.chronotype, 
                    outOfSync: userData.chronotype.outOfSync 
                  },
                  adaptiveComponents: {
                    observedAlignment: { school: 0, study: 0 },
                    predictedAlignment: { school: 0, study: 0 },
                    adaptationLevel: 0,
                    domainReliability: {}
                  },
                  sleepMetrics: { averageQuality: 0, consistency: 0, duration: 0 },
                  learningTimeline: []
                })
              }
            }
          } else {
            setError('User profile not found')
          }
        } catch (err) {
          console.error('Error fetching user data:', err)
          setError('Failed to load profile')
        }
      } else {
        router.push('/auth')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Loading your enhanced profile...</p>
        </motion.div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-white p-10 rounded-2xl shadow-xl max-w-md"
        >
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.push('/auth')}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-full font-medium transition"
          >
            Go to Login
          </button>
        </motion.div>
      </main>
    )
  }

  if (!userData) return null

  const displayData = enhancedSyncData || {
    syncScore: userData.syncScore || 0,
    schoolAlignment: userData.alignmentScores?.school || 0,
    studyAlignment: userData.alignmentScores?.study || 0,
    learningPhase: userData.learningPhase || 12,
    chronotype: userData.chronotype || { chronotype: 'Bear', outOfSync: 0 },
    adaptiveComponents: {
      observedAlignment: { school: 0, study: 0 },
      predictedAlignment: { school: 0, study: 0 },
      adaptationLevel: 0,
      domainReliability: {}
    },
    sleepMetrics: {
      averageQuality: 0,
      consistency: 0,
      duration: 0
    },
    learningTimeline: []
  }

  const hasReliableData = enhancedSyncData && enhancedSyncData.adaptiveComponents.adaptationLevel > 0.2
  const cognitiveDataPoints = Object.values(enhancedSyncData?.adaptiveComponents.domainReliability || {})
    .reduce((sum, r) => sum + (r > 0 ? 1 : 0), 0)

  return (
    <main className="min-h-screen font-sans bg-gradient-to-br from-yellow-50 to-pink-100 text-gray-900 px-6 py-16">
      <div className="max-w-4xl mx-auto">
        {/* Success Message */}
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg z-50"
          >
            {saveSuccess}
          </motion.div>
        )}

        {/* Navigation Links */}
        <div className="mb-6">
          <div className="flex gap-4 flex-wrap">
            <Link
              href="/Prep/Insights"
              className="inline-flex items-center gap-2 text-purple-700 hover:text-purple-800 hover:underline"
            >
              <span>🔭</span>
              Insights (Shift Plan)
            </Link>
            
            <Link
              href="/sleep-quality"
              className="inline-flex items-center gap-2 text-purple-700 hover:text-purple-800 hover:underline"
            >
              <span>🌙</span>
              Sleep Quality Score
            </Link>
          </div>
        </div>

        {/* Active Challenges Strip */}
        {challengeData && challengeData.activeChallenges.length > 0 && (
          <ActiveChallengesStrip
            activeChallenges={challengeData.activeChallenges}
            onLogProgress={handleLogProgress}
            onViewAllChallenges={() => router.push('/shifting-challenges')}
          />
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Hi <span className="text-pink-500">{userData.name}</span> 👋
          </h1>
          <p className="text-lg text-gray-700">Your personalized learning profile</p>
        </motion.div>

        {/* Enhanced Main Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          {userData.chronotype?.responses ? (
            <div className="text-center">
              <div className="bg-green-50/80 border border-green-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-800">Complete Assessment Available</span>
                </div>
                <p className="text-green-700 text-sm">
                  Based on {Object.keys(userData.chronotype.responses).length} survey responses including chronotype, 
                  schedule, and study preferences.
                </p>
              </div>

              <div className="text-6xl mb-4">
                {getChronotypeEmoji(displayData.chronotype.chronotype)}
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {displayData.chronotype.chronotype} Chronotype
              </h2>
              <p className="text-gray-600 mb-6">
                {getChronotypeDescription(displayData.chronotype.chronotype)}
              </p>

              {/* Building Profile section */}
              {!hasReliableData && (
                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-800">Building Your Personalized Profile</span>
                  </div>
                  <p className="text-blue-700 text-sm mb-3">
                    Using your comprehensive survey responses as baseline. Play cognitive games and track sleep for even more personalized insights.
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="font-medium text-blue-800 mb-1">Survey Data Available:</div>
                      <div className="space-y-1">
                        {userData.chronotype.responses.naturalWake && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span>Natural chronotype</span>
                          </div>
                        )}
                        {userData.chronotype.responses.schoolStart && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span>School schedule</span>
                          </div>
                        )}
                        {userData.chronotype.responses.homeworkTime && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span>Study preferences</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-blue-800 mb-1">Additional Data:</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 ${cognitiveDataPoints > 0 ? 'bg-green-400' : 'bg-gray-300'} rounded-full`}></div>
                          <span>Cognitive games: {cognitiveDataPoints}/5</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 ${sleepData.length > 0 ? 'bg-green-400' : 'bg-gray-300'} rounded-full`}></div>
                          <span>Sleep entries: {sleepData.length}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 ${hasReliableData ? 'bg-green-400' : 'bg-yellow-400'} rounded-full`}></div>
                          <span>Adaptation: {Math.round((enhancedSyncData?.adaptiveComponents.adaptationLevel || 0) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Sync Score Display */}
              <div className={`rounded-xl p-6 border-2 mb-6 ${getSyncScoreColor(displayData.syncScore)}`}>
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <TrendingUp className="w-6 h-6" />
                    <h3 className="text-xl font-bold">
                      {hasReliableData ? 'Adaptive' : 'Predicted'} Sync Score
                    </h3>
                  </div>
                  <div className="text-4xl font-bold mb-2">{displayData.syncScore}/100</div>
                  <div className="text-sm font-medium mb-4">
                    {displayData.syncScore >= 80 ? 'Excellent Schedule Alignment' :
                     displayData.syncScore >= 60 ? 'Good Schedule Alignment' :
                     displayData.syncScore >= 40 ? 'Moderate Schedule Alignment' : 'Schedule Needs Optimization'}
                  </div>
                </div>
                
                {/* Alignment Breakdown */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/50 rounded-lg p-4">
                    <div className={`text-2xl font-bold ${getAlignmentColor(displayData.schoolAlignment)}`}>
                      {displayData.schoolAlignment}%
                    </div>
                    <div className="text-sm text-gray-600">School Schedule Alignment</div>
                    <div className="text-xs text-gray-500">How well your school hours match your natural rhythm</div>
                  </div>
                  <div className="bg-white/50 rounded-lg p-4">
                    <div className={`text-2xl font-bold ${getAlignmentColor(displayData.studyAlignment)}`}>
                      {displayData.studyAlignment}%
                    </div>
                    <div className="text-sm text-gray-600">Study Time Alignment</div>
                    <div className="text-xs text-gray-500">How well your study schedule matches your peak focus</div>
                  </div>
                </div>
                
                {/* Peak Learning Time */}
                <div className="bg-purple-100/80 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Brain className="w-5 h-5 text-purple-700" />
                    <span className="font-semibold text-purple-700">Peak Learning Time</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-800">
                    {formatTime(displayData.learningPhase)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Based on your {hasReliableData ? 'observed performance' : 'chronotype assessment'}
                  </div>
                </div>

                {/* Sleep Metrics (if available) */}
                {enhancedSyncData && enhancedSyncData.sleepMetrics.averageQuality > 0 && (
                  <div className="bg-indigo-50/80 rounded-lg p-4">
                    <h4 className="font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      Sleep Quality Metrics
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-indigo-700">{Math.round(enhancedSyncData.sleepMetrics.averageQuality)}/100</div>
                        <div className="text-xs text-gray-600">Quality</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-indigo-700">{Math.round(enhancedSyncData.sleepMetrics.consistency)}%</div>
                        <div className="text-xs text-gray-600">Consistency</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-indigo-700">{enhancedSyncData.sleepMetrics.duration.toFixed(1)}h</div>
                        <div className="text-xs text-gray-600">Duration</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Performance vs Prediction Comparison */}
              {hasReliableData && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-100 rounded-xl p-4 border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Observed Performance
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>During School:</span>
                        <span className="font-bold">{Math.round(enhancedSyncData.adaptiveComponents.observedAlignment.school * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>During Study:</span>
                        <span className="font-bold">{Math.round(enhancedSyncData.adaptiveComponents.observedAlignment.study * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-100 rounded-xl p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Chronotype Prediction
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>During School:</span>
                        <span className="font-bold">{Math.round(enhancedSyncData.adaptiveComponents.predictedAlignment.school * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>During Study:</span>
                        <span className="font-bold">{Math.round(enhancedSyncData.adaptiveComponents.predictedAlignment.study * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Recommendations */}       
              {displayData.syncScore < 70 && userData.chronotype?.responses && (
                <div className="bg-blue-50/80 rounded-lg p-4 text-left">
                  <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Personalized Recommendations
                  </h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    {displayData.schoolAlignment < 50 && (
                      <div>• Focus on evening review sessions to reinforce learning when your natural rhythm conflicts with school hours</div>
                    )}
                    {displayData.studyAlignment < 50 && (
                      <div>• Try shifting homework time closer to {formatTime(displayData.learningPhase)} for better focus</div>
                    )}
                    {userData.chronotype.responses.wakeFeel === 'Super groggy' && (
                      <div>• Consider a gradual wake-up routine with light exposure to ease morning grogginess</div>
                    )}
                    {userData.chronotype.responses.bedWeekend === 'After Midnight' && userData.chronotype.responses.wakeSchool?.includes('Before 7') && (
                      <div>• Large weekend sleep-in periods may be disrupting your weekday rhythm - try to keep weekend wake times within 1-2 hours of weekdays</div>
                    )}
                    {userData.chronotype.responses.homeworkTime === 'Late at night' && userData.chronotype.responses.focusTime !== 'Evening' && (
                      <div>• Your late-night homework schedule may not match your natural focus time - consider moving study sessions earlier</div>
                    )}
                    {userData.chronotype.responses.concentrationTime && !userData.chronotype.responses.concentrationTime.includes(userData.chronotype.responses.homeworkTime || '') && (
                      <div>• Your study time doesn't align with when you concentrate best - try scheduling homework during your peak concentration window</div>
                    )}
                    <div>• Maintain consistent sleep-wake times to strengthen your natural circadian rhythm</div>
                    {!hasReliableData && (
                      <div>• Play cognitive games throughout the day to build your personalized performance profile</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🧠</div>
              <h2 className="text-2xl font-bold text-gray-700 mb-4">Complete Assessment Required</h2>
              <p className="text-gray-600 mb-6">Take our comprehensive chronotype and learning assessment to unlock personalized insights</p>
              <button
                onClick={() => router.push('/chronotype-quiz')}
                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105"
              >
                Start Complete Assessment
              </button>
            </div>
          )}
        </motion.div>

        {/* Update the LearningTimeline component usage condition */}
        {userData.chronotype?.responses && displayData && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-8"
          >
            <LearningTimeline
              learningPhase={displayData.learningPhase}
              responses={mapSurveyResponsesToQuizFormat(userData.chronotype.responses)}
              syncScore={displayData.syncScore}
              alignmentScores={{
                school: displayData.schoolAlignment,
                study: displayData.studyAlignment
              }}
            />
          </motion.div>
        )}

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Survey data summary in profile details */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-white/40 backdrop-blur-sm rounded-xl p-6 border border-white/40 shadow-lg"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              📊 Profile Data
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium text-sm">{userData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Age:</span>
                <span className="font-medium">{userData.age} years old</span>
              </div>
              {userData.chronotype?.responses && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Survey Questions:</span>
                    <span className="font-medium text-sm">{Object.keys(userData.chronotype.responses).length} completed</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Assessment Date:</span>
                    <span className="font-medium text-sm">
                      {new Date(userData.chronotype.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Cognitive Sessions:</span>
                <span className="font-medium text-sm">{cognitiveData.length} sessions</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sleep Entries:</span>
                <span className="font-medium text-sm">{sleepData.length} nights</span>
              </div>
            </div>
          </motion.div>

          {/* Chronotype Details */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-gradient-to-br from-purple-50 to-blue-100 rounded-xl p-6 border border-purple-200 shadow-lg"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              🧠 Chronotype Details
            </h3>
            <div className="space-y-3">
              {userData.chronotype?.responses ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium flex items-center text-sm">
                      {getChronotypeEmoji(displayData.chronotype.chronotype)} {displayData.chronotype.chronotype}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sync Score:</span>
                    <span className={`font-medium text-sm ${getSyncScoreColor(displayData.syncScore).split(' ')[0]}`}>
                      {displayData.syncScore}/100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Adaptation:</span>
                    <span className="font-medium text-sm">
                      {Math.round((enhancedSyncData?.adaptiveComponents.adaptationLevel || 0) * 100)}%
                    </span>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => router.push('/Prep/MyBrain')}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      View Details
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-2">
                  <p className="text-gray-600 text-sm mb-3">Complete your assessment</p>
                  <button
                    onClick={() => router.push('/chronotype-quiz')}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full text-xs font-medium transition"
                  >
                    Start Assessment
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Lifestyle Tracking */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="bg-gradient-to-br from-green-50 to-blue-100 rounded-xl p-6 border border-green-200 shadow-lg"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              🌱 Lifestyle Tracking
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setNutritionModalOpen(true)}
                className="w-full bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1"
              >
                🍽️ Nutrition & Hydration
              </button>

              <button
                onClick={() => setActivityModalOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1"
              >
                🏃 Activity
              </button>
              <button
                onClick={() => setSleepModalOpen(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1"
              >
                🌙 Sleep
              </button>
            </div>
          </motion.div>
        </div>

        {/* Domain Reliability Display */}
        {hasReliableData && enhancedSyncData?.adaptiveComponents?.domainReliability && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
          >
            <h3 className="text-2xl font-bold text-purple-700 mb-6 text-center flex items-center justify-center gap-2">
              <Target className="w-6 h-6" />
              Cognitive Domain Reliability
            </h3>
            
            {(() => {
              try {
                const domainReliability = enhancedSyncData?.adaptiveComponents?.domainReliability;
                
                if (!domainReliability || typeof domainReliability !== 'object') {
                  return (
                    <div className="text-center text-gray-500 py-8">
                      <p>Domain reliability data is being calculated...</p>
                    </div>
                  );
                }
                
                const domains = Object.entries(domainReliability);
                
                if (domains.length === 0) {
                  return (
                    <div className="text-center text-gray-500 py-8">
                      <p>No cognitive domains tracked yet. Play more games to see reliability metrics.</p>
                    </div>
                  );
                }
                
                // Dynamic grid based on number of domains
                const gridClass = domains.length <= 3 ? 'grid-cols-1 md:grid-cols-3' : 
                                 domains.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : 
                                 'grid-cols-2 md:grid-cols-5';
                
                return (
                  <div className={`grid ${gridClass} gap-4`}>
                    {domains.map(([domain, reliability]) => (
                      <div key={domain} className="text-center bg-white/50 rounded-xl p-4">
                        <div className="text-sm text-gray-600 mb-2 capitalize font-medium">
                          {domain.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className={`text-2xl font-bold mb-2 ${
                          reliability > 0.5 ? 'text-green-600' : 
                          reliability > 0.2 ? 'text-yellow-600' : 
                          'text-red-600'
                        }`}>
                          {Math.round((reliability || 0) * 100)}%
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              reliability > 0.5 ? 'bg-green-500' : 
                              reliability > 0.2 ? 'bg-yellow-500' : 
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.max((reliability || 0) * 100, 5)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {reliability > 0.5 ? 'High confidence' : 
                           reliability > 0.2 ? 'Building data' : 
                           'Need more data'}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              } catch (error) {
                console.error('Error rendering domain reliability:', error);
                return (
                  <div className="text-center text-red-500 py-8">
                    <p>Error loading domain reliability data</p>
                  </div>
                );
              }
            })()}
            
            <div className="text-center mt-6">
              <p className="text-sm text-gray-600">
                Reliability indicates how confident we are in your personalized performance patterns for each cognitive domain
              </p>
            </div>
          </motion.div>
        )}

        {/* Academic Performance Enhancement Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          <h3 className="text-2xl font-bold text-purple-700 mb-6 text-center">
            🎯 Academic Performance Enhancement
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cognitive Preparation Card */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-100 rounded-xl p-6 border border-blue-200 hover:shadow-lg transition-all hover:scale-105 cursor-pointer group">
              <div className="text-center">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📚</div>
                <h4 className="text-xl font-bold text-blue-700 mb-3">Cognitive Preparation</h4>
                <p className="text-blue-600 text-sm mb-4">
                  Optimize your cognitive state before studying with evidence-based techniques
                </p>
                <button 
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all"
                  onClick={() => router.push('/Prep/BrainWarmup')}
                >
                  Prepare for Study Session
                </button>
              </div>
            </div>

            {/* Exam Preparation Card */}
            <div className="bg-gradient-to-br from-orange-50 to-yellow-100 rounded-xl p-6 border border-orange-200 hover:shadow-lg transition-all hover:scale-105 cursor-pointer group">
              <div className="text-center">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📋</div>
                <h4 className="text-xl font-bold text-orange-700 mb-3">Exam Preparation</h4>
                <p className="text-orange-600 text-sm mb-4">
                  Enhance memory consolidation and review strategies for effective preparation
                </p>
                <button className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all">
                  View Study Strategies
                </button>
              </div>
            </div>

            {/* Exam Performance Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-6 border border-green-200 hover:shadow-lg transition-all hover:scale-105 cursor-pointer group">
              <div className="text-center">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎯</div>
                <h4 className="text-xl font-bold text-green-700 mb-3">Exam Performance</h4>
                <p className="text-green-600 text-sm mb-4">
                  Maximize focus, recall, and mental clarity during test-taking
                </p>
                <button className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all">
                  Optimize Performance
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="text-center space-y-4"
        >
          <div className="space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105"
            >
              📈 Analytics Dashboard
            </button>
            <button
              onClick={() => router.push('/chronotype-quiz')}
              className="bg-white/50 backdrop-blur-sm hover:bg-white/70 text-purple-700 px-8 py-3 rounded-full font-semibold border border-purple-300 transition-all hover:scale-105"
            >
              🔄 Reassess Profile
            </button>
          </div>
          <p className="text-gray-600 text-sm">
            {hasReliableData 
              ? 'Personalized recommendations based on your unique cognitive performance patterns' 
              : 'Evidence-based recommendations tailored to your circadian preferences and cognitive patterns'
            }
          </p>
        </motion.div>

        {/* Lifestyle Tracking Modals */}
        <NutritionModal
          isOpen={nutritionModalOpen} 
          onClose={() => setNutritionModalOpen(false)} 
          onSave={handleSaveNutrition} 
        />

        <ActivityModal 
          isOpen={activityModalOpen} 
          onClose={() => setActivityModalOpen(false)} 
          onSave={handleSaveActivity} 
        />

        <SleepModal 
          isOpen={sleepModalOpen} 
          onClose={() => setSleepModalOpen(false)} 
          onSave={handleSaveSleep} 
        />
      </div>
    </main>
  )
}