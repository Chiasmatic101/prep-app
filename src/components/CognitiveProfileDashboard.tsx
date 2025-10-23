

import React, { useState } from 'react';
import { useCognitiveProfile } from '../hooks/useCognitiveProflie';
import { Brain, TrendingUp, Award, Clock, RefreshCw } from 'lucide-react';
import { auth } from '@/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

export const CognitiveProfileDashboard = () => {
  const { profile, loading, error, refreshProfile } = useCognitiveProfile();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

 const generateProfile = async () => {
  // Wait for auth to be ready
  return new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe() // Unsubscribe immediately after getting user
      
      if (!user) {
        setGenerateError('No user logged in. Please sign in first.');
        setGenerating(false);
        resolve();
        return;
      }

      console.log('🔄 Generating profile for user:', user.uid);
      
      setGenerating(true);
      setGenerateError(null);

      try {
        const response = await fetch(
          `https://us-central1-prepapp-fae61.cloudfunctions.net/testCognitiveAggregation?userId=${user.uid}`
        );
        
        console.log('📡 Response status:', response.status);
        
        const data = await response.json();
        console.log('📊 Response data:', data);
        
        if (data.success) {
          console.log('✅ Profile generated successfully!', data);
          setGenerateError(null);
          // Refresh after 2 seconds
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          setGenerateError(data.error || 'Failed to generate profile');
          console.error('❌ Error:', data.error);
        }
      } catch (err) {
        console.error('❌ Network error:', err);
        setGenerateError('Network error. Check console for details.');
      } finally {
        setGenerating(false);
        resolve();
      }
    });
  });
};

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading cognitive profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-bold mb-2">Error Loading Profile</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <Brain className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Profile Data Yet</h2>
          <p className="text-gray-600 mb-6">
            Play some games to generate your cognitive profile, or click below to generate it now from your existing game data.
          </p>
          
          {generateError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-600 text-sm">{generateError}</p>
            </div>
          )}
          
          <button
            onClick={generateProfile}
            disabled={generating}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Generating Profile...
              </>
            ) : (
              <>
                <Brain className="w-5 h-5" />
                Generate My Profile Now
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-500 mt-4">
            This will analyze all your game sessions and create your cognitive profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Your Cognitive Profile</h1>
        <button
          onClick={refreshProfile}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Data Quality Badge */}
      <div className="bg-white rounded-lg p-4 shadow">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold">Data Quality: {profile.dataQuality.reliability}/100</span>
        </div>
        <div className="text-sm text-gray-600 mt-2">
          Based on {profile.totalSessions} sessions across {profile.totalGamesPlayed} games
        </div>
      </div>

      {/* Rest of your dashboard... */}
      {/* Domain Scores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
       {Object.entries(profile.domains).map(([domain, score]: [string, any]) => (
          <div key={domain} className="bg-white rounded-lg p-4 shadow">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold capitalize">{domain.replace(/([A-Z])/g, ' $1')}</h3>
              <span className="text-xs text-gray-500">{Math.round(score.confidence * 100)}% confident</span>
            </div>
            
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {score.current}
              <span className="text-sm text-gray-500 ml-2">/ 100</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-green-600">
                {profile.trends[domain]?.weeklyChange > 0 ? '+' : ''}
                {profile.trends[domain]?.weeklyChange.toFixed(1)}% this week
              </span>
            </div>
            
            <div className="mt-2 text-xs text-gray-500">
              Percentile: {profile.percentiles[domain]}th
            </div>
            
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span>7d avg</span>
                <span className="font-semibold">{score.average7d}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>30d avg</span>
                <span className="font-semibold">{score.average30d}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Personal best</span>
                <span className="font-semibold text-yellow-600">{score.personalBest}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cross-Game Metrics */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-bold mb-4">Cross-Game Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard 
            label="Decision Time" 
            value={`${profile.metrics.averageDecisionTime}ms`}
            icon={<Clock className="w-5 h-5" />}
          />
          <MetricCard 
            label="Strategic Consistency" 
            value={`${profile.metrics.strategicConsistency}%`}
            icon={<Brain className="w-5 h-5" />}
          />
          <MetricCard 
            label="Error Rate" 
            value={`${profile.metrics.errorRate}%`}
            icon={<Brain className="w-5 h-5" />}
          />
          <MetricCard 
            label="Learning Rate" 
            value={`${profile.metrics.learningRate > 0 ? '+' : ''}${profile.metrics.learningRate}%`}
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Peak Performance Insights */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-bold mb-4">Peak Performance Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">Best Time of Day</div>
            <div className="text-2xl font-bold">
              {Math.floor(profile.peakPerformance.bestTimeOfDay)}:
              {String(Math.floor((profile.peakPerformance.bestTimeOfDay % 1) * 60)).padStart(2, '0')}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Optimal Session Duration</div>
            <div className="text-2xl font-bold">{profile.peakPerformance.optimalSessionDuration} min</div>
          </div>
        </div>
      </div>

      {/* Game Contributions */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-bold mb-4">Game Contributions</h2>
        {Object.entries(profile.contributions).map(([domain, games]: [string, any[]]) => (
          games.length > 0 && (
            <div key={domain} className="mb-4">
              <h3 className="font-semibold capitalize mb-2">
                {domain.replace(/([A-Z])/g, ' $1')}
              </h3>
              <div className="space-y-1">
                {games.map((game, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{game.gameType}</span>
                    <span className="text-gray-500">
                      {game.sessionCount} sessions • {Math.round(game.reliability * 100)}% reliability
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="bg-gray-50 rounded-lg p-4">
    <div className="flex items-center gap-2 text-gray-600 mb-1">
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
    <div className="text-2xl font-bold">{value}</div>
  </div>
);
