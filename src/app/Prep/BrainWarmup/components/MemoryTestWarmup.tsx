'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'

interface WarmupGameProps {
  duration: number
  onComplete: () => void
  timeLeft: number
  isActive: boolean
}

interface MemoryImage {
  id: string
  src: string
  alt: string
}

// Study images (these will be shown to memorize)
const STUDY_IMAGES: MemoryImage[] = [
  { id: 'study-1', src: '/images/memory-test/study-1.png', alt: 'Study Image 1' },
  { id: 'study-2', src: '/images/memory-test/study-2.png', alt: 'Study Image 2' },
  { id: 'study-3', src: '/images/memory-test/study-3.png', alt: 'Study Image 3' },
  { id: 'study-4', src: '/images/memory-test/study-4.png', alt: 'Study Image 4' },
  { id: 'study-5', src: '/images/memory-test/study-5.png', alt: 'Study Image 5' },
  { id: 'study-6', src: '/images/memory-test/study-6.png', alt: 'Study Image 6' },
]

// Distractor images (new images that weren't studied)
const DISTRACTOR_IMAGES: MemoryImage[] = [
  { id: 'distractor-1', src: '/images/memory-test/distractor-1.png', alt: 'Distractor 1' },
  { id: 'distractor-2', src: '/images/memory-test/distractor-2.png', alt: 'Distractor 2' },
  { id: 'distractor-3', src: '/images/memory-test/distractor-3.png', alt: 'Distractor 3' },
  { id: 'distractor-4', src: '/images/memory-test/distractor-4.png', alt: 'Distractor 4' },
  { id: 'distractor-5', src: '/images/memory-test/distractor-5.png', alt: 'Distractor 5' },
  { id: 'distractor-6', src: '/images/memory-test/distractor-6.png', alt: 'Distractor 6' },
  { id: 'distractor-7', src: '/images/memory-test/distractor-7.png', alt: 'Distractor 7' },
  { id: 'distractor-8', src: '/images/memory-test/distractor-8.png', alt: 'Distractor 8' },
]

export default function MemoryTestWarmup({ duration, onComplete, timeLeft, isActive }: WarmupGameProps) {
  const [phase, setPhase] = useState<'study' | 'transition' | 'test' | 'complete'>('study')
  const [studyImages] = useState<MemoryImage[]>(STUDY_IMAGES)
  const [testSequence, setTestSequence] = useState<MemoryImage[]>([])
  const [currentStudyIndex, setCurrentStudyIndex] = useState(0)
  const [currentTestIndex, setCurrentTestIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correctResponses, setCorrectResponses] = useState(0)
  const [totalResponses, setTotalResponses] = useState(0)
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [studyTimeLeft, setStudyTimeLeft] = useState(18) // 18 seconds total for study (3s × 6 images)
  const [transitionTime, setTransitionTime] = useState(3) // 3 second transition
  
  const studyTimerRef = useRef<NodeJS.Timeout | null>(null)
  const testTimerRef = useRef<NodeJS.Timeout | null>(null)
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null)
  const imageAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Start study phase when active
  useEffect(() => {
    if (isActive && phase === 'study') {
      startStudyPhase()
    }
  }, [isActive])

  const startStudyPhase = () => {
    setCurrentStudyIndex(0)
    setStudyTimeLeft(18) // 18 seconds total (3 seconds × 6 images)
    
    // Show images one by one (3 seconds each for 6 images = 18 seconds)
    let imageIndex = 0
    
    const showNextStudyImage = () => {
      if (imageIndex < studyImages.length - 1) {
        imageAdvanceTimerRef.current = setTimeout(() => {
          imageIndex++
          setCurrentStudyIndex(imageIndex)
          showNextStudyImage() // Recursive call for next image
        }, 3000) // 3 seconds per image
      } else {
        // All images shown, wait 3 seconds for last image then start transition
        imageAdvanceTimerRef.current = setTimeout(() => {
          setPhase('transition')
          setTransitionTime(3)
          
          const transitionTimer = setInterval(() => {
            setTransitionTime(prev => {
              if (prev <= 1) {
                clearInterval(transitionTimer)
                startTestPhase()
                return 0
              }
              return prev - 1
            })
          }, 1000)
        }, 3000) // Wait 3 seconds for the last image
      }
    }
    
    // Start showing images
    showNextStudyImage()
    
    // Overall study timer
    studyTimerRef.current = setInterval(() => {
      setStudyTimeLeft(prev => prev - 1)
    }, 1000)
  }

  const startTestPhase = () => {
    if (studyTimerRef.current) clearInterval(studyTimerRef.current)
    
    // Create test sequence: include some studied images + distractors
    const testImages: MemoryImage[] = []
    
    // Add 4 studied images
    const studiedToInclude = [...studyImages].sort(() => 0.5 - Math.random()).slice(0, 4)
    testImages.push(...studiedToInclude)
    
    // Add 6 distractor images
    const distractors = [...DISTRACTOR_IMAGES].sort(() => 0.5 - Math.random()).slice(0, 6)
    testImages.push(...distractors)
    
    // Shuffle the test sequence
    testImages.sort(() => 0.5 - Math.random())
    
    setTestSequence(testImages)
    setPhase('test')
    setCurrentTestIndex(0)
  }

  const handleResponse = (seenBefore: boolean) => {
    if (!isActive || showFeedback) return
    
    const currentImage = testSequence[currentTestIndex]
    const wasStudied = studyImages.some(img => img.id === currentImage.id)
    const isCorrect = (wasStudied && seenBefore) || (!wasStudied && !seenBefore)
    
    setTotalResponses(prev => prev + 1)
    
    if (isCorrect) {
      setScore(prev => prev + 1)
      setCorrectResponses(prev => prev + 1)
      setShowFeedback('correct')
    } else {
      setShowFeedback('wrong')
    }
    
    // Show feedback briefly then move to next
    feedbackTimerRef.current = setTimeout(() => {
      setShowFeedback(null)
      if (currentTestIndex < testSequence.length - 1) {
        setCurrentTestIndex(prev => prev + 1)
      } else {
        // Test complete - trigger completion immediately
        setPhase('complete')
        // Auto-advance to next stage after brief delay
        setTimeout(() => {
          onComplete()
        }, 2000) // 2 second delay to show completion stats
      }
    }, 1200) // Longer feedback display (1.2 seconds)
  }

  // Auto-advance if no response in test phase - REMOVED AUTO-ADVANCE
  useEffect(() => {
    // No auto-advance - wait for user response
    return () => {
      if (testTimerRef.current) clearTimeout(testTimerRef.current)
    }
  }, [currentTestIndex, phase, showFeedback, isActive])

  // Cleanup
  useEffect(() => {
    return () => {
      if (studyTimerRef.current) clearInterval(studyTimerRef.current)
      if (testTimerRef.current) clearTimeout(testTimerRef.current)
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      if (imageAdvanceTimerRef.current) clearTimeout(imageAdvanceTimerRef.current)
    }
  }, [])

  const getAccuracy = () => {
    return totalResponses > 0 ? Math.round((correctResponses / totalResponses) * 100) : 0
  }

  if (phase === 'study') {
    const currentImage = studyImages[currentStudyIndex]
    
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center max-w-md w-full">
          <div className="mb-6">
            <div className="text-2xl font-bold mb-2">Study This Image</div>
            <div className="text-lg opacity-90">
              Memorize it! ({Math.ceil(studyTimeLeft)}s remaining)
            </div>
            <div className="text-sm opacity-75 mt-1">
              Image {currentStudyIndex + 1} of {studyImages.length}
            </div>
          </div>
          
          <div className="bg-white/10 rounded-xl p-4 mb-6 shadow-lg">
            <div className="relative w-64 h-64 mx-auto rounded-lg overflow-hidden">
              <Image
                src={currentImage.src}
                alt={currentImage.alt}
                fill
                className="object-cover"
                priority
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI1NiIgaGVpZ2h0PSIyNTYiIGZpbGw9IiM2NjY2NjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMTYiPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4='
                }}
              />
            </div>
          </div>
          
          <div className="flex justify-center gap-2 mb-4">
            {studyImages.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index < currentStudyIndex 
                    ? 'bg-green-400' 
                    : index === currentStudyIndex 
                      ? 'bg-blue-400' 
                      : 'bg-white/30'
                }`}
              />
            ))}
          </div>
          
          <div className="text-sm opacity-75">
            Remember this image carefully!
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'transition') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center max-w-md w-full">
          <div className="mb-8">
            <div className="text-3xl font-bold mb-4">Get Ready!</div>
            <div className="text-lg opacity-90">
              Now you'll see images one at a time.
            </div>
            <div className="text-lg opacity-90">
              Decide if you've seen each one before.
            </div>
          </div>
          
          <div className="text-6xl font-bold text-blue-400 mb-4">
            {transitionTime}
          </div>
          
          <div className="text-sm opacity-75">
            Be quick and accurate!
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'test') {
    const currentImage = testSequence[currentTestIndex]
    
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center max-w-md w-full">
          <div className="mb-6">
            <div className="text-2xl font-bold mb-2">Memory Test</div>
            <div className="flex justify-center gap-4 text-sm opacity-90">
              <span>Score: {score}</span>
              <span>Accuracy: {getAccuracy()}%</span>
              <span>{currentTestIndex + 1}/{testSequence.length}</span>
            </div>
          </div>
          
          <div className="mb-6 flex justify-center">
            {showFeedback ? (
              <div className={`text-8xl ${showFeedback === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                {showFeedback === 'correct' ? '✓' : '✗'}
              </div>
            ) : (
              <div className="bg-white/10 rounded-xl p-4 shadow-lg">
                <div className="relative w-64 h-64 rounded-lg overflow-hidden">
                  <Image
                    src={currentImage.src}
                    alt={currentImage.alt}
                    fill
                    className="object-cover"
                    priority
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI1NiIgaGVpZ2h0PSIyNTYiIGZpbGw9IiM2NjY2NjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMTYiPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4='
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          
          {!showFeedback && (
            <>
              <div className="text-lg mb-6">Have you seen this image before?</div>
              
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => handleResponse(true)}
                  className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors text-lg"
                >
                  YES
                </button>
                <button
                  onClick={() => handleResponse(false)}
                  className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors text-lg"
                >
                  NO
                </button>
              </div>
              
              <div className="mt-4 text-sm opacity-75">
                Take your time - no rush!
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center max-w-md w-full">
          <div className="mb-8">
            <div className="text-3xl font-bold mb-4">Memory Test Complete!</div>
            <div className="text-lg opacity-90">Excellent visual memory training! 🧠</div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/20 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">{score}</div>
              <div className="text-sm opacity-75">Correct</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-400">{getAccuracy()}%</div>
              <div className="text-sm opacity-75">Accuracy</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <div className="text-3xl font-bold text-yellow-400">{totalResponses}</div>
              <div className="text-sm opacity-75">Total Answers</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <div className="text-3xl font-bold text-purple-400">{studyImages.length}</div>
              <div className="text-sm opacity-75">Images Studied</div>
            </div>
          </div>
          
          <div className="text-sm opacity-75">
            Moving to next activity in 2 seconds... ⚡
          </div>
        </div>
      </div>
    )
  }

  return null
}