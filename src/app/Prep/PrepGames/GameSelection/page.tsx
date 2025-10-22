'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const games = [
  { 
    title: 'Running Reaction', 
    path: '/Prep/PrepGames/Running_Reaction_Prep',
    description: 'Test your reaction speed and agility',
    icon: '🏃‍♂️',
    color: 'from-green-100 to-blue-100',
    hoverColor: 'from-green-200 to-blue-200',
    category: 'Reaction',
    difficulty: 'Normal'
  },

{ 
    title: 'Brain Battle', 
    path: '/Prep/PrepGames/BrainBattle',
    description: 'Test your processing speed and agility ',
    icon: '🥷',
    color: 'from-green-100 to-blue-100',
    hoverColor: 'from-green-200 to-blue-200',
    category: 'Reaction',
    difficulty: 'Variable'
  },

{ 
    title: 'Tone', 
    path: '/Prep/PrepGames/Tone',
    description: 'Test your audio memory',
    icon: '👂',
    color: 'from-green-100 to-blue-100',
    hoverColor: 'from-green-200 to-blue-200',
    category: 'Reaction',
    difficulty: 'Variable'
  },

{ 
    title: 'Card Match', 
    path: '/Prep/PrepGames/CardMatch',
    description: 'Test your short term memory ',
    icon: '♣️',
    color: 'from-green-100 to-blue-100',
    hoverColor: 'from-green-200 to-blue-200',
    category: 'Reaction',
    difficulty: 'Variable'
  },


{ 
    title: 'NeonMills', 
    path: '/Prep/PrepGames/NeonMills',
    description: 'Test your problem solving skills',
    icon: '👩‍🔬',
    color: 'from-green-100 to-blue-100',
    hoverColor: 'from-green-200 to-blue-200',
    category: 'Reaction',
    difficulty: 'Normal'
  },

{ 
    title: 'TicTacToeExtreme', 
    path: '/Prep/PrepGames/TicTacToe',
    description: 'Test your analytical skills',
    icon: '🎲',
    color: 'from-green-100 to-blue-100',
    hoverColor: 'from-green-200 to-blue-200',
    category: 'Reaction',
    difficulty: 'Variable'
  },

{ 
    title: 'Number Memory Game', 
    path: '/Prep/PrepGames/NumberSequence',
    description: 'Test your short term memory',
    icon: '📝',
    color: 'from-green-100 to-blue-100',
    hoverColor: 'from-green-200 to-blue-200',
    category: 'Reaction',
    difficulty: 'Variable'
  },


  { 
    title: 'Pattern Matching', 
    path: '/Prep/PrepGames/PatternMemoryGame',
    description: 'Short term visual memory',
    icon: '🏝️',
    color: 'from-orange-100 to-red-100',
    hoverColor: 'from-orange-200 to-red-200',
    category: 'Strategy',
    difficulty: 'Variable'
  },
  { 
    title: 'Color Quick', 
    path: '/Prep/PrepGames/ColorQuick_Prep',
    description: 'Rapid color recognition and response',
    icon: '🌈',
    color: 'from-pink-100 to-purple-100',
    hoverColor: 'from-pink-200 to-purple-200',
    category: 'Attention',
    difficulty: 'Moderate'
  },
  { 
    title: 'Runaway Train', 
    path: '/Prep/PrepGames/RailwayGame',
    description: 'Keep the Trains at a safe distance',
    icon: '🚂',
    color: 'from-purple-100 to-blue-100',
    hoverColor: 'from-purple-200 to-blue-200',
    category: 'Processing',
    difficulty: 'Moderate'
  },
{ 
    title: 'Color Sort', 
    path: '/Prep/PrepGames/ColorSortPrep',
    description: 'Organize and categorize with speed',
    icon: '🎨',
    color: 'from-purple-100 to-blue-100',
    hoverColor: 'from-purple-200 to-blue-200',
    category: 'Processing',
    difficulty: 'Moderate'
  },

    { 
    title: 'Memory Sequence', 
    path: '/Prep/PrepGames/MemorySequence_Prep',
    description: 'Remember patterns and sequences',
    icon: '🔢',
    color: 'from-cyan-100 to-teal-100',
    hoverColor: 'from-cyan-200 to-teal-200',
    category: 'Memory',
    difficulty: 'Moderate'
  },

 { 
    title: 'Island Survival', 
    path: '/Prep/PrepGames/SurvivalGamePrep',
    description: 'Test your mood and problem solving skills',
    icon: '🏝️',
    color: 'from-cyan-100 to-teal-100',
    hoverColor: 'from-cyan-200 to-teal-200',
    category: 'Mood',
    difficulty: 'Moderate'
  },
  { 
    title: 'Memory Test', 
    path: '/Prep/PrepGames/MemoryTest_Prep',
    description: 'Comprehensive memory assessment',
    icon: '💭',
    color: 'from-indigo-100 to-purple-100',
    hoverColor: 'from-indigo-200 to-purple-200',
    category: 'Memory',
    difficulty: 'Easy'
  },
  { 
    title: 'Racing Reaction', 
    path: '/Prep/PrepGames/Racing_Reaction_Prep',
    description: 'High-speed reaction challenges',
    icon: '🏎️',
    color: 'from-yellow-100 to-orange-100',
    hoverColor: 'from-yellow-200 to-orange-200',
    category: 'Reaction',
    difficulty: 'Hard'
  }
]

export default function GameGrid() {
  const [hoveredGame, setHoveredGame] = useState<string | null>(null)
  const [highlightedGames, setHighlightedGames] = useState<string[]>([])

  // Function to randomly select 3 games to highlight
  const selectRandomHighlights = () => {
    const shuffled = [...games].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 3).map(game => game.title)
  }

  // Set random highlights on component mount
  useEffect(() => {
    setHighlightedGames(selectRandomHighlights())
  }, [])

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-600 bg-green-100'
      case 'Moderate': return 'text-yellow-600 bg-yellow-100'
      case 'Hard': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Memory': return 'text-blue-600 bg-blue-100'
      case 'Reaction': return 'text-green-600 bg-green-100'
      case 'Attention': return 'text-pink-600 bg-pink-100'
      case 'Processing': return 'text-purple-600 bg-purple-100'
      case 'Strategy': return 'text-orange-600 bg-orange-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const isHighlighted = (gameTitle: string) => {
    return highlightedGames.includes(gameTitle)
  }

  const getGameCardClasses = (game: any) => {
    const isGameHighlighted = isHighlighted(game.title)
    const baseClasses = "relative p-6 rounded-2xl transition-all duration-300 cursor-pointer transform hover:scale-105 active:scale-95 border backdrop-blur-sm"
    
    if (isGameHighlighted) {
      return `${baseClasses} bg-gradient-to-br ${
        hoveredGame === game.title ? 'from-yellow-300 to-orange-300' : 'from-yellow-200 to-orange-200'
      } shadow-2xl ring-4 ring-yellow-400/50 border-yellow-300/60`
    } else {
      return `${baseClasses} bg-gradient-to-br ${
        hoveredGame === game.title ? game.hoverColor : game.color
      } shadow-lg hover:shadow-xl border-white/40`
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-50 py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Choose Your <span className="text-pink-500">Brain Game</span> 🎮
          </h1>
          <p className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto mb-4">
            Clinically validated games designed to measure and improve your cognitive abilities
          </p>
          <p className="text-sm text-orange-600 font-medium mb-6">
            ⭐ Recommended games are highlighted in gold - please play for at least 2 minutes!
          </p>
          
          {/* Finished Playing Button */}
          <div className="mb-8">
            <Link href="/Prep/AboutMePage">
              <div className="inline-block bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl">
                <span className="text-lg">🧠 Finished Playing - View My Brain</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {games.map((game, i) => (
            <Link key={i} href={game.path}>
              <div 
                className={getGameCardClasses(game)}
                onMouseEnter={() => setHoveredGame(game.title)}
                onMouseLeave={() => setHoveredGame(null)}
              >
                {/* Featured Badge */}
                {isHighlighted(game.title) && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
                    ⭐ Today's Challenge
                  </div>
                )}

                {/* Game Icon */}
                <div className={`text-4xl mb-4 text-center ${isHighlighted(game.title) ? 'filter drop-shadow-lg' : ''}`}>
                  {game.icon}
                </div>
                
                {/* Game Title */}
                <h2 className={`text-xl font-bold mb-3 text-center ${
                  isHighlighted(game.title) ? 'text-orange-900' : 'text-gray-900'
                }`}>
                  {game.title}
                </h2>
                
                {/* Game Description */}
                <p className={`text-sm mb-4 text-center leading-relaxed ${
                  isHighlighted(game.title) ? 'text-orange-800' : 'text-gray-700'
                }`}>
                  {game.description}
                </p>
                
                {/* Category and Difficulty Badges */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(game.category)}`}>
                    {game.category}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(game.difficulty)}`}>
                    {game.difficulty}
                  </span>
                </div>
                
                {/* Play Button */}
                <div className="text-center">
                  <div className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md inline-block ${
                    isHighlighted(game.title) 
                      ? 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white' 
                      : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white'
                  }`}>
                    Play Now 🚀
                  </div>
                </div>
                
                {/* Decorative Elements */}
                <div className={`absolute top-3 right-3 w-12 h-12 rounded-full blur-xl ${
                  isHighlighted(game.title) ? 'bg-orange-300/40' : 'bg-white/20'
                }`}></div>
                <div className={`absolute bottom-3 left-3 w-6 h-6 rounded-full blur-sm ${
                  isHighlighted(game.title) ? 'bg-yellow-400/50' : 'bg-white/30'
                }`}></div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom Info Section */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-8 max-w-3xl mx-auto border border-white/40">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              🧠 Scientifically Designed Cognitive Training
            </h3>
            <p className="text-gray-700 mb-6 leading-relaxed">
              Each game is based on validated neuropsychological assessments used in research labs worldwide. 
              Track your performance over time and discover your cognitive strengths across different domains.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white/30 rounded-lg p-3">
                <div className="font-semibold text-gray-800">Memory</div>
                <div className="text-gray-600">3 Games</div>
              </div>
              <div className="bg-white/30 rounded-lg p-3">
                <div className="font-semibold text-gray-800">Reaction</div>
                <div className="text-gray-600">2 Games</div>
              </div>
              <div className="bg-white/30 rounded-lg p-3">
                <div className="font-semibold text-gray-800">Processing</div>
                <div className="text-gray-600">2 Games</div>
              </div>
              <div className="bg-white/30 rounded-lg p-3">
                <div className="font-semibold text-gray-800">Other</div>
                <div className="text-gray-600">2 Games</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}