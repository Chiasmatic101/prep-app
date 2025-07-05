// src/app/Prep/PrepGames/SurvivalGamePrep/page.tsx
'use client'

import { GameProvider, useGame } from './gameContext'
import { motion } from 'framer-motion'

export default function Page() {
  return (
    <GameProvider>
      <GameplayScreen />
    </GameProvider>
  )
}

function GameplayScreen() {
  const { hasGameStarted, challengeReset } = useGame()

  if (!hasGameStarted) return <IntroductionScreen />
  if (challengeReset) return <ChallengeResetScreen />

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

function IntroductionScreen() {
  const { startGame } = useGame()

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center relative" style={{ backgroundImage: 'url(/images/island-background.png)' }}>
      <div className="absolute inset-0 bg-black bg-opacity-60"></div>
      <div className="relative z-10 w-full max-w-2xl">
        <div className="bg-black bg-opacity-80 rounded-xl p-8 border-2 border-amber-500">
          <h1 className="text-4xl font-bold text-amber-500 text-center mb-6 drop-shadow-lg">🏝️ SURVIVAL ADVENTURE</h1>
          <p className="text-white text-base leading-relaxed text-center mb-6">
            You wake up on a remote island after a drone crash. Your phone is dead, there's no signal, and you're completely offline. Time to discover what you're really made of in this ultimate survival challenge.
          </p>
          <div className="text-center">
            <button
              onClick={startGame}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg"
            >
              🚀 START ADVENTURE
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatsPanel() {
  const { condition, overload, energy, hydration, comfort, stamina, food, water, rawFood, rawWater, materials } = useGame()
  const stats = [
    { label: 'Condition', value: condition },
    { label: 'Overload', value: overload },
    { label: 'Energy', value: energy },
    { label: 'Hydration', value: hydration },
    { label: 'Comfort', value: comfort },
    { label: 'Stamina', value: stamina },
    { label: 'Food', value: food },
    { label: 'Water', value: water },
    { label: 'Raw Food', value: rawFood },
    { label: 'Raw Water', value: rawWater },
    { label: 'Materials', value: materials },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 mb-6 w-full max-w-md">
      {stats.map(({ label, value }) => (
        <div key={label} className="flex justify-between text-sm">
          <span>{label}</span>
          <span>{value}</span>
        </div>
      ))}
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

function ChallengeResetScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center relative" style={{ backgroundImage: 'url(/images/island-background.png)' }}>
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