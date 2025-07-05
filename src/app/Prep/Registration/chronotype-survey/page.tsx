'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Lottie from 'lottie-react'
import { db, auth } from '@/firebase/config'
import { doc, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import sunAnimation from '@/lotties/sun.json'

interface Question {
  id: string
  question: string
  options: string[]
}

const chronotypeQuestions: Question[] = [
  { id: 'idealWakeTime', question: 'If you were completely free to plan your day, what time would you get up?', options: ['Before 6am', '6–8am', '8–10am', 'After 10am'] },
  { id: 'alertTime', question: 'When do you feel most alert?', options: ['Morning', 'Afternoon', 'Evening', 'Late Night'] },
  { id: 'bestMentalTime', question: 'What time of day do you perform best mentally?', options: ['Morning', 'Midday', 'Evening', 'It varies'] },
  { id: 'morningFeel', question: 'How do you feel during the first 30 minutes after waking up?', options: ['Very alert', 'Somewhat alert', 'Somewhat tired', 'Very tired'] },
  { id: 'preferredSleepTime', question: 'What time would you prefer to go to sleep?', options: ['Before 9pm', '9–10pm', '10–11pm', 'After 11pm'] },
  { id: 'difficultyWaking', question: 'How difficult is it for you to get up in the morning?', options: ['Very easy', 'Fairly easy', 'Somewhat difficult', 'Very difficult'] },
  {
    id: 'animalType', question: 'Which of these animal sleep patterns feels most like you?', options: [
      '🦁 Lion – Early bird, productive in mornings, early to bed',
      '🐻 Bear – Follows the sun, sociable, best with a regular schedule',
      '🐺 Wolf – Night owl, alert in evenings, hates early mornings',
      '🐬 Dolphin – Light sleeper, erratic routine, can not follow fixed schedules'
    ]
  }
]

const scheduleQuestions: Question[] = [
  { id: 'schoolWake', question: 'What time do you usually wake up on school days?', options: ['Before 6am', '6–7am', '7–8am', 'After 8am'] },
  { id: 'schoolStart', question: 'What time does your school day start?', options: ['Before 7am', '7–8am', '8–9am', 'After 9am'] },
  { id: 'lunchTime', question: 'When is your usual lunch time at school?', options: ['Before 11am', '11–12pm', '12–1pm', 'After 1pm'] },
  { id: 'schoolEnd', question: 'What time do you usually go home after school?', options: ['Before 3pm', '3–4pm', '4–5pm', 'After 5pm'] },
  { id: 'afterSchoolAcademics', question: 'Do you have after school academic activities (e.g. AOPS, RSM, Tutoring)?', options: ['Yes, every day', 'Yes, 2–3 times a week', 'Yes, occasionally', 'No'] },
  { id: 'postSchoolMeals', question: 'When do you usually eat meals after school?', options: ['3–4pm', '4–6pm', '6–8pm', 'After 8pm'] },
  { id: 'bedTime', question: 'What time do you usually go to bed?', options: ['Before 9pm', '9–10pm', '10–11pm', 'After 11pm'] },
  { id: 'weekendControl', question: 'On weekends, are you allowed to choose your own sleep/wake times?', options: ['Yes, always', 'Yes, sometimes', 'No, my schedule stays the same'] },
  { id: 'weekendSleep', question: 'When do you usually go to sleep on weekends?', options: ['Before 9pm', '9–10pm', '10–11pm', 'After 11pm'] },
  { id: 'weekendWake', question: 'When do you usually wake up on weekends?', options: ['Before 7am', '7–8am', '8–9am', 'After 9am'] }
]

export default function ChronotypeSurveyPage() {
  const router = useRouter()
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid)

        // Ensure user data exists
        const ensureUserData = async () => {
          try {
            await setDoc(doc(db, 'users', user.uid), {
              name: user.displayName || '',
              email: user.email || ''
            }, { merge: true })
          } catch (error) {
            console.error('Error ensuring user data:', error)
          }
        }

        ensureUserData()
      } else {
        // If no user is logged in, redirect to registration
        router.push('/Prep/Registration')
      }
    })
    return () => unsubscribe()
  }, [router])

  const handleChange = (questionId: string, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }))
    setError('') // Clear any previous errors
  }

  const determineChronotype = (resp: Record<string, string>): string => {
    const animal = resp.animalType || ''
    if (animal.includes('Lion')) return 'Lion'
    if (animal.includes('Wolf')) return 'Wolf'
    if (animal.includes('Dolphin')) return 'Dolphin'
    return 'Bear'
  }

  const calculateSyncScore = (resp: Record<string, string>): number => {
    const wakeMap: Record<string, number> = {
      'Before 6am': 6, '6–7am': 6.5, '6–8am': 7, '7–8am': 7.5, '8–10am': 9, 'After 8am': 9, 'After 10am': 11
    }
    const sleepMap: Record<string, number> = {
      'Before 9pm': 21, '9–10pm': 21.5, '10–11pm': 22.5, 'After 11pm': 24
    }

    const idealWake = wakeMap[resp.idealWakeTime] || 7
    const schoolWake = wakeMap[resp.schoolWake] || 7

    const idealSleep = sleepMap[resp.preferredSleepTime] || 22
    const schoolSleep = sleepMap[resp.bedTime] || 22

    const wakeDiff = Math.abs(idealWake - schoolWake)
    const sleepDiff = Math.abs(idealSleep - schoolSleep)

    return Math.round(((wakeDiff + sleepDiff) / 12) * 100)
  }

  // Validate that all questions are answered
  const validateSurvey = (): boolean => {
    const allQuestions = [...chronotypeQuestions, ...scheduleQuestions]
    const unansweredQuestions = allQuestions.filter(q => !responses[q.id])
    
    if (unansweredQuestions.length > 0) {
      setError(`Please answer all questions. Missing: ${unansweredQuestions.length} question(s)`)
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validateSurvey()) return
    if (!userId) {
      setError('User not authenticated. Please try refreshing the page.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const chronotype = determineChronotype(responses)
      const outOfSync = calculateSyncScore(responses)

      // Save to Firestore
      await setDoc(doc(db, 'users', userId), {
        chronotype: {
          chronotype,
          outOfSync,
          responses,
          timestamp: new Date().toISOString()
        }
      }, { merge: true })

      // Save to localStorage as backup
      localStorage.setItem('chronotypeResult', JSON.stringify({ chronotype, outOfSync }))
      
      // Navigate to results page
      router.push('/Prep/Registration/YourChronotypePage')

    } catch (error) {
      console.error('Error saving chronotype data:', error)
      setError('Failed to save your results. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-100 to-purple-100 px-6 py-12">
      <section className="text-center mb-12">
        <div className="w-40 h-40 mx-auto mb-4">
          <Lottie animationData={sunAnimation} loop />
        </div>
        <h1 className="text-4xl font-bold text-purple-700 mb-2">🕒 Discover Your Learning Rhythm</h1>
        <p className="text-gray-700 text-lg max-w-xl mx-auto">
          Take this quick quiz to learn about your chronotype and daily routine. We'll use it to personalize your Prep experience.
        </p>
      </section>

      <section className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-6 space-y-12">
        <h2 className="text-2xl font-bold text-pink-600 text-center">🌞 Chronotype Questions</h2>
        {chronotypeQuestions.map(q => (
          <div key={q.id}>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">{q.question}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {q.options.map(opt => (
                <button
                  key={opt}
                  className={`p-4 rounded-lg border text-left transition ${responses[q.id] === opt ? 'bg-pink-100 border-pink-500' : 'bg-gray-50 hover:bg-gray-100 border-gray-300'}`}
                  onClick={() => handleChange(q.id, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-6 mt-12 space-y-12">
        <h2 className="text-2xl font-bold text-blue-600 text-center">📘 Your Daily Schedule</h2>
        {scheduleQuestions.map(q => (
          <div key={q.id}>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">{q.question}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {q.options.map(opt => (
                <button
                  key={opt}
                  className={`p-4 rounded-lg border text-left transition ${responses[q.id] === opt ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 hover:bg-gray-100 border-gray-300'}`}
                  onClick={() => handleChange(q.id, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-center">
            {error}
          </div>
        )}

        <div className="text-center mt-10">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-8 py-4 rounded-full font-semibold text-lg shadow-lg transition-transform ${
              isSubmitting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-500 hover:scale-105'
            } text-white`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Survey'}
          </button>
        </div>
      </section>

      <footer className="text-center mt-20 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Prep by Chiasmatic. All rights reserved.</p>
      </footer>
    </main>
  )
}