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
  section: 'chronotype' | 'schedule' | 'study'
}

// Complete question set that satisfies all requirements for the AboutMe page
const allQuestions: Question[] = [
  // CHRONOTYPE ASSESSMENT QUESTIONS
  { 
    id: 'naturalWake', 
    question: 'If you were completely free to plan your day with no commitments, what time would you naturally wake up?', 
    options: ['Before 8 AM', '8-10 AM', 'After 10 AM'], 
    section: 'chronotype' 
  },
  { 
    id: 'focusTime', 
    question: 'When do you feel most focused and able to concentrate?', 
    options: ['Morning', 'Afternoon', 'Evening'], 
    section: 'chronotype' 
  },
  { 
    id: 'testTime', 
    question: 'If you could choose, what time would you prefer to take an important test or exam?', 
    options: ['Morning', 'Midday', 'Evening'], 
    section: 'chronotype' 
  },
  { 
    id: 'morningFeel', 
    question: 'How do you feel during the first 30 minutes after waking up?', 
    options: ['Wide awake', 'A bit slow', 'Super groggy'], 
    section: 'chronotype' 
  },
  { 
    id: 'bedWeekend', 
    question: 'On weekends or free days, what time do you naturally prefer to go to sleep?', 
    options: ['Before 10 PM', '10 PM-Midnight', 'After Midnight'], 
    section: 'chronotype' 
  },
  {
    id: 'animalType', 
    question: 'Which of these animal sleep patterns feels most like you?', 
    options: [
      'Lion - Early bird, productive in mornings, early to bed',
      'Bear - Follows the sun, sociable, best with a regular schedule',
      'Wolf - Night owl, alert in evenings, hates early mornings',
      'Dolphin - Light sleeper, erratic routine, cannot follow fixed schedules'
    ], 
    section: 'chronotype' 
  },

  // SCHOOL SCHEDULE QUESTIONS
  { 
    id: 'schoolStart', 
    question: 'What time does your school day typically start?', 
    options: ['Before 7:30 AM', '7:30-8:00 AM', 'After 8:00 AM'], 
    section: 'schedule' 
  },
  { 
    id: 'wakeSchool', 
    question: 'What time do you usually wake up on school days?', 
    options: ['Before 6 AM', '6-6:59 AM', '7-7:59 AM', '8 AM or later'], 
    section: 'schedule' 
  },
  { 
    id: 'homeTime', 
    question: 'What time do you usually get home from school (including any after-school activities)?', 
    options: ['Before 3:30 PM', '3:30-4:30 PM', 'After 4:30 PM'], 
    section: 'schedule' 
  },
  { 
    id: 'extraTime', 
    question: 'If you have after-school academic programs (tutoring, test prep, etc.), when do they typically occur?', 
    options: ['Before 4 PM', '4-6 PM', 'After 6 PM', 'Varies'], 
    section: 'schedule' 
  },
  { 
    id: 'extras', 
    question: 'Which after-school academic programs do you attend?', 
    options: ['AoPS', 'RSM', 'Kumon', 'Other', 'None'], 
    section: 'schedule' 
  },

  // STUDY HABITS QUESTIONS (Critical for sync score calculation)
  { 
    id: 'homeworkTime', 
    question: 'When do you typically do your homework or study?', 
    options: ['Right after school', 'After dinner', 'Late at night', 'Depends'], 
    section: 'study' 
  },
  { 
    id: 'bestStudyTime', 
    question: 'When do you feel you learn and retain information best?', 
    options: ['Early morning', 'Late morning', 'Afternoon', 'Evening'], 
    section: 'study' 
  },
  { 
    id: 'homeworkDuration', 
    question: 'How long do you typically spend on homework each day?', 
    options: ['Less than 1 hour', '1-2 hours', '2-3 hours', 'More than 3 hours'], 
    section: 'study' 
  },
  { 
    id: 'studyBreaks', 
    question: 'How often do you take breaks while studying?', 
    options: ['Every 15-30 minutes', 'Every 45-60 minutes', 'Every 1-2 hours', 'Rarely take breaks'], 
    section: 'study' 
  },

  // ADDITIONAL SCHEDULE DETAILS
  { 
    id: 'weekendSleep', 
    question: 'What time do you usually go to sleep on weekends?', 
    options: ['Before 10 PM', '10 PM-Midnight', 'After Midnight'], 
    section: 'schedule' 
  },
  { 
    id: 'weekendWake', 
    question: 'What time do you usually wake up on weekends?', 
    options: ['Before 8 AM', '8-10 AM', 'After 10 AM'], 
    section: 'schedule' 
  },
  { 
    id: 'mealTimes', 
    question: 'When do you typically eat dinner on school days?', 
    options: ['Before 6 PM', '6-7 PM', '7-8 PM', 'After 8 PM'], 
    section: 'schedule' 
  },
  { 
    id: 'screenTime', 
    question: 'When do you typically stop using screens (phone, computer, TV) before bed?', 
    options: ['2+ hours before bed', '1 hour before bed', '30 minutes before bed', 'Right before bed'], 
    section: 'schedule' 
  },

  // ACADEMIC PERFORMANCE QUESTIONS
  { 
    id: 'alertnessSchool', 
    question: 'How alert do you feel during your first class of the day?', 
    options: ['Very alert', 'Somewhat alert', 'Somewhat sleepy', 'Very sleepy'], 
    section: 'study' 
  },
  { 
    id: 'concentrationTime', 
    question: 'What time of day can you concentrate the longest without getting distracted?', 
    options: ['Morning (8 AM-12 PM)', 'Afternoon (12 PM-5 PM)', 'Evening (5 PM-9 PM)', 'Night (after 9 PM)'], 
    section: 'study' 
  },
  { 
    id: 'memoryTime', 
    question: 'When do you find it easiest to memorize new information?', 
    options: ['Morning', 'Afternoon', 'Evening', 'It varies'], 
    section: 'study' 
  }
]

export default function CompleteChronotypeSurveyPage() {
  const router = useRouter()
  const [responses, setResponses] = useState<Record<string, string | string[]>>({})
  const [otherExtrasText, setOtherExtrasText] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [currentSection, setCurrentSection] = useState<'chronotype' | 'transition1' | 'schedule' | 'transition2' | 'study'>('chronotype')
  const [progress, setProgress] = useState(0)

  // Group questions by section
  const chronotypeQuestions = allQuestions.filter(q => q.section === 'chronotype')
  const scheduleQuestions = allQuestions.filter(q => q.section === 'schedule')
  const studyQuestions = allQuestions.filter(q => q.section === 'study')

  const totalQuestions = allQuestions.length
  const currentQuestionCount = Object.keys(responses).length

  useEffect(() => {
    setProgress((currentQuestionCount / totalQuestions) * 100)
  }, [currentQuestionCount, totalQuestions])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid)

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
        router.push('/Prep/Registration')
      }
    })
    return () => unsubscribe()
  }, [router])

  const handleChange = (questionId: string, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }))
    setError('')
  }

  const handleMultipleChange = (questionId: string, value: string) => {
    setResponses(prev => {
      const current = prev[questionId] as string[] || []
      
      if (current.includes(value)) {
        // Remove if already selected
        return { ...prev, [questionId]: current.filter(item => item !== value) }
      } else {
        // Add if not selected
        return { ...prev, [questionId]: [...current, value] }
      }
    })
    setError('')
  }

  const validateSection = (questions: Question[]): boolean => {
    const unansweredQuestions = questions.filter(q => {
      const response = responses[q.id]
      if (q.id === 'extras') {
        // For the extras question, check if at least one option is selected
        return !response || (Array.isArray(response) && response.length === 0)
      }
      return !response
    })
    
    if (unansweredQuestions.length > 0) {
      setError(`Please answer all questions in this section. Missing: ${unansweredQuestions.length} question(s)`)
      return false
    }
    return true
  }

  const handleContinueToSchedule = () => {
    if (!validateSection(chronotypeQuestions)) return
    setCurrentSection('transition1')
    setTimeout(() => setCurrentSection('schedule'), 2000)
  }

  const handleContinueToStudy = () => {
    if (!validateSection(scheduleQuestions)) return
    setCurrentSection('transition2')
    setTimeout(() => setCurrentSection('study'), 2000)
  }

  const determineChronotype = (resp: Record<string, string | string[]>): string => {
    const animal = resp.animalType as string || ''
    if (animal.includes('Lion')) return 'Lion'
    if (animal.includes('Wolf')) return 'Wolf'
    if (animal.includes('Dolphin')) return 'Dolphin'
    return 'Bear'
  }

  const calculateSyncScore = (resp: Record<string, string | string[]>): number => {
    // Simple calculation based on alignment between natural preferences and school schedule
    const wakeMap: Record<string, number> = {
      'Before 8 AM': 7, '8-10 AM': 9, 'After 10 AM': 11,
      'Before 6 AM': 6, '6-6:59 AM': 6.5, '7-7:59 AM': 7.5, '8 AM or later': 8.5
    }
    
    const naturalWake = wakeMap[resp.naturalWake as string] || 9
    const schoolWake = wakeMap[resp.wakeSchool as string] || 7.5
    
    const wakeDifference = Math.abs(naturalWake - schoolWake)
    
    // Focus time alignment
    const focusAlignment = (resp.focusTime === 'Morning' && resp.schoolStart !== 'After 8:00 AM') ? 0 :
                          (resp.focusTime === 'Afternoon') ? 1 :
                          (resp.focusTime === 'Evening' && resp.homeworkTime === 'Late at night') ? 0 : 2
    
    // Calculate sync score (0-100, higher is better alignment)
    const baseScore = Math.max(0, 100 - (wakeDifference * 15) - (focusAlignment * 10))
    
    return Math.round(baseScore)
  }

  const handleSubmit = async () => {
    if (!validateSection(studyQuestions)) return
    if (!userId) {
      setError('User not authenticated. Please try refreshing the page.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      // Prepare responses for saving, including other extras text if applicable
      const finalResponses = { ...responses }
      if (otherExtrasText && Array.isArray(responses.extras) && responses.extras.includes('Other')) {
        finalResponses.extrasOther = otherExtrasText
      }

      const chronotype = determineChronotype(finalResponses)
      const outOfSync = 100 - calculateSyncScore(finalResponses) // Convert to "out of sync" percentage

      // Save complete data to Firestore
      await setDoc(doc(db, 'users', userId), {
        chronotype: {
          chronotype,
          outOfSync,
          responses: finalResponses, // All survey responses for sync score calculation
          timestamp: new Date().toISOString(),
          syncScore: calculateSyncScore(finalResponses)
        }
      }, { merge: true })

      // Save to localStorage as backup
      localStorage.setItem('chronotypeResult', JSON.stringify({ 
        chronotype, 
        outOfSync, 
        syncScore: calculateSyncScore(finalResponses) 
      }))
      
      // Navigate to results page
      router.push('/Prep/OnboardingCog')

    } catch (error) {
      console.error('Error saving chronotype data:', error)
      setError('Failed to save your results. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderQuestionSection = (questions: Question[], title: string, emoji: string) => (
    <section className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-6 space-y-8">
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div 
          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-center text-sm text-gray-600 mb-6">
        {currentQuestionCount} of {totalQuestions} questions completed
      </div>

      <h2 className="text-2xl font-bold text-purple-600 text-center">{emoji} {title}</h2>
      
      {questions.map(q => (
        <div key={q.id} className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">{q.question}</h3>
          
          {/* Special handling for the extras question (multiple selection) */}
          {q.id === 'extras' ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Select all that apply:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map(opt => (
                  <button
                    key={opt}
                    className={`p-4 rounded-lg border text-left transition-all hover:shadow-md ${
                      Array.isArray(responses[q.id]) && responses[q.id].includes(opt)
                        ? 'bg-purple-100 border-purple-500 shadow-md' 
                        : 'bg-gray-50 hover:bg-gray-100 border-gray-300'
                    }`}
                    onClick={() => handleMultipleChange(q.id, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              
              {/* Show text input if "Other" is selected */}
              {Array.isArray(responses[q.id]) && responses[q.id].includes('Other') && (
                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Please specify other programs..."
                    value={otherExtrasText}
                    onChange={(e) => setOtherExtrasText(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Regular single selection for all other questions */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {q.options.map(opt => (
                <button
                  key={opt}
                  className={`p-4 rounded-lg border text-left transition-all hover:shadow-md ${
                    responses[q.id] === opt 
                      ? 'bg-purple-100 border-purple-500 shadow-md' 
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-300'
                  }`}
                  onClick={() => handleChange(q.id, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-center">
          {error}
        </div>
      )}
    </section>
  )

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-100 to-purple-100 px-6 py-12">
      <section className="text-center mb-12">
        <div className="w-40 h-40 mx-auto mb-4">
          <Lottie animationData={sunAnimation} loop />
        </div>
        <h1 className="text-4xl font-bold text-purple-700 mb-2">Discover Your Learning Rhythm</h1>
        <p className="text-gray-700 text-lg max-w-2xl mx-auto">
          This comprehensive assessment will help us understand your natural chronotype, daily schedule, 
          and learning preferences to create a personalized experience.
        </p>
      </section>

      {/* Chronotype Questions */}
      {currentSection === 'chronotype' && (
        <>
          {renderQuestionSection(chronotypeQuestions, 'Natural Chronotype', '🌞')}
          <div className="text-center mt-8">
            <button
              onClick={handleContinueToSchedule}
              className="px-8 py-4 rounded-full font-semibold text-lg shadow-lg transition-transform bg-purple-600 hover:bg-purple-500 hover:scale-105 text-white"
            >
              Continue to Schedule Questions
            </button>
          </div>
        </>
      )}

      {/* Transition 1 */}
      {currentSection === 'transition1' && (
        <section className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-12 text-center">
          <div className="animate-pulse">
            <h2 className="text-3xl font-bold text-purple-600 mb-4">Great progress!</h2>
            <p className="text-xl text-gray-700">
              Now let's learn about your daily schedule and commitments
            </p>
          </div>
        </section>
      )}

      {/* Schedule Questions */}
      {currentSection === 'schedule' && (
        <>
          {renderQuestionSection(scheduleQuestions, 'Daily Schedule', '📅')}
          <div className="text-center mt-8">
            <button
              onClick={handleContinueToStudy}
              className="px-8 py-4 rounded-full font-semibold text-lg shadow-lg transition-transform bg-blue-600 hover:bg-blue-500 hover:scale-105 text-white"
            >
              Continue to Study Habits
            </button>
          </div>
        </>
      )}

      {/* Transition 2 */}
      {currentSection === 'transition2' && (
        <section className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-12 text-center">
          <div className="animate-pulse">
            <h2 className="text-3xl font-bold text-blue-600 mb-4">Almost done!</h2>
            <p className="text-xl text-gray-700">
              Finally, let's understand your study habits and learning preferences
            </p>
          </div>
        </section>
      )}

      {/* Study Questions */}
      {currentSection === 'study' && (
        <>
          {renderQuestionSection(studyQuestions, 'Study Habits & Learning', '📚')}
          <div className="text-center mt-8">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`px-8 py-4 rounded-full font-semibold text-lg shadow-lg transition-transform ${
                isSubmitting 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-500 hover:scale-105'
              } text-white`}
            >
              {isSubmitting ? 'Analyzing Your Profile...' : 'Complete Assessment'}
            </button>
          </div>
        </>
      )}

      <footer className="text-center mt-20 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Prep by Chiasmatic. All rights reserved.</p>
      </footer>
    </main>
  )
}