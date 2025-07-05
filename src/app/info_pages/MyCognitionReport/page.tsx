'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface CognitiveResult {
  domain: string
  score: number
  description: string
}

const cognitiveResults: CognitiveResult[] = [
  { domain: 'Reaction Time', score: 320, description: 'Measures how quickly you can respond to a stimulus.' },
  { domain: 'Memory', score: 7, description: 'Assesses short-term working memory through sequence recall.' },
  { domain: 'Attention', score: 85, description: 'Evaluates ability to stay focused and resist distraction.' },
  { domain: 'Processing Speed', score: 290, description: 'Captures how fast you can take in and react to information.' },
  { domain: 'Inhibition Control', score: 3, description: 'Tests ability to resist impulsive actions or ignore distractors.' },
]

export default function MyCognitionReport() {
  const [showDescriptions, setShowDescriptions] = useState<boolean>(true)

  const toggleDescriptions = (): void => {
    setShowDescriptions(!showDescriptions)
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Your Cognition Report</h1>
      <p className="text-center text-gray-400 mb-10 max-w-2xl mx-auto">
        Based on your recent tests, here is an overview of your cognitive strengths and areas for improvement. These insights can guide how sleep and lifestyle impact your mental performance.
      </p>

      <div className="w-full max-w-4xl mx-auto">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={cognitiveResults} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="domain" stroke="#aaa" />
            <YAxis stroke="#aaa" />
            <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', color: '#fff' }} />
            <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {showDescriptions && (
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cognitiveResults.map(({ domain, description }) => (
            <div key={domain} className="bg-gray-900 p-4 rounded-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-2 text-blue-400">{domain}</h2>
              <p className="text-gray-300 text-sm">{description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center mt-10">
        <button
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
          onClick={toggleDescriptions}
        >
          {showDescriptions ? 'Hide Descriptions' : 'Show Descriptions'}
        </button>
      </div>
    </main>
  )
}