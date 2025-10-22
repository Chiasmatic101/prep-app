'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { doc, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { calculateEnhancedSyncScore } from '../../../utils/enhancedsyncScoreCalculator'

interface QuizResponses {
  // Core chronotype questions
  naturalWake: 'Before 8 AM' | '8–10 AM' | 'After 10 AM'
  focusTime: 'Morning' | 'Afternoon' | 'Evening'
  testTime: 'Morning' | 'Midday' | 'Evening'
  schoolStart: 'Before 7:30 AM' | '7:30–8:00 AM' | 'After 8:00 AM'
  homeworkTime: 'Right after school' | 'After dinner' | 'Late at night' | 'Depends'
  
  // Additional schedule questions
  wakeSchool: 'Before 6 AM' | '6–6:59 AM' | '7–7:59 AM' | '8 AM or later'
  homeTime: 'Before 3:30 PM' | '3:30–4:30 PM' | 'After 4:30 PM'
  extraTime: 'Before 4 PM' | '4–6 PM' | 'After 6 PM' | 'Varies'
  extras: 'AoPS' | 'RSM' | 'Kumon' | 'Other' | 'None'
  wakeFeel: 'Wide awake' | 'A bit slow' | 'Super groggy'
  bedWeekend: 'Before 10 PM' | '10 PM–Midnight' | 'After Midnight'
}

interface QuestionProps {
  label: string
  name: keyof QuizResponses
  options: string[]
  description?: string
  emoji?: string
}

export default function EnhancedChronotypeQuizPage() {
  const [formData, setFormData] = useState<Partial<QuizResponses>>({})
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleChange = (name: keyof QuizResponses, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const user = auth.currentUser
      if (!user) {
        setError('You must be logged in to save your assessment')
        setIsSubmitting(false)
        return
      }

      // Calculate enhanced sync score
      const enhancedData = calculateEnhancedSyncScore(formData as QuizResponses)

      // Save to Firebase
      await setDoc(doc(db, 'users', user.uid), {
        responses: formData,
        chronotype: enhancedData.chronotype,
        syncScore: enhancedData.syncScore,
        learningPhase: enhancedData.learningPhase,
        alignmentScores: {
          school: enhancedData.schoolAlignment,
          study: enhancedData.studyAlignment
        },
        assessmentDate: new Date().toISOString(),
        lastUpdated: new Date()
      }, { merge: true })

      setSubmitted(true)
      
      // Redirect after a moment
      setTimeout(() => {
        router.push('/Prep/AboutMe')
      }, 3000)

    } catch (err) {
      console.error('Error saving assessment:', err)
      setError('Failed to save assessment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const Question = ({ label, name, options, description, emoji }: QuestionProps) => (
    <div className="mb-8">
      <fieldset className="space-y-3">
        <legend className="block text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
          {emoji && <span className="text-2xl">{emoji}</span>}
          {label}
        </legend>
        {description && (
          <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded-lg">
            {description}
          </p>
        )}
        <div className="space-y-2">
          {options.map((opt, i) => (
            <label 
              key={i} 
              className={`block bg-white rounded-xl p-4 border-2 transition-all cursor-pointer hover:border-purple-300 hover:shadow-md ${
                formData[name] === opt 
                  ? 'border-purple-500 bg-purple-50 shadow-md' 
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt}
                checked={formData[name] === opt}
                onChange={(e) => handleChange(name, e.target.value)}
                className="sr-only"
              />
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  formData[name] === opt 
                    ? 'border-purple-500 bg-purple-500' 
                    : 'border-gray-300'
                }`}>
                  {formData[name] === opt && (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
                <span className="font-medium text-gray-800">{opt}</span>
              </div>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )

  // Question groups for multi-step form
  const questionGroups = [
    {
      title: "Your Natural Rhythm",
      description: "Tell us about your natural sleep and wake preferences",
      questions: [
        {
          label: "If you didn't have school, what time would you naturally wake up?",
          name: 'naturalWake' as keyof QuizResponses,
          options: ['Before 8 AM', '8–10 AM', 'After 10 AM'],
          emoji: '🌅',
          description: "Think about weekends or holidays when you can wake up naturally without an alarm"
        },
        {
          label: "What time do you fall asleep on weekends/holidays?",
          name: 'bedWeekend' as keyof QuizResponses,
          options: ['Before 10 PM', '10 PM–Midnight', 'After Midnight'],
          emoji: '🌙',
          description: "When you don't have to wake up early the next day"
        },
        {
          label: "How do you feel in the first hour after waking up?",
          name: 'wakeFeel' as keyof QuizResponses,
          options: ['Wide awake', 'A bit slow', 'Super groggy'],
          emoji: '😴'
        }
      ]
    },
    {
      title: "Your Learning Preferences",
      description: "When does your brain work best for different activities?",
      questions: [
        {
          label: "When do you feel most focused and ready to learn?",
          name: 'focusTime' as keyof QuizResponses,
          options: ['Morning', 'Afternoon', 'Evening'],
          emoji: '🧠',
          description: "Think about when you naturally feel most alert and able to concentrate"
        },
        {
          label: "If you had to take a big test, when would you perform your best?",
          name: 'testTime' as keyof QuizResponses,
          options: ['Morning', 'Midday', 'Evening'],
          emoji: '📝',
          description: "Consider when you feel most mentally sharp and confident"
        }
      ]
    },
    {
      title: "Your Current Schedule",
      description: "Tell us about your actual school and study schedule",
      questions: [
        {
          label: "What time do you wake up on school days?",
          name: 'wakeSchool' as keyof QuizResponses,
          options: ['Before 6 AM', '6–6:59 AM', '7–7:59 AM', '8 AM or later'],
          emoji: '⏰'
        },
        {
          label: "What time does school start?",
          name: 'schoolStart' as keyof QuizResponses,
          options: ['Before 7:30 AM', '7:30–8:00 AM', 'After 8:00 AM'],
          emoji: '🏫'
        },
        {
          label: "What time do you get home from school?",
          name: 'homeTime' as keyof QuizResponses,
          options: ['Before 3:30 PM', '3:30–4:30 PM', 'After 4:30 PM'],
          emoji: '🏠'
        },
        {
          label: "When do you usually do your homework/study?",
          name: 'homeworkTime' as keyof QuizResponses,
          options: ['Right after school', 'After dinner', 'Late at night', 'Depends'],
          emoji: '📚',
          description: "Choose the time when you typically do most of your studying"
        }
      ]
    },
    {
      title: "Additional Activities",
      description: "Tell us about your extracurricular commitments",
      questions: [
        {
          label: "What time do your extracurricular classes begin and finish?",
          name: 'extraTime' as keyof QuizResponses,
          options: ['Before 4 PM', '4–6 PM', 'After 6 PM', 'Varies'],
          emoji: '🎯'
        },
        {
          label: "Do you take any extra academic programs?",
          name: 'extras' as keyof QuizResponses,
          options: ['AoPS', 'RSM', 'Kumon', 'Other', 'None'],
          emoji: '📖'
        }
      ]
    }
  ]

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center bg-white/90 backdrop-blur-sm p-10 rounded-3xl shadow-xl max-w-xl border border-white/40"
        >
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-purple-700 mb-4">Assessment Complete!</h2>
          <p className="text-gray-700 mb-6">
            Your personalized learning profile has been created. You'll be redirected to see your results shortly.
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        </motion.div>
      </main>
    )
  }

  const currentGroup = questionGroups[currentStep]
  const isLastStep = currentStep === questionGroups.length - 1
  const canProceed = currentGroup.questions.every(q => formData[q.name])

  return (
    <main className="min-h-screen font-sans bg-gradient-to-br from-yellow-50 to-pink-100 text-gray-900 px-6 py-16">
      <div className="max-w-4xl mx-auto">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-purple-700">
              Chronotype Assessment
            </h1>
            <div className="text-sm text-gray-600">
              Step {currentStep + 1} of {questionGroups.length}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <motion.div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${((currentStep + 1) / questionGroups.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Current Step */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/40 p-8 mb-8"
        >
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {currentGroup.title}
            </h2>
            <p className="text-gray-600">
              {currentGroup.description}
            </p>
          </div>

          <div className="space-y-6">
            {currentGroup.questions.map((question) => (
              <Question key={question.name} {...question} />
            ))}
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              currentStep === 0 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white/50 text-purple-700 hover:bg-white/70 border border-purple-300'
            }`}
          >
            Previous
          </button>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          {isLastStep ? (
            <button
              onClick={handleSubmit}
              disabled={!canProceed || isSubmitting}
              className={`px-8 py-3 rounded-xl font-semibold transition-all ${
                !canProceed || isSubmitting
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg hover:scale-105'
              }`}
            >
              {isSubmitting ? 'Calculating...' : 'Complete Assessment'}
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed}
              className={`px-8 py-3 rounded-xl font-semibold transition-all ${
                !canProceed
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg hover:scale-105'
              }`}
            >
              Next Step
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="text-center mt-8">
          <p className="text-gray-600 text-sm">
            This assessment uses evidence-based chronobiology research to determine your optimal learning times
          </p>
        </div>
      </div>
    </main>
  )
}
