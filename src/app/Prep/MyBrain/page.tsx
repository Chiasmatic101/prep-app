'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar } from 'recharts'

interface CognitiveScore {
  date: string
  displayDate: string
  memory: number
  attention: number
  recall: number
  problemSolving: number
  creativity: number
  timestamp?: any
}

interface DomainData {
  domain: string
  average: number
  emoji: string
  latest: number
}

export default function MyBrainPage() {
  const [cognitiveData, setCognitiveData] = useState<CognitiveScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<string>('memory')
  const [timeRange, setTimeRange] = useState<string>('30d')
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid)
        await fetchCognitiveScores(user.uid)
      } else {
        router.push('/auth')
      }
    })

    return () => unsubscribe()
  }, [router])

  const fetchCognitiveScores = async (uid: string) => {
    try {
      setLoading(true)
      const scoresCollection = collection(db, 'users', uid, 'dailyCognitiveScores')
      const scoresQuery = query(scoresCollection, orderBy('timestamp', 'desc'), limit(30))
      const scoresSnapshot = await getDocs(scoresQuery)
      
      const scores: CognitiveScore[] = []
      scoresSnapshot.forEach((doc) => {
        const data = doc.data()
        const date = doc.id // Document ID is the date (YYYY-MM-DD)
        
        scores.push({
          date,
          displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          memory: data.memory || 0,
          attention: data.attention || 0,
          recall: data.recall || 0,
          problemSolving: data.problemSolving || 0,
          creativity: data.creativity || 0,
          timestamp: data.timestamp
        })
      })
      
      // Sort by date ascending for proper chart display
      scores.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      
      setCognitiveData(scores)
      setError('')
    } catch (err) {
      console.error('Error fetching cognitive scores:', err)
      setError('Failed to load cognitive data')
    } finally {
      setLoading(false)
    }
  }

  // Get latest scores for radar chart
  const getLatestScores = () => {
    if (!cognitiveData.length) return []
    
    const latest = cognitiveData[cognitiveData.length - 1]
    return [
      { domain: 'Memory', score: latest.memory, fullMark: 100 },
      { domain: 'Attention', score: latest.attention, fullMark: 100 },
      { domain: 'Recall', score: latest.recall, fullMark: 100 },
      { domain: 'Problem Solving', score: latest.problemSolving, fullMark: 100 },
      { domain: 'Creativity', score: latest.creativity, fullMark: 100 },
    ]
  }

  // Get average scores
  const getAverageScores = (): DomainData[] => {
    if (!cognitiveData.length) return []
    
    const domains = ['memory', 'attention', 'recall', 'problemSolving', 'creativity']
    const domainNames = ['Memory', 'Attention', 'Recall', 'Problem Solving', 'Creativity']
    
    return domains.map((domain, index) => {
      const avg = cognitiveData.reduce((sum, day) => sum + (day[domain as keyof CognitiveScore] as number || 0), 0) / cognitiveData.length
      const latest = cognitiveData.length ? cognitiveData[cognitiveData.length - 1][domain as keyof CognitiveScore] as number : 0
      
      return {
        domain: domainNames[index],
        average: Math.round(avg),
        latest: latest || 0,
        emoji: getDomainEmoji(domainNames[index])
      }
    })
  }

  const getDomainEmoji = (domain: string) => {
    switch (domain) {
      case 'Memory': return '🧠'
      case 'Attention': return '👁️'
      case 'Recall': return '💭'
      case 'Problem Solving': return '🧩'
      case 'Creativity': return '🎨'
      default: return '📊'
    }
  }

  const getDomainColor = (domain: string) => {
    switch (domain.toLowerCase()) {
      case 'memory': return '#8B5CF6' // Purple
      case 'attention': return '#EC4899' // Pink
      case 'recall': return '#06B6D4' // Cyan
      case 'problemsolving': 
      case 'problem solving': return '#10B981' // Green
      case 'creativity': return '#F59E0B' // Orange
      default: return '#6B7280'
    }
  }

  // Convert domain name for data key
  const getDomainKey = (domain: string) => {
    return domain.toLowerCase().replace(' ', '')
  }

  const latestScores = getLatestScores()
  const averageScores = getAverageScores()

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Loading your cognitive data...</p>
        </motion.div>
      </main>
    )
  }

  if (error || !cognitiveData.length) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-white/40 backdrop-blur-sm p-10 rounded-[2rem] border border-white/40 shadow-lg max-w-md"
        >
          <div className="text-4xl mb-4">🧠</div>
          <h2 className="text-2xl font-bold text-purple-700 mb-4">No Cognitive Data Yet</h2>
          <p className="text-gray-700 mb-6">
            {error || "Complete some cognitive assessments to see your brain performance data here."}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/cognitive-assessment')}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-6 py-3 rounded-full font-medium transition-all hover:scale-105 w-full"
            >
              🧪 Start Assessment
            </button>
            <button
              onClick={() => router.push('/about-me')}
              className="bg-white/50 backdrop-blur-sm hover:bg-white/70 text-purple-700 px-6 py-3 rounded-full font-medium border border-purple-300 transition-all hover:scale-105 w-full"
            >
              👤 Back to Profile
            </button>
          </div>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen font-sans bg-gradient-to-br from-yellow-50 to-pink-100 text-gray-900 px-6 py-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            <span className="text-purple-700">My Brain</span> 🧠
          </h1>
          <p className="text-lg text-gray-700">
            Track your cognitive performance across key domains • {cognitiveData.length} days of data
          </p>
        </motion.div>

        {/* Current Performance Overview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          <h2 className="text-2xl font-bold text-purple-700 mb-6 text-center">
            📊 Current Performance Snapshot
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Radar Chart */}
            <div className="bg-white/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Latest Scores</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={latestScores}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="domain" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#8B5CF6"
                    fill="#8B5CF6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Average Scores Bar Chart */}
            <div className="bg-white/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Performance Averages</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={averageScores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="domain" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="average" fill="#EC4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Domain Performance Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
        >
          {averageScores.map((item, index) => (
            <div
              key={item.domain}
              className={`bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/40 shadow-lg text-center cursor-pointer transition-all hover:scale-105 ${
                selectedDomain === item.domain.toLowerCase().replace(' ', '') ? 'ring-2 ring-purple-500 bg-white/60' : ''
              }`}
              onClick={() => setSelectedDomain(item.domain.toLowerCase().replace(' ', ''))}
            >
              <div className="text-2xl mb-2">{item.emoji}</div>
              <h3 className="font-semibold text-sm text-gray-800 mb-1">{item.domain}</h3>
              <div className="text-lg font-bold text-purple-700">{item.latest}</div>
              <div className="text-xs text-gray-600">latest • avg {item.average}</div>
            </div>
          ))}
        </motion.div>

        {/* Detailed Performance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-purple-700 mb-4 md:mb-0">
              📈 {averageScores.find(s => s.domain.toLowerCase().replace(' ', '') === selectedDomain)?.domain || 'Memory'} Performance Over Time
            </h2>
            <div className="text-sm text-gray-600">
              {cognitiveData.length} days • Last updated: {cognitiveData.length ? new Date(cognitiveData[cognitiveData.length - 1].date).toLocaleDateString() : 'N/A'}
            </div>
          </div>

          <div className="bg-white/50 rounded-xl p-6">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={cognitiveData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayDate" />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  labelFormatter={(label) => `Date: ${label}`}
                  formatter={(value, name) => [`${value}`, name]}
                />
                <Line 
                  type="monotone" 
                  dataKey={selectedDomain} 
                  stroke={getDomainColor(selectedDomain)} 
                  strokeWidth={3}
                  dot={{ fill: getDomainColor(selectedDomain), strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Insights Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          <h2 className="text-2xl font-bold text-purple-700 mb-6 text-center">
            💡 Cognitive Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-semibold text-gray-800 mb-2">Best Performance</h3>
              <p className="text-sm text-gray-600">
                Your {averageScores.length ? averageScores.reduce((best, current) => 
                  current.average > best.average ? current : best
                ).domain : 'Memory'} scores are consistently strong
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">📈</div>
              <h3 className="font-semibold text-gray-800 mb-2">Data Collection</h3>
              <p className="text-sm text-gray-600">
                {cognitiveData.length} days of cognitive performance data collected
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-semibold text-gray-800 mb-2">Quick Tip</h3>
              <p className="text-sm text-gray-600">
                Take cognitive assessments during your peak hours for best results
              </p>
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
              onClick={() => router.push('/cognitive-assessment')}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105"
            >
              🧪 Take Assessment
            </button>
            <button
              onClick={() => router.push('/about-me')}
              className="bg-white/50 backdrop-blur-sm hover:bg-white/70 text-purple-700 px-8 py-3 rounded-full font-semibold border border-purple-300 transition-all hover:scale-105"
            >
              👤 Back to Profile
            </button>
          </div>
          <p className="text-gray-600 text-sm">
            Regular cognitive assessments help track your mental performance and identify optimal learning times
          </p>
        </motion.div>
      </div>
    </main>
  )
}