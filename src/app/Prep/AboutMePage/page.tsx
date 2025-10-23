'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { doc, getDoc, addDoc, collection, setDoc, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import {
  Mail, Send, TrendingUp, TrendingDown, AlertTriangle,
  Brain, Target, Moon, CheckCircle, XCircle, Star,
  Zap, HelpCircle, ChevronUp, ChevronDown, User, ActivitySquare, Utensils, Plus,
  Play, Trophy, Calendar, BarChart
} from 'lucide-react'

import { presenceService } from '../../../services/presenceService'
import FriendsList from '../../../components/FriendsList'

// Calculator imports
import { calculateEnhancedSyncScore, type CognitiveSession, type SleepEntry, type LifestyleFactor } from '../../../utils/enhancedsyncScoreCalculator'

// Feedback and Tour imports
import { useFeedbackAnalysis } from '../../../services/feedbackDataService'
import LifestyleFeedbackComponent from '../../../components/LifestyleFeedbackComponent'
import AppTour from '../../../components/ShepherdTour'
import TrackDayTour from '../../../components/TrackDayTour'
import BrainTrainingTour from '../../../components/BrainTrainingTour'

// Modal imports
import NutritionModal from '../../../components/AboutMeModals/NutritionModal'
import ActivityModal from '../../../components/AboutMeModals/ActivityModal'
import SleepModal from '../../../components/AboutMeModals/SleepModal'
import ActiveChallengesStrip from '../../../components/AboutMeModals/ActiveChallengesStrip'

// NEW: Challenge tracking imports
import { InteractiveChallengeModal } from '../../../components/InteractiveChallengeModals'
import { ChallengeProgressTracker } from '../../../components/ChallengeProgressTracker'
import { ChallengeOverviewDashboard } from '../../../components/ChallengeOverviewDashboard'
import { WeekendDriftTracker } from '../../../components/WeekendDriftTracker'
import { MemoryLadderTracker, AttentionUptickTracker } from '../../../components/CognitiveProgressTrackers'

// Type definitions
interface ChallengeProgress {
  challengeId: string
  startDate: string
  isActive: boolean
  currentDay: number
  totalDays: number
  dailyProgress: { [day: number]: boolean }
  targetValue?: string
  weekdayAverage?: string
  points: number
  completedDays: number
  notes?: string[]
  plan?: any // For shifting challenges
  autoTracking?: {
    enabled: boolean
    lastChecked: Date
    consecutiveSuccesses: number
  }
}

interface UserChallengeData {
  activeChallenges: ChallengeProgress[]
  completedChallenges: ChallengeProgress[]
  totalPoints: number
  streaks: { [challengeId: string]: number }
}

interface UserData {
  name: string
  email: string
  age?: number
  chronotype?: {
    chronotype: string
    outOfSync: number
    responses: Record<string, string>
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
  learningTimeline: Array<{
    time: number
    label: string
    performance: number
    activity: string
  }>
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

// Survey response mapping function
const mapSurveyResponsesToQuizFormat = (surveyResponses: Record<string, string>) => {
  const mapNaturalWake = (response: string): 'Before 8 AM' | '8–10 AM' | 'After 10 AM' => {
    if (response === 'Before 8 AM') return 'Before 8 AM'
    if (response === '8–10 AM') return '8–10 AM'
    if (response === 'After 10 AM') return 'After 10 AM'
    if (response.includes('Before 6') || response.includes('6–7') || response.includes('6–8')) return 'Before 8 AM'
    if (response.includes('7–8') || response.includes('8-10')) return '8–10 AM'
    return 'After 10 AM'
  }

  const mapFocusTime = (response: string): 'Morning' | 'Afternoon' | 'Evening' => {
    if (response === 'Morning') return 'Morning'
    if (response === 'Afternoon') return 'Afternoon'
    if (response === 'Evening') return 'Evening'
    if (response === 'Late Night') return 'Evening'
    return 'Afternoon'
  }

  const mapTestTime = (response: string): 'Morning' | 'Midday' | 'Evening' => {
    if (response === 'Morning') return 'Morning'
    if (response === 'Midday') return 'Midday'
    if (response === 'Evening') return 'Evening'
    return 'Midday'
  }

  const mapSchoolStart = (response: string): 'Before 7:30 AM' | '7:30–8:00 AM' | 'After 8:00 AM' => {
    if (response === 'Before 7:30 AM' || response.includes('Before 7')) return 'Before 7:30 AM'
    if (response === '7:30–8:00 AM' || response.includes('7:30-8:00') || response.includes('7–8')) return '7:30–8:00 AM'
    if (response === 'After 8:00 AM' || response.includes('After 8') || response.includes('8–9') || response.includes('After 9')) return 'After 8:00 AM'
    return '7:30–8:00 AM'
  }

  const mapHomeworkTime = (response: string): 'Right after school' | 'After dinner' | 'Late at night' | 'Depends' => {
    if (response === 'Right after school') return 'Right after school'
    if (response === 'After dinner') return 'After dinner'
    if (response === 'Late at night') return 'Late at night'
    if (response === 'Depends') return 'Depends'
    
    const bestStudyTime = surveyResponses.bestStudyTime
    if (bestStudyTime === 'Early morning' || bestStudyTime === 'Late morning') return 'Right after school'
    if (bestStudyTime === 'Afternoon') return 'Right after school'
    if (bestStudyTime === 'Evening') return 'After dinner'
    
    return 'After dinner'
  }

  const mapWakeSchool = (response: string): 'Before 6 AM' | '6–6:59 AM' | '7–7:59 AM' | '8 AM or later' => {
    if (response === 'Before 6 AM' || response.includes('Before 6')) return 'Before 6 AM'
    if (response === '6–6:59 AM' || response.includes('6-6:59')) return '6–6:59 AM'
    if (response === '7–7:59 AM' || response.includes('7-7:59')) return '7–7:59 AM'
    if (response === '8 AM or later' || response.includes('8 AM or later')) return '8 AM or later'
    return '7–7:59 AM'
  }

  const mapWakeFeel = (response: string): 'Wide awake' | 'A bit slow' | 'Super groggy' => {
    if (response === 'Wide awake' || response === 'Very alert') return 'Wide awake'
    if (response === 'A bit slow' || response === 'Somewhat alert') return 'A bit slow'
    if (response === 'Super groggy' || response === 'Very tired' || response === 'Somewhat sleepy' || response === 'Very sleepy') return 'Super groggy'
    return 'A bit slow'
  }

  const mapBedWeekend = (response: string): 'Before 10 PM' | '10 PM–Midnight' | 'After Midnight' => {
    if (response === 'Before 10 PM' || response.includes('Before 10')) return 'Before 10 PM'
    if (response === '10 PM–Midnight' || response.includes('10 PM–Midnight') || response.includes('10–11')) return '10 PM–Midnight'
    if (response === 'After Midnight' || response.includes('After Midnight') || response.includes('After 11')) return 'After Midnight'
    return '10 PM–Midnight'
  }

  const mapHomeTime = (response: string): 'Before 3:30 PM' | '3:30–4:30 PM' | 'After 4:30 PM' => {
    if (response === 'Before 3:30 PM' || response.includes('Before 3')) return 'Before 3:30 PM'
    if (response === '3:30–4:30 PM' || response.includes('3:30–4:30') || response.includes('3–4')) return '3:30–4:30 PM'
    if (response === 'After 4:30 PM' || response.includes('After 4:30') || response.includes('After 4')) return 'After 4:30 PM'
    return '3:30–4:30 PM'
  }

  const mapExtraTime = (response: string): 'Before 4 PM' | '4–6 PM' | 'After 6 PM' | 'Varies' => {
    if (response === 'Before 4 PM') return 'Before 4 PM'
    if (response === '4–6 PM') return '4–6 PM'
    if (response === 'After 6 PM') return 'After 6 PM'
    if (response === 'Varies') return 'Varies'
    
    const afterSchoolAcademics = surveyResponses.afterSchoolAcademics || surveyResponses.extras
    if (afterSchoolAcademics === 'Yes, every day') return 'After 6 PM'
    if (afterSchoolAcademics === 'Yes, occasionally') return 'Varies'
    
    return 'Varies'
  }

  const mapExtras = (response: string): 'AoPS' | 'RSM' | 'Kumon' | 'Other' | 'None' => {
    if (response === 'AoPS') return 'AoPS'
    if (response === 'RSM') return 'RSM'
    if (response === 'Kumon') return 'Kumon'
    if (response === 'Other') return 'Other'
    if (response === 'None') return 'None'
    
    const afterSchoolAcademics = surveyResponses.afterSchoolAcademics
    if (afterSchoolAcademics === 'No') return 'None'
    if (afterSchoolAcademics?.includes('Yes')) return 'Other'
    
    return 'None'
  }

  return {
    naturalWake: mapNaturalWake(surveyResponses.naturalWake || surveyResponses.idealWakeTime || ''),
    focusTime: mapFocusTime(surveyResponses.focusTime || surveyResponses.alertTime || ''),
    testTime: mapTestTime(surveyResponses.testTime || surveyResponses.bestMentalTime || ''),
    schoolStart: mapSchoolStart(surveyResponses.schoolStart || ''),
    homeworkTime: mapHomeworkTime(surveyResponses.homeworkTime || ''),
    wakeSchool: mapWakeSchool(surveyResponses.wakeSchool || surveyResponses.schoolWake || ''),
    wakeFeel: mapWakeFeel(surveyResponses.wakeFeel || surveyResponses.morningFeel || surveyResponses.alertnessSchool || ''),
    bedWeekend: mapBedWeekend(surveyResponses.bedWeekend || surveyResponses.weekendSleep || ''),
    homeTime: mapHomeTime(surveyResponses.homeTime || surveyResponses.schoolEnd || ''),
    extraTime: mapExtraTime(surveyResponses.extraTime || ''),
    extras: mapExtras(surveyResponses.extras || ''),
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

export default function TeenFriendlyAboutMe() {
  const { feedbackData, loading: feedbackLoading, refreshFeedback } = useFeedbackAnalysis(auth.currentUser?.uid || null)
  const [lifestyleData, setLifestyleData] = useState<LifestyleFactor[]>([])
  const [feedbackExpanded, setFeedbackExpanded] = useState(false)
  const [syncCalculating, setSyncCalculating] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
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
  const [nutritionModalOpen, setNutritionModalOpen] = useState(false)
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [sleepModalOpen, setSleepModalOpen] = useState(false)
  const [learningTimelineOpen, setLearningTimelineOpen] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const router = useRouter()
   
  const [tourActive, setTourActive] = useState(false)
  const [trackTourActive, setTrackTourActive] = useState(false)
  const [brainTourActive, setBrainTourActive] = useState(false)

  // NEW: Challenge modal state
  const [activeChallengeModal, setActiveChallengeModal] = useState<string | null>(null)

  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedRefresh = () => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    refreshTimeoutRef.current = setTimeout(() => {
      refreshFeedback()
    }, 500)
  }

  // Tour control functions
  const startTour = () => {
    setActiveTab('profile')
    setTourActive(true)
  }

  const onTourComplete = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasSeenTour', 'true')
    }
    console.log('Tour completed!')
  }

  const checkIfNewUser = () => {
    if (typeof window !== 'undefined') {
      const hasSeenTour = localStorage.getItem('hasSeenTour')
      if (!hasSeenTour && userData) {
        setTimeout(() => {
          setTourActive(true)
          localStorage.setItem('hasSeenTour', 'true')
        }, 1500)
      }
    }
  }

  // Fetch cognitive data from all game collections
  const fetchCognitiveData = async (userId: string) => {
    try {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)

      const sources = [
        'cognitivePerformance',
        'brainBattleSessions',
        'memoryMatchSessions',
        'soundMatchSessions',
        'ultimateTTTSessions',
        'gameSessionsDetailed'
      ]

      const allSessions: CognitiveSession[] = []

      for (const source of sources) {
        const q = query(
          collection(db, 'users', userId, source),
          where('timestamp', '>=', sevenDaysAgo),
          orderBy('timestamp', 'desc'),
          limit(200)
        )
        const snapshot = await getDocs(q)

        snapshot.docs.forEach(docSnap => {
          const d: any = docSnap.data()

          const ts = (typeof d.timestamp?.toMillis === 'function')
            ? d.timestamp.toMillis()
            : (typeof d.timestamp === 'number' ? d.timestamp : Date.now())

          const hour =
            typeof d.hourOfDay === 'number'
              ? d.hourOfDay
              : new Date(ts).getHours() + new Date(ts).getMinutes() / 60

          const domain: CognitiveSession['domain'] =
            d.domain ??
            (d.gameType?.includes('memory') ? 'memory'
              : d.gameType?.includes('attention') ? 'attention'
              : d.gameType?.includes('problem') ? 'problemSolving'
              : d.gameType?.includes('recall') ? 'recall'
              : 'attention')

          const normalized =
            typeof d.normalizedScore === 'number'
              ? d.normalizedScore
              : (typeof d.score === 'number' ? d.score : 0)

          const raw =
            typeof d.rawScore === 'number'
              ? d.rawScore
              : (typeof d.scoreRaw === 'number' ? d.scoreRaw : 0)

          allSessions.push({
            timestamp: ts,
            hourOfDay: hour,
            domain,
            normalizedScore: normalized,
            rawScore: raw,
            gameType: d.gameType || source
          })
        })
      }

      setCognitiveData(allSessions)
      return allSessions
    } catch (err) {
      console.error('Error fetching cognitive data:', err)
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

  const collectLifestyleData = async (userId: string, sleepEntries: SleepEntry[]) => {
    try {
      const lifestyleFactors: LifestyleFactor[] = []

      sleepEntries.forEach(entry => {
        lifestyleFactors.push({
          type: 'sleep',
          timestamp: new Date(entry.date).getTime(),
          value: entry,
          metadata: { date: entry.date }
        })
      })

      const nutritionQuery = query(
        collection(db, 'users', userId, 'nutritionEntries'),
        orderBy('timestamp', 'desc'),
        limit(30)
      )
      const nutritionSnapshot = await getDocs(nutritionQuery)
      nutritionSnapshot.docs.forEach(doc => {
        const data = doc.data()
        lifestyleFactors.push({
          type: 'nutrition',
          timestamp: data.timestamp?.toMillis() || Date.now(),
          value: data,
          metadata: { date: data.date }
        })
      })

      const activityQuery = query(
        collection(db, 'users', userId, 'activityEntries'),
        orderBy('timestamp', 'desc'),
        limit(30)
      )
      const activitySnapshot = await getDocs(activityQuery)
      activitySnapshot.docs.forEach(doc => {
        const data = doc.data()
        lifestyleFactors.push({
          type: 'activity',
          timestamp: data.timestamp?.toMillis() || Date.now(),
          value: data,
          metadata: { date: data.date }
        })
      })

      setLifestyleData(lifestyleFactors)
    } catch (error) {
      console.error('Error collecting lifestyle data:', error)
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

      await collectLifestyleData(userId, entries)
      
      return entries
    } catch (error) {
      console.error('Error fetching sleep data:', error)
      return []
    }
  }

  // Handler functions
  const handleLogProgress = async (challengeId: string, success: boolean) => {
    if (!auth.currentUser || !challengeData) return

    const challengeIndex = challengeData.activeChallenges.findIndex(c => c.challengeId === challengeId)
    if (challengeIndex === -1) return

    const updatedChallenges = [...challengeData.activeChallenges]
    const challenge = updatedChallenges[challengeIndex]

    challenge.dailyProgress[challenge.currentDay] = success
    if (success) {
      challenge.completedDays += 1
      challenge.points += 50
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

  const handleSaveActivity = async (data: ActivityEntry) => {
    try {
      if (auth.currentUser) {
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'activityEntries'), {
          ...data,
          timestamp: new Date(),
          date: new Date().toISOString().split('T')[0]
        })
        setSaveSuccess('Activity logged successfully!')
        setTimeout(() => setSaveSuccess(''), 3000)
        setTimeout(() => refreshFeedback(), 1500)
      }
    } catch (error) {
      console.error('Error saving activity entry:', error)
      setError('Failed to save activity entry')
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
        
        setSaveSuccess(`Nutrition logged! ${mealCount} meals, ${data.hydration.length} drinks`)
        setTimeout(() => setSaveSuccess(''), 3000)
        setTimeout(() => refreshFeedback(), 2000)
      }
    } catch (error) {
      console.error('Error saving nutrition entry:', error)
      setError('Failed to save nutrition entry')
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
        
        const totalHours = sleepDuration.totalMinutes / 60
        const w_dur = 0.7, w_wake = 0.3, alpha = 0.10
        const f_dur = Math.min(totalHours / 7.5, 1.0)
        const f_wake = Math.max(Math.min(1 - alpha * (data.wakingEvents || 0), 1), 0)
        const sleepQualityScore = Math.round(100 * (w_dur * f_dur + w_wake * f_wake))

        await setDoc(
          doc(db, 'users', auth.currentUser.uid, 'sleepEntries', data.date),
          {
            ...data,
            timestamp: new Date(),
            sleepDuration,
            sleepQualityScore,
          }
        )

        setSaveSuccess('Sleep logged successfully!')
        setTimeout(() => setSaveSuccess(''), 3000)
        setTimeout(() => refreshFeedback(), 2000)

        const updatedSleepData = await fetchSleepData(auth.currentUser.uid)

        if (userData?.chronotype?.responses) {
          const mappedResponses = mapSurveyResponsesToQuizFormat(userData.chronotype.responses)
          const enhancedData = await calculateEnhancedSyncScore(
            mappedResponses,
            cognitiveData,
            updatedSleepData,
            lifestyleData,
            challengeData,
            userData
          )

          // After:
const transformedEnhancedData = {
  ...enhancedData,
  learningTimeline: enhancedData.learningTimeline.map((hour) => ({
    time: hour,
    label: `${hour}:00`,
    performance: hour >= 9 && hour <= 11 ? 90 : // Peak morning
                 hour >= 14 && hour <= 16 ? 85 : // Good afternoon
                 hour >= 19 && hour <= 21 ? 75 : // Evening
                 60, // Other times
    activity: hour < 12 ? 'Morning study' : hour < 18 ? 'Afternoon study' : 'Evening study'
  }))
};

setEnhancedSyncData(transformedEnhancedData);
          
          try {
            if (auth.currentUser) {
              const userId = auth.currentUser.uid

              await setDoc(
                doc(db, 'users', userId),
                {
                  chronotype: {
                    chronotype: enhancedData.chronotype.chronotype,
                    outOfSync: enhancedData.chronotype.outOfSync,
                    syncScore: enhancedData.syncScore,
                    lastUpdated: new Date(),
                    responses: userData.chronotype.responses
                  },
                  syncScore: enhancedData.syncScore,
                  schoolAlignment: enhancedData.schoolAlignment,
                  studyAlignment: enhancedData.studyAlignment,
                  learningPhase: enhancedData.learningPhase,
                  lastSyncUpdate: new Date(),
                  alignmentScores: {
                    school: enhancedData.schoolAlignment,
                    study: enhancedData.studyAlignment
                  }
                },
                { merge: true }
              )

              await setDoc(
                doc(db, 'users', userId, 'computed', 'enhancedSync'),
                {
                  ...enhancedData,
                  lastUpdated: new Date(),
                  cognitiveDataPoints: cognitiveData.length,
                  sleepDataPoints: sleepData.length
                },
                { merge: true }
              )

              await saveChronotypeHistory(
                userId,
                enhancedData.chronotype.chronotype,
                enhancedData.syncScore,
                enhancedData.chronotype.outOfSync
              )

              console.log('Enhanced Sync data saved successfully.')
            }
          } catch (err) {
            console.error('Error saving enhanced sync data:', err)
          }
        }
      }
    } catch (error) {
      console.error('Error saving sleep entry:', error)
      setError('Failed to save sleep entry')
    }
  }

  // Helper functions
  const getChronotypeEmoji = (chronotype: string) => {
    const emojis: Record<string, string> = {
      Lion: '🦁',
      Bear: '🐻',
      Wolf: '🐺',
      Dolphin: '🐬',
    }
    return emojis[chronotype] || '🧠'
  }

  const getSyncScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const formatTime = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.floor((hours % 1) * 60)
    return `${h}:${String(m).padStart(2, '0')}`
  }

  const generateLearningTimeline = (chronotype: string, learningPhase: number) => {
    const timeline = []
    for (let hour = 6; hour <= 23; hour++) {
      let performance = 50

      if (chronotype === 'Wolf') {
        if (hour <= 8) performance = 30 + (hour - 6) * 5
        else if (hour <= 12) performance = 45 + (hour - 8) * 5
        else if (hour <= 18) performance = 65 + (hour - 12) * 3
        else performance = Math.max(90 - (hour - 18) * 5, 40)
      } else if (chronotype === 'Lion') {
        if (hour <= 12) performance = 80 - (hour - 6) * 2
        else performance = Math.max(60 - (hour - 12) * 3, 30)
      } else {
        if (hour <= 10) performance = 40 + (hour - 6) * 7
        else if (hour <= 16) performance = 75 - (hour - 10) * 2
        else performance = Math.max(65 - (hour - 16) * 5, 35)
      }

      if (Math.abs(hour - learningPhase) <= 1) {
        performance = Math.min(performance + 15, 100)
      }

      const activities = {
        30: 'Low alertness',
        40: 'Light tasks',
        50: 'Building focus',
        60: 'Good for routine work',
        70: 'Active learning',
        80: 'Peak performance',
        90: 'Optimal learning'
      }

      timeline.push({
        time: hour,
        label: `${hour}:00`,
        performance: Math.round(performance),
        activity: activities[Math.floor(performance / 10) * 10] || 'Variable'
      })
    }
    return timeline
  }

  const saveChronotypeHistory = async (userId: string, chronotype: string, syncScore: number, outOfSync: number) => {
    try {
      await addDoc(collection(db, 'users', userId, 'chronotypeHistory'), {
        chronotype,
        syncScore,
        outOfSync,
        timestamp: new Date(),
        schoolAlignment: enhancedSyncData?.schoolAlignment || 0,
        studyAlignment: enhancedSyncData?.studyAlignment || 0,
        learningPhase: enhancedSyncData?.learningPhase || 12,
        sleepQuality: enhancedSyncData?.sleepMetrics.averageQuality || 0,
        dataPoints: cognitiveData.length,
        sleepEntries: sleepData.length
      })
      
      console.log('Chronotype history saved successfully')
    } catch (error) {
      console.error('Error saving chronotype history:', error)
    }
  }

  // Load data on mount
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
            
            if (userData.chronotype?.responses) {
              try {
                const mappedResponses = mapSurveyResponsesToQuizFormat(userData.chronotype.responses)
                
                const enhancedData = await calculateEnhancedSyncScore(
                  mappedResponses,
                  cognitiveData,
                  sleepData,
                  lifestyleData,
                  challengeData,
                  userData
                )

                enhancedData.learningTimeline = generateLearningTimeline(
                  enhancedData.chronotype.chronotype,
                  enhancedData.learningPhase
                )
                
                setEnhancedSyncData(enhancedData)
              } catch (error) {
                console.error('Error calculating enhanced sync score:', error)
                const fallbackData = {
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
                  learningTimeline: generateLearningTimeline(userData.chronotype.chronotype, userData.learningPhase || 12)
                }
                setEnhancedSyncData(fallbackData)
              }
            }
          } else {
            setError('Profile not found - please complete your assessment')
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

  // NEW: Real-time listeners for automatic feedback refresh
  useEffect(() => {
    if (!auth.currentUser) return
    const userId = auth.currentUser.uid

    const listeners: Array<() => void> = []

    // Cognitive sessions
    listeners.push(
      onSnapshot(
        query(
          collection(db, 'users', userId, 'cognitivePerformance'),
          orderBy('timestamp', 'desc'),
          limit(1)
        ),
        () => debouncedRefresh()
      )
    )

    // Sleep entries
    listeners.push(
      onSnapshot(
        query(
          collection(db, 'users', userId, 'sleepEntries'),
          orderBy('date', 'desc'),
          limit(1)
        ),
        () => debouncedRefresh()
      )
    )

    // Nutrition entries
    listeners.push(
      onSnapshot(
        query(
          collection(db, 'users', userId, 'nutritionEntries'),
          orderBy('timestamp', 'desc'),
          limit(1)
        ),
        () => debouncedRefresh()
      )
    )

    // Activity entries
    listeners.push(
      onSnapshot(
        query(
          collection(db, 'users', userId, 'activityEntries'),
          orderBy('timestamp', 'desc'),
          limit(1)
        ),
        () => debouncedRefresh()
      )
    )

    // Challenge progress
    listeners.push(
      onSnapshot(
        doc(db, 'users', userId, 'challenges', 'shifting'),
        () => debouncedRefresh()
      )
    )

    return () => {
      listeners.forEach(unsub => unsub())
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    }
  }, [refreshFeedback])

  // Check for new user and start tour
  useEffect(() => {
    if (!loading && userData && !error) {
      checkIfNewUser()
    }
  }, [loading, userData, error])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Loading your profile...</p>
        </motion.div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-white p-10 rounded-2xl shadow-xl max-w-md"
        >
          <h2 className="text-2xl font-bold text-red-600 mb-4">Oops!</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.push('/chronotype-quiz')}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-full font-medium transition mr-4"
          >
            Take Assessment
          </button>
          <button
            onClick={() => router.push('/auth')}
            className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-full font-medium transition"
          >
            Login
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
    learningTimeline: generateLearningTimeline('Bear', 12)
  }

  const hasReliableData = enhancedSyncData && enhancedSyncData.adaptiveComponents.adaptationLevel > 0.2
  const cognitiveDataPoints = Object.values(enhancedSyncData?.adaptiveComponents.domainReliability || {})
    .reduce((sum, r) => sum + (r > 0 ? 1 : 0), 0)

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: '😊' },
    { id: 'tracking', label: 'Track My Day', icon: '⌚' },
    { id: 'insights', label: 'Brain Training', icon: '🧠' },
    { id: 'challenges', label: 'My Goals', icon: '🥅' },
    { id: 'social', label: 'Social', icon: '🎯' }
  ]

  return (
    <>
      <AppTour run={tourActive} onComplete={onTourComplete} />
      <TrackDayTour 
        run={trackTourActive} 
        onComplete={() => setTrackTourActive(false)} 
      />
      <BrainTrainingTour 
        run={brainTourActive} 
        onComplete={() => setBrainTourActive(false)} 
      />

      <main className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 font-sans text-gray-900 px-4 py-8">
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

          {/* Header with Tour Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="welcome-header text-center mb-8 relative"
          >
            <button
              onClick={startTour}
              className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-full text-sm transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <div className="w-4 h-4 bg-white/30 rounded-full flex items-center justify-center">
                <span className="text-xs">?</span>
              </div>
              Meet Sync!
            </button>

            <h1 className="text-3xl font-bold mb-2">
              Hey <span className="text-purple-600">{userData.name}</span>!
            </h1>
            <p className="text-gray-600">Your personalized learning hub</p>
          </motion.div>

          {/* Navigation Tabs */}
          <div className="navigation-tabs flex justify-center mb-8 overflow-x-auto">
            <div className="flex bg-white/60 rounded-full p-1 shadow-lg backdrop-blur-sm min-w-max">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-full mx-1 font-medium transition-all text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-purple-600 text-white shadow-lg scale-105'
                      : 'text-gray-700 hover:bg-white/80'
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="profile-tab-content space-y-6">
                {/* Main Profile Card */}
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                  {userData.chronotype?.responses ? (
                    <div className="text-center">
                      <div className="text-5xl mb-3">
                        {getChronotypeEmoji(displayData.chronotype.chronotype)}
                      </div>
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        {displayData.chronotype.chronotype} Chronotype
                      </h2>
                      <p className="text-gray-600 mb-4">
                        {displayData.chronotype.chronotype === 'Wolf' ? "You're a night owl who's most creative in the evening" :
                         displayData.chronotype.chronotype === 'Lion' ? "You're an early bird who performs best in the morning" :
                         displayData.chronotype.chronotype === 'Bear' ? "You follow the sun and are most productive during the day" :
                         "You have a unique sleep pattern and are highly analytical"}
                      </p>
                      
                      {/* Building Profile section */}
                      {!hasReliableData && (
                        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 mb-6">
                          <div className="flex items-center gap-2 mb-2">
                            <BarChart className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-blue-800">Building Your Profile</span>
                          </div>
                          <p className="text-blue-700 text-sm mb-3">
                            Play brain games and track sleep for more personalized insights!
                          </p>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="font-medium text-blue-800 mb-1">Current Data:</div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                  <span>Assessment complete</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className={`w-2 h-2 ${cognitiveDataPoints > 0 ? 'bg-green-400' : 'bg-gray-300'} rounded-full`}></div>
                                  <span>Brain games: {cognitiveDataPoints}/5</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className={`w-2 h-2 ${sleepData.length > 0 ? 'bg-green-400' : 'bg-gray-300'} rounded-full`}></div>
                                  <span>Sleep entries: {sleepData.length}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="font-medium text-blue-800 mb-1">Next Steps:</div>
                              <div className="space-y-1">
                                <div className="text-blue-600">✓ Play brain games daily</div>
                                <div className="text-blue-600">✓ Track your sleep</div>
                                <div className="text-blue-600">✓ Log activities</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Sync Score - Circular Progress */}
                      <div className="sync-score-display flex flex-col items-center mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                          <span className="font-bold text-gray-800">Your Sync Score</span>
                        </div>
                        
                        <div className="relative w-32 h-32 mb-3">
                          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                            <circle
                              cx="60"
                              cy="60"
                              r="50"
                              fill="none"
                              stroke="#e5e7eb"
                              strokeWidth="8"
                            />
                            <circle
                              cx="60"
                              cy="60"
                              r="50"
                              fill="none"
                              stroke={displayData.syncScore >= 80 ? "#10b981" : 
                                     displayData.syncScore >= 60 ? "#3b82f6" : 
                                     displayData.syncScore >= 40 ? "#f59e0b" : "#ef4444"}
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray={`${(displayData.syncScore / 100) * 314} 314`}
                              className="transition-all duration-1000 ease-out"
                            />
                          </svg>
                          
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="text-3xl font-bold text-gray-800">{displayData.syncScore}</div>
                            <div className="text-sm text-gray-500">/100</div>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-600 text-center">
                          {displayData.syncScore >= 80 ? 'Excellent schedule alignment!' :
                           displayData.syncScore >= 60 ? 'Good schedule alignment - room to improve!' :
                           displayData.syncScore >= 40 ? 'Fair alignment - let\'s optimize!' :
                           'Your schedule needs some work - but we can help!'}
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-purple-100 rounded-lg p-3">
                          <div className="text-lg font-bold text-purple-800">{displayData.schoolAlignment}%</div>
                          <div className="text-xs text-gray-600">School Match</div>
                        </div>
                        <div className="bg-blue-100 rounded-lg p-3">
                          <div className="text-lg font-bold text-blue-800">{displayData.studyAlignment}%</div>
                          <div className="text-xs text-gray-600">Study Match</div>
                        </div>
                      </div>

                      {/* Peak Time - Clickable */}
                      <button 
                        onClick={() => setLearningTimelineOpen(true)}
                        className="peak-learning-time bg-yellow-100 hover:bg-yellow-200 rounded-lg p-4 mb-4 transition-colors w-full"
                        data-tour-target="peak-time"
                      >
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-yellow-700" />
                          <span className="font-semibold text-yellow-800">Your Peak Learning Time</span>
                        </div>
                        <div className="text-xl font-bold text-yellow-800">
                          {formatTime(displayData.learningPhase)}
                        </div>
                        <div className="text-xs text-yellow-700 mt-1 opacity-80">
                          Click to see full timeline
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-4">🧠</div>
                      <h2 className="text-2xl font-bold text-gray-700 mb-4">Complete Assessment Required</h2>
                      <p className="text-gray-600 mb-6">Take our assessment to unlock personalized insights</p>
                      <button
                        onClick={() => router.push('/chronotype-quiz')}
                        className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105"
                      >
                        Start Assessment
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Feedback Section */}
                {userData.chronotype?.responses && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="mb-6"
                  >
                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-200/50 shadow-lg backdrop-blur-sm">
                      <button
                        onClick={() => setFeedbackExpanded(!feedbackExpanded)}
                        className="w-full"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white">
                              <Brain className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                AI Lifestyle Insights
                                {feedbackData && feedbackData.recommendations.length > 0 && (
                                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                    {feedbackData.recommendations.filter(r => r.priority === 'high').length}
                                  </span>
                                )}
                              </h2>
                              <p className="text-gray-600 text-sm">
                                {feedbackLoading ? 'Analyzing your patterns...' :
                                 !feedbackData ? 'Keep tracking to unlock insights' :
                                 `${feedbackData.recommendations.length} personalized recommendations ready`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {feedbackData && (
                              <div className="text-right mr-4">
                                <div className="text-lg font-bold text-purple-700">
                                  {Math.round(feedbackData.confidenceLevel * 100)}%
                                </div>
                                <div className="text-xs text-gray-600">Confidence</div>
                              </div>
                            )}
                            {feedbackExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </button>

                      {feedbackExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.4 }}
                          className="mt-6"
                        >
                          <LifestyleFeedbackComponent
                            feedbackData={feedbackData}
                            onStartChallenge={(challengeId) => {
                              window.location.href = `/Prep/Challenges?start=${challengeId}`
                            }}
                            loading={feedbackLoading}
                          />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Improve Learning Performance */}
                <button 
                  onClick={() => router.push('/Prep/Challenges')}
                  className="bg-gradient-to-r from-cyan-100 to-blue-100 hover:from-cyan-200 hover:to-blue-200 rounded-lg p-4 mb-4 transition-colors w-full border border-cyan-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-700" />
                      <span className="font-semibold text-cyan-800">Improve Your Learning</span>
                    </div>
                    <div className="text-cyan-700 text-xl">+</div>
                  </div>
                  <div className="text-sm text-cyan-700 mt-2 text-left">
                    Take a challenge and make recommended lifestyle changes to improve learning and Sync Scores
                  </div>
                  <div className="text-xs text-cyan-600 mt-1 opacity-80 text-left">
                    Start your personalized improvement journey
                  </div>
                </button>

                {/* Brain Training CTA */}
                <div className="flex justify-center">
                  <button 
                    onClick={() => window.open('/Prep/PrepGames/GameSelection')}
                    className="brain-games-button group relative w-24 h-24 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center group-hover:bg-white/40 transition-colors">
                      <div className="w-0 h-0 border-l-[12px] border-l-white border-t-[9px] border-t-transparent border-b-[9px] border-b-transparent ml-1"></div>
                    </div>
                    
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 animate-pulse opacity-60"></div>
                    
                    <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-10">
🧠 Play Brain Games
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-2 h-2 bg-gray-800 rotate-45"></div>
                    </div>
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => router.push('/Prep/MyBrain')}
                    className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white p-4 rounded-xl font-medium shadow-lg transition-all hover:scale-105"
                  >
                    📈 View Full Analytics
                  </button>
                </div>
              </div>
            )}

            {/* Tracking Tab */}
            {activeTab === 'tracking' && (
              <div className="tracking-section space-y-6">
                <h2 className="text-2xl font-bold text-center text-green-700 mb-6">Track Your Day</h2>
                
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setTrackTourActive(true)}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-4 py-2 rounded-full text-sm shadow-lg transition-all flex items-center gap-2"
                  >
                    <span>❓</span> Tour this page
                  </button>
                </div>

                {/* NEW: Active Challenge Quick Actions */}
                {challengeData.activeChallenges.length > 0 && (
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-200">
                    <h3 className="font-bold text-orange-800 mb-4 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Today's Challenge Progress
                    </h3>
                    <div className="space-y-4">
                      {challengeData.activeChallenges.map(challenge => {
                        const challengeInfo = {
                          id: challenge.challengeId,
                          category: 'general'
                        }

                        return (
                          <div key={challenge.challengeId}>
                            <ChallengeProgressTracker
                              challenge={challengeInfo}
                              progress={challenge}
                              userId={auth.currentUser?.uid || ''}
                            />
                            
                            {/* Interactive Tracker Button */}
                            {['evening-dim-down', 'bedroom-reset', 'consistent-pre-sleep-routine', 
                              'screens-off-30', 'soundscape-snooze', 'consistent-meal-windows',
                              'smart-caffeine-window', 'study-snack-swap', 'hydration-habit',
                              'daily-duo', 'am-vs-pm-compare', 'consistency-quest', 'streak-safe'
                            ].includes(challenge.challengeId) && (
                              <button
                                onClick={() => setActiveChallengeModal(challenge.challengeId)}
                                className="mt-3 w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                              >
                                <Play className="w-4 h-4" />
                                Open Interactive Tracker
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Regular tracking buttons */}
                <div className="grid grid-cols-1 gap-4">
                  {/* Nutrition */}
                  <button
                    onClick={() => setNutritionModalOpen(true)}
                    className="nutrition-button bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white p-6 rounded-xl shadow-lg transition-all hover:scale-105 text-left"
                  >
                    <div className="flex flex-col items-start">
                      <Utensils className="w-8 h-8 mb-3 text-white/90" />
                      <h3 className="font-bold text-lg leading-tight">Nutrition & Hydration</h3>
                      <p className="text-sm opacity-90 mb-4">Log meals and drinks</p>
                      <Plus className="w-5 h-5 text-white/80 self-end" />
                    </div>
                  </button>

                  {/* Activity */}
                  <button
                    onClick={() => setActivityModalOpen(true)}
                    className="activity-button bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 text-white p-6 rounded-xl shadow-lg transition-all hover:scale-105 text-left"
                  >
                    <div className="flex flex-col items-start">
                      <ActivitySquare className="w-8 h-8 mb-3 text-white/90" />
                      <h3 className="font-bold text-lg leading-tight">Physical Activity</h3>
                      <p className="text-sm opacity-90 mb-4">Track exercise and movement</p>
                      <Plus className="w-5 h-5 text-white/80 self-end" />
                    </div>
                  </button>

                  {/* Sleep */}
                  <button
                    onClick={() => setSleepModalOpen(true)}
                    className="sleep-button bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white p-6 rounded-xl shadow-lg transition-all hover:scale-105 text-left"
                  >
                    <div className="flex flex-col items-start">
                      <Moon className="w-8 h-8 mb-3 text-white/90" />
                      <h3 className="font-bold text-lg leading-tight">Sleep & Rest</h3>
                      <p className="text-sm opacity-90 mb-4">Log sleep patterns</p>
                      <Plus className="w-5 h-5 text-white/80 self-end" />
                    </div>
                  </button>
                </div>

                {/* Recent Activity Summary */}
                <div className="bg-white/60 rounded-2xl p-6 shadow-lg">
                  <h3 className="font-bold text-gray-800 mb-4">This Week So Far</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{sleepData.length}</div>
                      <div className="text-xs text-gray-600">Sleep entries</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{cognitiveDataPoints}</div>
                      <div className="text-xs text-gray-600">Brain game sessions</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{challengeData.totalPoints}</div>
                      <div className="text-xs text-gray-600">Challenge points</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Insights Tab */}
            {activeTab === 'insights' && (
              <div className="insights-section space-y-6">
                <h2 className="text-2xl font-bold text-center text-purple-700 mb-6 flex items-center justify-center gap-2">
                  <Brain className="w-6 h-6" /> 
                  Your Brain Training Progress
                </h2>

                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setBrainTourActive(true)}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg"
                  >
                    ❓ Tour Brain Training
                  </button>
                </div>

                {/* Sleep Quality */}
                {enhancedSyncData && enhancedSyncData.sleepMetrics.averageQuality > 0 && (
                  <div className="bg-white/60 rounded-2xl p-6 shadow-lg">
                    <h3 className="font-bold text-indigo-800 mb-4 flex items-center gap-2">
                      <Moon className="w-5 h-5" />
                      Sleep Quality Score
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-indigo-700">{Math.round(enhancedSyncData.sleepMetrics.averageQuality)}/100</div>
                        <div className="text-xs text-gray-600">Quality</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-indigo-700">{Math.round(enhancedSyncData.sleepMetrics.consistency)}%</div>
                        <div className="text-xs text-gray-600">Consistency</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-indigo-700">{enhancedSyncData.sleepMetrics.duration.toFixed(1)}h</div>
                        <div className="text-xs text-gray-600">Average Duration</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cognitive Domains */}
                <div className="brain-progress-chart bg-white/60 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-purple-800 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Brain Training Progress
                    </h3>
                    <button 
                      onClick={() => window.open('/Prep/PrepGames/GameSelection', '_blank')}
                      className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-medium transition-all hover:scale-105"
                    >
                      Play All Games
                    </button>
                  </div>
                  
                  {Object.keys(displayData.adaptiveComponents.domainReliability).length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(displayData.adaptiveComponents.domainReliability).map(([domain, reliability]) => (
                        <div key={domain} className="bg-purple-50 rounded-lg p-3 relative">
                          <div className="text-sm font-medium text-gray-700 mb-1">
                            {domain.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  reliability > 0.5 ? 'bg-green-500' : 
                                  reliability > 0.2 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.max(reliability * 100, 10)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{Math.round(reliability * 100)}%</span>
                          </div>
                          {reliability < 0.5 && (
                            <button 
                              onClick={() => window.open(`/Prep/PrepGames/GameSelection?domain=${domain.toLowerCase()}`, '_blank')}
                              className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-full transition-colors"
                            >
                              Train This
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-4">🎮</div>
                      <p className="text-gray-600 mb-4">Start playing brain games to see your progress!</p>
                      <button 
                        onClick={() => window.open('/Prep/PrepGames/GameSelection', '_blank')}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-full font-medium transition-all hover:scale-105"
                      >
                        Start Training
                      </button>
                    </div>
                  )}
                </div>

                {/* Study Warmup & Study Along */}
                <div className="training-challenges bg-gradient-to-r from-cyan-50 to-blue-100 rounded-2xl p-6 shadow-lg border border-cyan-200">
                  <h3 className="font-bold text-cyan-800 mb-2">📚 Study Warmup</h3>
                  <p className="text-cyan-700 text-sm mb-4">
                    Kickstart your study sessions with a 3-minute warmup of memory, focus, and stretching
                    exercises, then dive into a focused study session.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => router.push('/Prep/BrainWarmup')}
                      className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-full font-medium transition-all hover:scale-105"
                    >
                      Start Warmup
                    </button>
                    <button
                      onClick={() => router.push('/Prep/StudyAlong')}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-medium transition-all hover:scale-105"
                    >
                      Study Along
                    </button>
                  </div>
                </div>

                {/* Quick Tips */}
                <div className="bg-gradient-to-r from-yellow-50 to-orange-100 rounded-2xl p-6 border border-yellow-200">
                  <h3 className="font-bold text-orange-800 mb-3">🎯 Tips for You</h3>
                  <ul className="space-y-2 text-sm text-orange-700">
                    {userData.chronotype?.responses ? (
                      <>
                        {displayData.chronotype.chronotype === 'Wolf' && (
                          <>
                            <li>✓ Your evening focus time is perfect for complex homework</li>
                            <li>✓ Try shifting bedtime earlier gradually to improve school alignment</li>
                            <li>✓ Use bright light in the morning to help with early wake-ups</li>
                          </>
                        )}
                        {displayData.chronotype.chronotype === 'Lion' && (
                          <>
                            <li>✓ Take advantage of your natural morning energy for tough subjects</li>
                            <li>✓ Schedule important tasks before 2 PM when possible</li>
                            <li>✓ Keep evening activities light to maintain your early bedtime</li>
                          </>
                        )}
                        {displayData.chronotype.chronotype === 'Bear' && (
                          <>
                            <li>✓ Your midday energy is perfect for challenging coursework</li>
                            <li>✓ Take advantage of the natural afternoon focus window</li>
                            <li>✓ Maintain consistent sleep-wake times for optimal performance</li>
                          </>
                        )}
                        <li>✓ Play brain games for 10-15 minutes during your peak learning time</li>
                        <li>✓ Track your sleep to optimize your natural rhythm</li>
                      </>
                    ) : (
                      <>
                        <li>✓ Complete your chronotype assessment for personalized tips</li>
                        <li>✓ Start tracking sleep and activities to build your profile</li>
                        <li>✓ Play brain games to discover your cognitive strengths</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Challenges Tab */}
            {activeTab === 'challenges' && (
              <div className="challenges-section space-y-6">
                <h2 className="text-2xl font-bold text-center text-green-700 mb-6 flex items-center justify-center gap-2">
                  🥅 My Goals & Challenges
                </h2>

                {/* NEW: Challenge Overview Dashboard */}
                <ChallengeOverviewDashboard 
                  challengeData={challengeData}
                  userId={auth.currentUser?.uid || ''}
                />

                {/* Active Challenges with Specialized Trackers */}
                {challengeData && challengeData.activeChallenges.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800">Active Challenges</h3>
                    {challengeData.activeChallenges.map(challenge => (
                      <div key={challenge.challengeId} className="space-y-4">
                        {/* Standard Progress Display */}
                        <ActiveChallengesStrip
                          activeChallenges={[challenge]}
                          onLogProgress={handleLogProgress}
                          onViewAllChallenges={() => router.push('/Prep/Challenges')}
                        />

                        {/* Specialized Trackers */}
                        {challenge.challengeId === 'weekend-drift-guard' && (
                          <WeekendDriftTracker
                            challengeId={challenge.challengeId}
                            progress={challenge}
                          />
                        )}

                        {challenge.challengeId === 'memory-ladder' && (
                          <MemoryLadderTracker
                            challengeId={challenge.challengeId}
                            userId={auth.currentUser?.uid || ''}
                          />
                        )}

                        {challenge.challengeId === 'attention-uptick' && (
                          <AttentionUptickTracker
                            challengeId={challenge.challengeId}
                            userId={auth.currentUser?.uid || ''}
                          />
                        )}

                        {/* Interactive Tracker Button for eligible challenges */}
                        {['evening-dim-down', 'bedroom-reset', 'consistent-pre-sleep-routine',
                          'screens-off-30', 'soundscape-snooze', 'consistent-meal-windows',
                          'smart-caffeine-window', 'study-snack-swap', 'hydration-habit',
                          'daily-duo', 'am-vs-pm-compare', 'consistency-quest', 'streak-safe'
                        ].includes(challenge.challengeId) && (
                          <button
                            onClick={() => setActiveChallengeModal(challenge.challengeId)}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
                          >
                            <Target className="w-5 h-5" />
                            Open Interactive Tracker
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Start New Challenge */}
                <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-6 border border-purple-200 text-center">
                  <h3 className="font-bold text-purple-800 mb-3">🆕 Start a New Challenge</h3>
                  <p className="text-purple-700 text-sm mb-4">
                    Head to Challenges page to explore and start new goals
                  </p>
                  <button
                    onClick={() => router.push('/Prep/Challenges')}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-semibold transition-all text-sm shadow-md"
                  >
                    Go to Challenges →
                  </button>
                </div>

                {/* Total Points Display */}
                <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-2xl p-6 border border-yellow-200 text-center">
                  <h3 className="font-bold text-orange-800 mb-2">🏆 Total Challenge Points</h3>
                  <div className="text-3xl font-bold text-orange-700 mb-2">{challengeData.totalPoints}</div>
                  <div className="text-sm text-orange-600">
                    Keep completing challenges to earn more points!
                  </div>
                </div>
              </div>
            )}

            {/* Social Tab */}
            {activeTab === 'social' && (
              <div className="social-section space-y-6">
                <h2 className="text-2xl font-bold text-center text-purple-700 mb-6 flex items-center justify-center gap-2">
                  👥 Connect with Friends
                </h2>

                {/* Invite Friends Section */}
                <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl p-6 border border-blue-200 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-blue-800 text-lg">Invite Your Friends</h3>
                      <p className="text-blue-600 text-sm">Share your learning journey together</p>
                    </div>
                  </div>
                  
                  <div className="bg-white/60 rounded-lg p-4 mb-4">
                    <p className="text-gray-700 text-sm mb-3">
                      Invite friends to compare chronotypes, challenge each other in brain games, 
                      and share lifestyle tips for better learning!
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Compare study schedules</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Brain game competitions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Share progress & tips</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Group challenges</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push('/Prep/FriendsPage')}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send Invites
                  </button>
                </div>

                {/* Friends List Section */}
                <div className="bg-white/60 rounded-2xl p-1 shadow-lg">
                  <FriendsList />
                </div>
              </div>
            )}
          </motion.div>

          {/* Learning Timeline Modal */}
          {learningTimelineOpen && displayData.learningTimeline && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Brain className="w-6 h-6 text-purple-600" />
                    Your Complete Learning Timeline
                  </h3>
                  <button 
                    onClick={() => setLearningTimelineOpen(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="mb-4 text-sm text-gray-600">
                  Your cognitive performance throughout the day ({displayData.chronotype.chronotype} chronotype pattern)
                </div>
                
                {/* Timeline Chart */}
                <div className="space-y-2 mb-6">
                  {displayData.learningTimeline.map((point, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-16 text-sm font-medium text-gray-700">
                        {point.label}
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                          <div
                            className={`h-4 rounded-full transition-all ${
                              point.performance >= 80 ? 'bg-green-500' :
                              point.performance >= 60 ? 'bg-blue-500' :
                              point.performance >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                            } ${point.time === displayData.learningPhase ? 'ring-2 ring-purple-400 ring-offset-1' : ''}`}
                            style={{ width: `${point.performance}%` }}
                          />
                          {point.time === displayData.learningPhase && (
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              Peak Time
                            </div>
                          )}
                        </div>
                        <div className="w-8 text-xs text-gray-600">
                          {point.performance}%
                        </div>
                      </div>
                      <div className="w-32 text-xs text-gray-500">
                        {point.activity}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Legend */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Performance Zones</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span>Peak (80-100%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span>Good (60-79%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                      <span>Fair (40-59%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span>Low (0-39%)</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-purple-600 font-medium">
                      <div className="w-4 h-4 border-2 border-purple-400 rounded"></div>
                      <span>Your Peak Learning Time: {formatTime(displayData.learningPhase)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex justify-center">
                  <button 
                    onClick={() => setLearningTimelineOpen(false)}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          )}

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

          {/* NEW: Interactive Challenge Modal */}
          <InteractiveChallengeModal
            challengeId={activeChallengeModal || ''}
            isOpen={!!activeChallengeModal}
            onClose={() => setActiveChallengeModal(null)}
            onComplete={() => {
              setActiveChallengeModal(null)
              refreshFeedback()
            }}
            userId={auth.currentUser?.uid || ''}
          />

        </div>
      </main>
    </>
  )
}
