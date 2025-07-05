// TEEN-FRIENDLY SURVIVAL ADVENTURE GAME
// Modernized for 13-18 year olds with positive messaging and contemporary themes

'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { motion } from 'framer-motion'

const defaultState = {
  seenEvents: [],
  condition: 60,
  overload: 70,
  energy: 30,
  hydration: 40,
  comfort: 20,
  stamina: 40,
  food: 0,
  water: 0,
  rawFood: 0,
  rawWater: 0,
  materials: 0,
  hasBase: false,
  heatSourceActive: false,
  log: [],
  popup: null,
  challengeReset: false,
  resetReason: '',
  actionsTaken: 0,
  hasGameStarted: false,
  performAction: (type) => {},
  closePopup: () => {},
  startGame: () => {},
}

const GameContext = createContext(defaultState)
export function useGame() {
  return useContext(GameContext)
}

function getClamped(val, delta) {
  return Math.max(0, Math.min(100, val + delta))
}

export function GameProvider({ children }) {
  const [state, setState] = useState(defaultState)

  const logEvent = (text) => {
    setState((s) => ({ ...s, log: [...s.log.slice(-4), text] }))
  }

  const startGame = () => {
    setState((s) => ({ ...s, hasGameStarted: true }))
  }

  const performAction = (type) => {
    if (state.challengeReset) return

    let updates = {}
    let message = ''

    switch (type) {
      case 'explore_vlog': {
        const events = [
          {
            id: 'tech_debris',
            condition: () => true,
            action: () => {
              updates.condition = getClamped(state.condition, -8)
              updates.stamina = getClamped(state.stamina, -8)
              updates.overload = getClamped(state.overload, 8)
              message = "You spot a partially buried tablet with a cracked screen. Might still have useful apps, but digging it out looks sketchy."
            }
          },
          {
            id: 'phantom_signal',
            condition: () => true,
            action: () => {
              updates.overload = getClamped(state.overload, 8)
              message = "You catch yourself looking for WiFi signals that obviously aren't there. The offline life hits different."
            }
          },
          {
            id: 'nature_content',
            condition: () => true,
            action: () => {
              updates.rawFood = state.rawFood + 1
              updates.energy = getClamped(state.energy, 5)
              message = "You find some edible berries! Your inner survivalist is awakening. This would make great content if you had signal."
            }
          },
          {
            id: 'fresh_water',
            condition: () => true,
            action: () => {
              updates.rawWater = state.rawWater + 1
              message = "Score! You found rainwater collected in a natural basin. Nature's water bottle delivery system."
            }
          },
          {
            id: 'building_materials',
            condition: () => true,
            action: () => {
              updates.materials = state.materials + 2
              message = "You gather some solid building materials. Your DIY skills are about to level up!"
            }
          },
          {
            id: 'mindful_moment',
            condition: () => true,
            action: () => {
              updates.overload = getClamped(state.overload, -10)
              updates.stamina = getClamped(state.stamina, 10)
              message = "You take in the natural beauty around you. No filters needed - this view is already perfect. You feel more centered."
            }
          }
        ]

        const unseen = events.filter(e => !state.seenEvents.includes(e.id))
        const pick = unseen.length > 0 ? unseen[Math.floor(Math.random() * unseen.length)] : null

        if (pick) {
          pick.action()
          updates.seenEvents = [...state.seenEvents, pick.id]
        } else {
          updates.overload = getClamped(state.overload, -5)
          message = "Nothing new to discover, but the walk was still worth it. Sometimes the journey is the destination."
        }
        break
      }
      
      case 'self_care_break':
        updates.stamina = getClamped(state.stamina, 12)
        updates.overload = getClamped(state.overload, -10)
        updates.comfort = getClamped(state.comfort, 5)
        message = 'You take a mindful break to recharge. Self-care is not selfish - it\'s survival.'
        break

      case 'gather_materials': {
        const found = Math.floor(Math.random() * 3) + 1
        updates.materials = state.materials + found
        updates.stamina = getClamped(state.stamina, -5)
        message = `You gather ${found} pieces of building materials. Your resourcefulness is showing!`
        break
      }

      case 'hydration_hunt': {
        const found = Math.random() < 0.7 ? 1 : 0
        if (found) {
          updates.rawWater = state.rawWater + 1
          message = 'You collect some questionable water. Better purify it first - we\'re not taking any L\'s today!'
        } else {
          message = 'No water sources found this time, but you\'re building those exploration skills!'
        }
        updates.stamina = getClamped(state.stamina, -5)
        break
      }

      case 'forage_content': {
        const found = Math.random() < 0.7 ? 1 : 0
        if (found) {
          updates.rawFood = state.rawFood + 1
          message = 'Found some edible stuff! Your foraging game is getting stronger.'
        } else {
          message = 'No food found this round, but every attempt makes you smarter about where to look.'
        }
        updates.stamina = getClamped(state.stamina, -5)
        break
      }

      case 'build_base':
        if (state.materials >= 5) {
          updates.hasBase = true
          updates.materials = state.materials - 5
          updates.overload = getClamped(state.overload, -12)
          message = 'You built an amazing survival base! Your construction skills are literally next level.'
        } else {
          message = 'Need 5 materials to build your base. Keep gathering - you\'ve got this!'
        }
        break

      case 'light_heat_source':
        if (state.materials >= 1) {
          updates.heatSourceActive = true
          updates.materials = state.materials - 1
          updates.comfort = getClamped(state.comfort, 20)
          message = 'Heat source activated! The warmth hits different when you made it yourself.'
        } else {
          message = 'Need some materials to create a heat source. Time to get resourceful!'
        }
        break

      case 'cook_food':
        if (state.rawFood >= 1 && state.heatSourceActive) {
          updates.rawFood = state.rawFood - 1
          updates.food = state.food + 1
          message = 'Cooking skills unlocked! This meal is going to hit different.'
        } else {
          message = 'Need raw food and an active heat source to cook. Almost there!'
        }
        break

      case 'purify_water':
        if (state.rawWater >= 1 && state.heatSourceActive) {
          updates.rawWater = state.rawWater - 1
          updates.water = state.water + 1
          message = 'Water purification complete! Clean hydration is the way to go.'
        } else {
          message = 'Need raw water and a heat source to purify. Safety first!'
        }
        break

      case 'refuel':
        if (state.food > 0) {
          updates.food = state.food - 1
          updates.energy = getClamped(state.energy, 25)
          message = 'Fuel up complete! Your body is thanking you right now.'
        } else {
          message = 'No food available. Time to forage for some energy!'
        }
        break

      case 'hydrate':
        if (state.water > 0) {
          updates.water = state.water - 1
          updates.hydration = getClamped(state.hydration, 25)
          message = 'Hydration check complete! Your system is running smooth now.'
        } else {
          message = 'No clean water available. Better find and purify some!'
        }
        break

      case 'meditate_reset':
        updates.overload = getClamped(state.overload, -15)
        updates.stamina = getClamped(state.stamina, 8)
        message = 'Meditation session complete. Your mind is clearer and you feel more centered.'
        break

      case 'rest_cycle': {
        const energyPenalty = state.energy < 20 ? -8 : 0
        const hydrationPenalty = state.hydration < 20 ? -12 : 0
        const comfortPenalty = state.comfort < 20 ? -8 : 0
        const overloadPenalty = state.overload > 90 ? -8 : 0

        const totalChange = energyPenalty + hydrationPenalty + comfortPenalty + overloadPenalty

        updates.condition = getClamped(state.condition, totalChange)
        updates.stamina = getClamped(state.stamina, -15)
        updates.energy = getClamped(state.energy, -12)
        updates.hydration = getClamped(state.hydration, -15)
        updates.overload = getClamped(state.overload, 3)
        updates.comfort = getClamped(state.comfort, -8)
        message = 'Rest cycle complete. Your body is processing everything from the day.'
        break
      }

      default:
        message = 'You pause and consider your next move. Strategic thinking activated.'
    }

    const newActions = state.actionsTaken + 1
    const needsReset = (updates.condition ?? state.condition) <= 0

    if (needsReset) {
      // Instead of game over, trigger recovery
      updates.condition = 40
      updates.energy = 30
      updates.hydration = 30
      updates.comfort = 40
      updates.stamina = 20
      updates.overload = 60
      updates.challengeReset = false // Don't end game, just reset stats
      updates.resetReason = ''
      message = '⚠️ System Overload! Your body needed a reboot. Hours later, you wake up feeling reset. Time to try a different strategy!'
    }

    setState((s) => ({
      ...s,
      ...updates,
      popup: { title: needsReset ? 'System Reset' : 'Adventure Log', message },
      actionsTaken: newActions,
    }))
    logEvent(message)
  }

  const closePopup = () => {
    setState((s) => ({ ...s, popup: null }))
  }

  return (
    <GameContext.Provider value={{ ...state, performAction, closePopup, startGame }}>
      {children}
    </GameContext.Provider>
  )
}

function IntroductionScreen() {
  const { startGame } = useGame()
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center relative" 
         style={{ backgroundImage: 'url(/images/island-background.png)' }}>
      <div className="absolute inset-0 bg-black bg-opacity-60"></div>
      
      <div className="relative z-10 w-full max-w-2xl">
        <div className="bg-black bg-opacity-80 rounded-xl p-8 border-2 border-amber-500">
          
          <h1 className="text-4xl font-bold text-amber-500 text-center mb-6 drop-shadow-lg">
            🏝️ SURVIVAL ADVENTURE
          </h1>
          
          <div className="bg-blue-600 bg-opacity-20 rounded-lg p-4 mb-4 border border-blue-400 border-opacity-50">
            <p className="text-white text-base leading-relaxed text-center">
              You wake up on a remote island after a drone crash. Your phone is dead, there's no signal, and you're completely offline. Time to discover what you're really made of in this ultimate survival challenge.
            </p>
          </div>
          
          <div className="bg-amber-600 bg-opacity-20 rounded-lg p-4 mb-4 border border-amber-400 border-opacity-50">
            <div className="flex items-center justify-center mb-3">
              <span className="text-amber-500 mr-2">🎯</span>
              <h3 className="text-amber-500 font-bold text-sm">ADVENTURE GOAL</h3>
            </div>
            <p className="text-amber-100 font-bold text-center">
              Build up your condition to 80+ so you can safely explore inland and complete your survival challenge!
            </p>
          </div>
          
          <div className="bg-green-600 bg-opacity-20 rounded-lg p-4 mb-6 border border-green-400 border-opacity-50">
            <h3 className="text-green-400 font-bold text-sm mb-3">💡 SURVIVAL TIPS</h3>
            <div className="text-white text-sm leading-relaxed space-y-1">
              <div>• Monitor your stats - balance is key to thriving</div>
              <div>• Create heat sources ASAP for comfort and cooking</div>
              <div>• Purify questionable water, cook raw food</div>
              <div>• Take self-care breaks to manage overload</div>
              <div>• Build your base for protection and comfort</div>
              <div>• If you crash, you'll reset and respawn - no pressure!</div>
            </div>
          </div>
          
          <div className="bg-purple-600 bg-opacity-20 rounded-lg p-4 mb-6 border border-purple-400 border-opacity-50">
            <h3 className="text-purple-400 font-bold text-sm mb-3">🌟 BONUS CHALLENGES</h3>
            <div className="text-white text-sm leading-relaxed space-y-1">
              <div>• Build the ultimate survival base</div>
              <div>• Master all survival skills</div>
              <div>• Document your entire journey</div>
              <div>• Become a wilderness expert</div>
            </div>
          </div>
          
          <div className="text-center">
            <button 
              onClick={startGame}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg"
            >
              🚀 START ADVENTURE
            </button>
          </div>
          
          <p className="text-gray-400 text-xs text-center mt-4 italic">
            Tap stats for info • Monitor your condition and have fun!
          </p>
          
        </div>
      </div>
    </div>
  )
}

function StatsPanel() {
  const { condition, overload, energy, hydration, comfort, stamina, food, water, rawFood, rawWater, materials } = useGame()
  
  const iconMap = {
    'Condition': '💪',
    'Overload': '🧠',
    'Energy': '⚡',
    'Hydration': '💧',
    'Comfort': '🔥',
    'Stamina': '🏃',
    'Food': '🍕',
    'Water': '🚰',
    'Raw Food': '🌿',
    'Raw Water': '💦',
    'Materials': '🧱'
  };

  const Stat = ({ label, value }) => {
    const getColor = () => {
      if (label === 'Overload') {
        if (value >= 80) return 'text-red-400'
        if (value >= 60) return 'text-orange-400'
        return 'text-green-400'
      } else {
        if (value >= 60) return 'text-green-400'
        if (value >= 30) return 'text-yellow-400'
        return 'text-red-400'
      }
    }

    return (
      <div className="flex justify-between text-sm">
        <span>{iconMap[label]} {label}</span>
        <span className={getColor()}>{value}</span>
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-2 gap-3 mb-6 w-full max-w-md">
      <Stat label="Condition" value={condition} />
      <Stat label="Overload" value={overload} />
      <Stat label="Energy" value={energy} />
      <Stat label="Hydration" value={hydration} />
      <Stat label="Comfort" value={comfort} />
      <Stat label="Stamina" value={stamina} />
      <Stat label="Food" value={food} />
      <Stat label="Water" value={water} />
      <Stat label="Raw Food" value={rawFood} />
      <Stat label="Raw Water" value={rawWater} />
      <Stat label="Materials" value={materials} />
    </div>
  )
}

function ActionPanel() {
  const { performAction, challengeReset } = useGame()
  if (challengeReset) return null
  
  const actions = [
    { type: 'explore_vlog', label: 'Explore & Document', emoji: '📹' },
    { type: 'self_care_break', label: 'Self-Care Break', emoji: '🧘' },
    { type: 'forage_content', label: 'Forage for Food', emoji: '🌿' },
    { type: 'hydration_hunt', label: 'Find Water', emoji: '💧' },
    { type: 'gather_materials', label: 'Gather Materials', emoji: '🧱' },
    { type: 'build_base', label: 'Build Base', emoji: '🏠' },
    { type: 'light_heat_source', label: 'Create Heat Source', emoji: '🔥' },
    { type: 'cook_food', label: 'Cook Food', emoji: '🍳' },
    { type: 'purify_water', label: 'Purify Water', emoji: '🫖' },
    { type: 'refuel', label: 'Eat Food', emoji: '🍕' },
    { type: 'hydrate', label: 'Drink Water', emoji: '🚰' },
    { type: 'meditate_reset', label: 'Meditate & Reset', emoji: '🔄' },
    { type: 'rest_cycle', label: 'Rest Cycle', emoji: '😴' },
  ]
  
  return (
    <div className="flex flex-wrap gap-3 mb-6 justify-center">
      {actions.map(({ type, label, emoji }) => (
        <button 
          key={type} 
          onClick={() => performAction(type)} 
          className="px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-md hover:from-purple-500 hover:to-blue-500 transition-all duration-200 text-white font-semibold text-sm min-w-[120px]"
        >
          <div className="flex flex-col items-center">
            <span className="text-lg mb-1">{emoji}</span>
            <span className="text-xs leading-tight">{label}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function StoryLog() {
  const { log, challengeReset, resetReason } = useGame()
  
  return (
    <div className="bg-gray-800 p-4 rounded w-full max-w-md">
      <h2 className="text-lg font-bold mb-2">📋 Adventure Log</h2>
      <ul className="space-y-1 text-sm text-gray-300">
        {[...log].reverse().map((entry, idx) => (
          <li key={idx} className="leading-relaxed">{entry}</li>
        ))}
      </ul>
      {challengeReset && (
        <p className="text-blue-400 mt-4 font-bold">🔄 {resetReason}</p>
      )}
    </div>
  )
}

function PopupDialog() {
  const { popup, closePopup } = useGame()
  if (!popup) return null
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
    >
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 rounded-xl max-w-sm w-full border-2 border-purple-500">
        <h3 className="text-xl font-bold mb-2 text-purple-300">{popup.title}</h3>
        <p className="mb-4 leading-relaxed">{popup.message}</p>
        <button 
          onClick={closePopup} 
          className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-500 hover:to-blue-500 transition-all duration-200 font-semibold"
        >
          Continue Adventure
        </button>
      </div>
    </motion.div>
  )
}

function GameplayScreen() {
  const { hasGameStarted, challengeReset } = useGame()
  
  if (!hasGameStarted) {
    return <IntroductionScreen />
  }
  
  if (challengeReset) {
    return <ChallengeResetScreen />
  }
  
  return (
    <div className="min-h-screen text-white p-4 flex flex-col items-center bg-cover bg-center" style={{ backgroundImage: 'url(/images/island-background.png)' }}>
      <div className="bg-black/60 p-4 rounded-xl w-full max-w-2xl border border-purple-500/30">
        <h1 className="text-3xl font-bold mb-4 text-center bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          🏝️ Survival Adventure
        </h1>
        <StatsPanel />
        <ActionPanel />
        <StoryLog />
      </div>
      <PopupDialog />
    </div>
  )
}

function ChallengeResetScreen() {
  const { resetReason } = useGame()
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center relative" 
         style={{ backgroundImage: 'url(/images/island-background.png)' }}>
      <div className="absolute inset-0 bg-black bg-opacity-70"></div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-8 border-2 border-blue-500">
          <div className="text-center">
            <div className="text-6xl mb-4">🔄</div>
            <h2 className="text-3xl font-bold text-blue-400 mb-4">Challenge Reset</h2>
            <p className="text-white mb-4 leading-relaxed">
              Your system needed a reboot! That's totally normal - even the best adventurers need recovery time. 
              You've learned valuable skills that will help you next time.
            </p>
            <p className="text-gray-400 text-sm mb-6">Ready to try a different strategy?</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white font-bold py-3 px-8 rounded-lg transition-all duration-200"
            >
              🚀 Respawn & Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <GameProvider>
      <GameplayScreen />
    </GameProvider>
  )
}