import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  TrendingUp, 
  TrendingDown, 
  Brain, 
  Target, 
  Clock, 
  Moon, 
  Utensils, 
  Activity, 
  ChevronRight,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Lightbulb,
  Zap,
  Star,
  ArrowRight
} from 'lucide-react'

interface CorrelationInsight {
  factor: string
  outcome: string
  correlation: number
  confidence: number
  sampleSize: number
  timelag: number
  significance: 'high' | 'medium' | 'low'
  trend: 'improving' | 'stable' | 'declining'
}

interface PersonalizedRecommendation {
  id: string
  category: 'sleep' | 'nutrition' | 'activity' | 'timing'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  expectedImprovement: {
    domain: string
    percentageIncrease: number
    confidence: number
  }
  suggestedChallenge?: string
  timeframe: string
  evidence: {
    correlation: number
    basedOnDays: number
    userSpecific: boolean
  }
}

interface FeedbackAnalysis {
  insights: CorrelationInsight[]
  recommendations: PersonalizedRecommendation[]
  progressSummary: {
    overallTrend: 'improving' | 'stable' | 'declining'
    bestPerformingFactors: string[]
    areasForImprovement: string[]
  }
  confidenceLevel: number
}

interface LifestyleFeedbackComponentProps {
  feedbackData?: FeedbackAnalysis
  onStartChallenge: (challengeId: string) => void
  loading?: boolean
}

const LifestyleFeedbackComponent: React.FC<LifestyleFeedbackComponentProps> = ({
  feedbackData,
  onStartChallenge,
  loading = false
}) => {
  const [activeTab, setActiveTab] = useState<'insights' | 'recommendations'>('recommendations')
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null)

  // B1: Use ONLY real feedbackData (no mock data)
  const displayData = feedbackData;

  // B2: Confidence scaling helpers
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

  // Given correlation r and sample n (days), scale to [0,1]
  const confidenceWeight = (r: number, n: number) => {
    const rAbs = Math.min(Math.abs(r), 0.95);
    const size = Math.max(n, 1);
    return clamp01(rAbs * Math.sqrt(size / 14));
  };

  // Scale expected improvement for display (MVP-friendly)
  const scaleImprovement = (basePct: number, r: number, n: number) => {
    return Math.round(basePct * confidenceWeight(r, n));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sleep': return <Moon className="w-5 h-5" />
      case 'nutrition': return <Utensils className="w-5 h-5" />
      case 'activity': return <Activity className="w-5 h-5" />
      case 'timing': return <Clock className="w-5 h-5" />
      default: return <Brain className="w-5 h-5" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'sleep': return 'from-indigo-500 to-purple-600'
      case 'nutrition': return 'from-green-500 to-emerald-600'
      case 'activity': return 'from-blue-500 to-cyan-600'
      case 'timing': return 'from-orange-500 to-yellow-600'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getCorrelationDisplay = (correlation: number) => {
    const strength = Math.abs(correlation)
    const direction = correlation >= 0 ? 'positive' : 'negative'
    
    let strengthText = 'weak'
    if (strength > 0.6) strengthText = 'strong'
    else if (strength > 0.3) strengthText = 'moderate'

    return { direction, strengthText, value: Math.round(Math.abs(correlation) * 100) }
  }

  const getChallengeDisplayName = (challengeId: string) => {
    const challengeNames: Record<string, string> = {
      'evening-dim-down': 'Evening Dim-Down 60',
      'smart-caffeine-window': 'Smart Caffeine Window',
      'fifteen-minute-shift': '15-Minute Shift Week',
      'wake-time-anchor': 'Wake-Time Anchor Streak',
      'consistent-meal-windows': 'Consistent Meal Windows'
    }
    return challengeNames[challengeId] || challengeId
  }

  if (loading) {
    return (
      <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-purple-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!displayData || (displayData.insights.length === 0 && displayData.recommendations.length === 0)) {
    return (
      <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-8 border border-white/40 shadow-lg text-center">
        <div className="text-4xl mb-4">📊</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Building Your Feedback Profile</h3>
        <p className="text-gray-600 mb-4">
          Keep tracking your sleep, nutrition, and brain games for 7+ days to see personalized insights and recommendations.
        </p>
        <div className="text-sm text-gray-500">
          We need more data points to identify patterns between your lifestyle and cognitive performance.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Overall Progress */}
      <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Your Lifestyle Impact</h2>
              <p className="text-gray-600">AI-powered insights from your personal data</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              displayData.progressSummary.overallTrend === 'improving' ? 'bg-green-100 text-green-800' :
              displayData.progressSummary.overallTrend === 'stable' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {displayData.progressSummary.overallTrend === 'improving' ? <TrendingUp className="w-4 h-4" /> : 
               displayData.progressSummary.overallTrend === 'stable' ? <Target className="w-4 h-4" /> :
               <TrendingDown className="w-4 h-4" />}
              {displayData.progressSummary.overallTrend}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {Math.round(displayData.confidenceLevel * 100)}% confidence
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-50/50 rounded-lg">
            <div className="text-lg font-bold text-purple-700">{displayData.insights.length}</div>
            <div className="text-xs text-gray-600">Key Insights</div>
          </div>
          <div className="text-center p-3 bg-gray-50/50 rounded-lg">
            <div className="text-lg font-bold text-green-700">{displayData.recommendations.length}</div>
            <div className="text-xs text-gray-600">Recommendations</div>
          </div>
          <div className="text-center p-3 bg-gray-50/50 rounded-lg">
            <div className="text-lg font-bold text-blue-700">
              {displayData.progressSummary.bestPerformingFactors.length}
            </div>
            <div className="text-xs text-gray-600">Strong Factors</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-white/60 rounded-xl p-1 shadow-lg backdrop-blur-sm">
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
            activeTab === 'recommendations'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-gray-700 hover:bg-white/80'
          }`}
        >
          <Lightbulb className="w-4 h-4 inline mr-2" />
          Recommendations
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
            activeTab === 'insights'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-gray-700 hover:bg-white/80'
          }`}
        >
          <Brain className="w-4 h-4 inline mr-2" />
          Data Insights
        </button>
      </div>

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {displayData.recommendations.map((rec, index) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white/40 backdrop-blur-sm rounded-xl p-6 border border-white/40 shadow-lg hover:shadow-xl transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl bg-gradient-to-r ${getCategoryColor(rec.category)} text-white`}>
                    {getCategoryIcon(rec.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-gray-800">{rec.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(rec.priority)}`}>
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">{rec.description}</p>
                  </div>
                </div>
              </div>

              {/* Expected Improvement with B2 confidence scaling */}
              <div className="bg-green-50/80 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-green-800">Expected Improvement</span>
                </div>
                <div className="text-2xl font-bold text-green-700 mb-1">
                  +{scaleImprovement(
                    rec.expectedImprovement.percentageIncrease,
                    rec.evidence.correlation,
                    rec.evidence.basedOnDays
                  )}%
                </div>
                <div className="text-sm text-green-600">
                  {rec.expectedImprovement.domain} • {Math.round(confidenceWeight(rec.evidence.correlation, rec.evidence.basedOnDays) * 100)}% confidence
                </div>
              </div>

              {/* Evidence */}
              <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-4">
                  <span>📊 {rec.evidence.basedOnDays} days of data</span>
                  <span>🎯 {Math.round(Math.abs(rec.evidence.correlation) * 100)}% correlation</span>
                  <span>⏱️ {rec.timeframe}</span>
                </div>
              </div>

              {/* Action Button */}
              {rec.suggestedChallenge && (
                <button
                  onClick={() => onStartChallenge(rec.suggestedChallenge!)}
                  className={`w-full bg-gradient-to-r ${getCategoryColor(rec.category)} hover:opacity-90 text-white py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 group`}
                >
                  <Star className="w-4 h-4" />
                  Start "{getChallengeDisplayName(rec.suggestedChallenge)}" Challenge
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {displayData.insights.map((insight, index) => {
            const correlationData = getCorrelationDisplay(insight.correlation)
            const isExpanded = expandedInsight === insight.factor + insight.outcome
            
            return (
              <motion.div
                key={insight.factor + insight.outcome}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-white/40 backdrop-blur-sm rounded-xl border border-white/40 shadow-lg hover:shadow-xl transition-all"
              >
                <button
                  onClick={() => setExpandedInsight(isExpanded ? null : insight.factor + insight.outcome)}
                  className="w-full p-6 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-800">
                          {insight.factor} → {insight.outcome}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          insight.significance === 'high' ? 'bg-red-100 text-red-800' :
                          insight.significance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {insight.significance}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          insight.trend === 'improving' ? 'bg-green-100 text-green-800' :
                          insight.trend === 'stable' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {insight.trend}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className={`font-semibold ${
                          correlationData.direction === 'positive' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {correlationData.value}% {correlationData.direction} {correlationData.strengthText} correlation
                        </span>
                        <span>📈 {insight.sampleSize} data points</span>
                        <span>⏱️ {insight.timelag}h lag</span>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`} />
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-6 pb-6"
                    >
                      <div className="bg-gray-50/80 rounded-lg p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Correlation Strength:</span>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    correlationData.direction === 'positive' ? 'bg-green-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${correlationData.value}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">{correlationData.value}%</span>
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Confidence Level:</span>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full bg-blue-500"
                                  style={{ width: `${Math.round(insight.confidence * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">{Math.round(insight.confidence * 100)}%</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">What this means:</span> Your {insight.factor.toLowerCase()} has a{' '}
                          {correlationData.direction === 'positive' ? 'positive' : 'negative'} relationship with your{' '}
                          {insight.outcome.toLowerCase()}. This pattern is{' '}
                          {insight.trend === 'improving' ? 'getting stronger' : 
                           insight.trend === 'stable' ? 'consistent' : 'weakening'} over time.
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Best Performing Factors Summary */}
      {displayData.progressSummary.bestPerformingFactors.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-green-800">Your Strongest Lifestyle Factors</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {displayData.progressSummary.bestPerformingFactors.map(factor => (
              <span
                key={factor}
                className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-medium"
              >
                {factor}
              </span>
            ))}
          </div>
          <p className="text-sm text-green-700 mt-2">
            Keep doing what you're doing with these factors - they're clearly benefiting your cognitive performance!
          </p>
        </div>
      )}
    </div>
  )
}

export default LifestyleFeedbackComponent
