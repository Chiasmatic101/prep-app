'use client'

import { useState, useEffect } from 'react'

// TypeScript interfaces
interface Question {
  question: string
  options: string[]
  answer: string
}

interface Answers {
  [key: number]: string
}

const paragraph = `Did you know about Mary Anning? She was a young woman who lived in England over 200 years ago and became one of the first people to discover full dinosaur skeletons. When she was just 12 years old, she found the fossil of a giant sea creature called an ichthyosaur buried in the cliffs near her home. Mary never went to college, but she taught herself about rocks and fossils and made important discoveries that helped scientists understand prehistoric life. Even though most people did not take her seriously at the time because she was a woman and not formally trained, scientists today recognize her as one of the pioneers of paleontology.`

const questions: Question[] = [
  {
    question: 'How old was Mary Anning when she discovered the ichthyosaur fossil?',
    options: ['9 years old', '12 years old', '16 years old', '20 years old'],
    answer: '12 years old',
  },
  {
    question: 'What kind of creature was the ichthyosaur?',
    options: ['A flying dinosaur', 'A giant sea creature', 'A land-dwelling lizard', 'A modern-day whale'],
    answer: 'A giant sea creature',
  },
  {
    question: 'Why did people not take Mary Anning seriously during her lifetime?',
    options: ['She often made up stories', 'She was too young', 'She was not formally trained and was a woman', 'She lived in the United States'],
    answer: 'She was not formally trained and was a woman',
  },
  {
    question: 'What subject did Mary Anning teach herself about?',
    options: ['Astronomy and planets', 'Chemistry and medicine', 'Rocks and fossils', 'Animals and farming'],
    answer: 'Rocks and fossils',
  },
  {
    question: 'What is Mary Anning recognized for today?',
    options: ['Writing books', 'Inventing the microscope', 'Helping scientists understand prehistoric life', 'Starting the first science museum'],
    answer: 'Helping scientists understand prehistoric life',
  },
]

export default function MemoryTestPage() {
  const [hasRead, setHasRead] = useState<boolean>(false)
  const [showQuiz, setShowQuiz] = useState<boolean>(false)
  const [answers, setAnswers] = useState<Answers>({})
  const [score, setScore] = useState<number | null>(null)

  useEffect(() => {
    const readStatus = localStorage.getItem('maryAnningRead')
    if (readStatus === 'true') setHasRead(true)
  }, [])

  const handleMarkAsRead = (): void => {
    localStorage.setItem('maryAnningRead', 'true')
    setHasRead(true)
  }

  const handleAnswerChange = (index: number, option: string): void => {
    setAnswers({ ...answers, [index]: option })
  }

  const handleSubmit = (): void => {
    let correct = 0
    questions.forEach((q, index) => {
      if (answers[index] === q.answer) correct++
    })
    setScore(correct)
  }

  return (
    <main className="p-6 max-w-3xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-4 text-center">Memory Test: Mary Anning</h1>

      {!hasRead && (
        <div className="bg-yellow-100 p-4 rounded-lg shadow mb-6">
          <p className="text-lg text-gray-800">{paragraph}</p>
          <button
            onClick={handleMarkAsRead}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Mark as Read
          </button>
        </div>
      )}

      {hasRead && !showQuiz && (
        <div className="text-center mt-4">
          <p className="text-gray-700 mb-4">You've read the story. Ready to take the quiz?</p>
          <button
            onClick={() => setShowQuiz(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Start Quiz
          </button>
        </div>
      )}

      {showQuiz && (
        <div className="mt-8 space-y-6">
          {questions.map((q, i) => (
            <div key={i} className="bg-white border rounded-lg p-4 shadow">
              <p className="font-medium text-gray-900 mb-2">{i + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, j) => (
                  <label key={j} className="block">
                    <input
                      type="radio"
                      name={`q-${i}`}
                      value={opt}
                      checked={answers[i] === opt}
                      onChange={() => handleAnswerChange(i, opt)}
                      className="mr-2"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="text-center">
            <button
              onClick={handleSubmit}
              className="mt-4 px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Submit Answers
            </button>
          </div>

          {score !== null && (
            <div className="text-center mt-4 text-lg font-semibold">
              You scored {score} out of {questions.length}!
            </div>
          )}
        </div>
      )}
    </main>
  )
}