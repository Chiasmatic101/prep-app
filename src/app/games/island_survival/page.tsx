// src/app/games/island_survival/page.tsx
// FULL CONVERSION: Island Survival Game (Single-File Version)
// This replicates the full Dart logic using React (in one file)

'use client'

import { useState, createContext, useContext } from 'react'
import { motion } from 'framer-motion'

// --- Types ---
interface GameState {
  seenEvents: string[]
  health: number
  stress: number
  hunger: number
  thirst: number
  warmth: number
  energy: number
  food: number
  water: number
  rawFood: number
  rawWater: number
  wood: number
  hasShelter: boolean
  fireLit: boolean
  log: string[]
  popup: { title: string; message: string } | null
  gameOver: boolean
  gameOverReason: string
  actionsTaken: number
  performAction: (type: string) => void
  closePopup: () => void
}

// --- Game State & Context Setup ---
const defaultState: GameState = {
  seenEvents: [],
  health: 60,
  stress: 70,
  hunger: 30,
  thirst: 40,
  warmth: 20,
  energy: 40,
  food: 0,
  water: 0,
  rawFood: 0,
  rawWater: 0,
  wood: 0,
  hasShelter: false,
  fireLit: false,
  log: [],
  popup: null,
  gameOver: false,
  gameOverReason: '',
  actionsTaken: 0,
  performAction: (type: string) => {},
  closePopup: () => {},
}

const GameContext = createContext<GameState>(defaultState)

function useGame() {
  return useContext(GameContext)
}

function getClamped(val: number, delta: number): number {
  return Math.max(0, Math.min(100, val + delta))
}

function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(defaultState)

  const logEvent = (text: string) => {
    setState((s) => ({ ...s, log: [...s.log.slice(-4), text] }))
  }

  const performAction = (type: string) => {
    if (state.gameOver) return

    let updates: Partial<GameState> = {}
    let message = ''

    switch (type) {
      case 'search_area': {
        const events = [
          {
            id: 'tide_pool',
            condition: () => true,
            action: () => {
              updates.health = getClamped(state.health, -10)
              updates.energy = getClamped(state.energy, -10)
              updates.stress = getClamped(state.stress, 10)
              message = "You fall into a tide pool. You're cold, hurt, and shaken."
            }
          },
          {
            id: 'animal_tracks',
            condition: () => true,
            action: () => {
              updates.stress = getClamped(state.stress, 10)
              message = "You find fresh animal tracks. Something dangerous may be nearby."
            }
          },
          {
            id: 'crab_food',
            condition: () => true,
            action: () => {
              updates.rawFood = state.rawFood + 1
              updates.hunger = getClamped(state.hunger, 5)
              message = "You stumble on a small crab hiding under a rock. Fresh food!"
            }
          },
          {
            id: 'rainwater',
            condition: () => true,
            action: () => {
              updates.rawWater = state.rawWater + 1
              message = "You notice rainwater collected in a hollow tree trunk."
            }
          },
          {
            id: 'driftwood',
            condition: () => true,
            action: () => {
              updates.wood = state.wood + 2
              message = "You find driftwood washed ashore."
            }
          },
          {
            id: 'calm_beauty',
            condition: () => true,
            action: () => {
              updates.stress = getClamped(state.stress, -10)
              updates.energy = getClamped(state.energy, 10)
              message = "You take in the beauty of the island. You feel strangely calm."
            }
          }
        ]

        const unseen = events.filter(e => !state.seenEvents.includes(e.id))
        const pick = unseen.length > 0 ? unseen[Math.floor(Math.random() * unseen.length)] : null

        if (pick) {
          pick.action()
          updates.seenEvents = [...state.seenEvents, pick.id]
        } else {
          updates.stress = getClamped(state.stress, -5)
          message = "You find nothing new but enjoy the walk."
        }
        break
      }
      case 'rest':
        updates.energy = getClamped(state.energy, 10)
        updates.stress = getClamped(state.stress, -8)
        updates.warmth = getClamped(state.warmth, 3)
        message = 'You rest quietly, recovering some energy and warmth.'
        break

      case 'find_wood': {
        const found = Math.floor(Math.random() * 3) + 1
        updates.wood = state.wood + found
        updates.energy = getClamped(state.energy, -5)
        message = `You find ${found} pieces of wood.`
        break
      }

      case 'find_water': {
        const found = Math.random() < 0.7 ? 1 : 0
        if (found) {
          updates.rawWater = state.rawWater + 1
          message = 'You collect some unclean water.'
        } else {
          message = 'You fail to find any water.'
        }
        updates.energy = getClamped(state.energy, -5)
        break
      }

      case 'find_food': {
        const found = Math.random() < 0.7 ? 1 : 0
        if (found) {
          updates.rawFood = state.rawFood + 1
          message = 'You find something edible.'
        } else {
          message = 'No food found this time.'
        }
        updates.energy = getClamped(state.energy, -5)
        break
      }

      case 'build_shelter':
        if (state.wood >= 5) {
          updates.hasShelter = true
          updates.wood = state.wood - 5
          updates.stress = getClamped(state.stress, -10)
          message = 'You build a crude but stable shelter out of driftwood.'
        } else {
          message = 'Not enough wood to build shelter (need 5).'
        }
        break

      case 'start_fire':
        if (state.wood >= 1) {
          updates.fireLit = true
          updates.wood = state.wood - 1
          updates.warmth = getClamped(state.warmth, 15)
          message = 'You start a fire. The warmth is comforting.'
        } else {
          message = 'You need more wood to start a fire.'
        }
        break

      case 'cook_food':
        if (state.rawFood >= 1 && state.fireLit) {
          updates.rawFood = state.rawFood - 1
          updates.food = state.food + 1
          message = 'You cook a meal over the fire.'
        } else {
          message = 'You need raw food and a fire to cook.'
        }
        break

      case 'boil_water':
        if (state.rawWater >= 1 && state.fireLit) {
          updates.rawWater = state.rawWater - 1
          updates.water = state.water + 1
          message = 'You boil water to make it safe to drink.'
        } else {
          message = 'You need raw water and a fire to boil.'
        }
        break

      case 'eat':
        if (state.food > 0) {
          updates.food = state.food - 1
          updates.hunger = getClamped(state.hunger, 20)
          message = 'You eat a meal and feel less hungry.'
        } else {
          message = 'You have no food to eat.'
        }
        break

      case 'drink':
        if (state.water > 0) {
          updates.water = state.water - 1
          updates.thirst = getClamped(state.thirst, 20)
          message = 'You drink clean water and feel more hydrated.'
        } else {
          message = 'You have no clean water to drink.'
        }
        break

      case 'mindfulness':
        updates.stress = getClamped(state.stress, -12)
        updates.energy = getClamped(state.energy, 5)
        message = 'You sit and breathe deeply, calming your mind.'
        break

      case 'end_day': {
        const hungerPenalty = state.hunger < 20 ? -10 : 0
        const thirstPenalty = state.thirst < 20 ? -15 : 0
        const coldPenalty = state.warmth < 20 ? -10 : 0
        const stressPenalty = state.stress > 90 ? -10 : 0

        const totalChange = hungerPenalty + thirstPenalty + coldPenalty + stressPenalty

        updates.health = getClamped(state.health, totalChange)
        updates.energy = getClamped(state.energy, -20)
        updates.hunger = getClamped(state.hunger, -15)
        updates.thirst = getClamped(state.thirst, -20)
        updates.stress = getClamped(state.stress, 5)
        updates.warmth = getClamped(state.warmth, -10)
        message = 'The day ends. You try to rest through the night.'
        break
      }

      default:
        message = 'Nothing happens.'
    }

    const newActions = state.actionsTaken + 1
    const isDead = (updates.health ?? state.health) <= 0

    setState((s) => ({
      ...s,
      ...updates,
      popup: { title: 'Event', message },
      actionsTaken: newActions,
      gameOver: isDead,
      gameOverReason: isDead ? 'You did not survive the harsh island conditions.' : '',
    }))
    logEvent(message)
  }

  const closePopup = () => {
    setState((s) => ({ ...s, popup: null }))
  }

  return (
    <GameContext.Provider value={{ ...state, performAction, closePopup }}>
      {children}
    </GameContext.Provider>
  )
}

function StatsPanel() {
  const { health, stress, hunger, thirst, warmth, energy, food, water, rawFood, rawWater, wood } = useGame()
  
  const iconMap: Record<string, string> = {
    'Health': '❤️',
    'Stress': '😰',
    'Hunger': '🍖',
    'Thirst': '💧',
    'Warmth': '🔥',
    'Energy': '⚡',
    'Food': '🥫',
    'Water': '🚰',
    'Raw Food': '🦀',
    'Raw Water': '🥄',
    'Wood': '🪵'
  }

  const Stat = ({ label, value }: { label: string; value: number }) => (
    <div className="flex justify-between text-sm">
      <span>{iconMap[label]} {label}</span>
      <span>{value}</span>
    </div>
  )

  return (
    <div className="grid grid-cols-2 gap-3 mb-6 w-full max-w-md">
      <Stat label="Health" value={health} />
      <Stat label="Stress" value={stress} />
      <Stat label="Hunger" value={hunger} />
      <Stat label="Thirst" value={thirst} />
      <Stat label="Warmth" value={warmth} />
      <Stat label="Energy" value={energy} />
      <Stat label="Food" value={food} />
      <Stat label="Water" value={water} />
      <Stat label="Raw Food" value={rawFood} />
      <Stat label="Raw Water" value={rawWater} />
      <Stat label="Wood" value={wood} />
    </div>
  )
}

function ActionPanel() {
  const { performAction, gameOver } = useGame()
  if (gameOver) return null
  
  const actions = [
    { type: 'search_area', label: 'Search the Area' },
    { type: 'rest', label: 'Rest' },
    { type: 'find_food', label: 'Find Food' },
    { type: 'find_water', label: 'Find Water' },
    { type: 'find_wood', label: 'Find Wood' },
    { type: 'build_shelter', label: 'Build Shelter' },
    { type: 'start_fire', label: 'Start Fire' },
    { type: 'cook_food', label: 'Cook Food' },
    { type: 'boil_water', label: 'Boil Water' },
    { type: 'eat', label: 'Eat Food' },
    { type: 'drink', label: 'Drink Water' },
    { type: 'mindfulness', label: 'Mindfulness' },
    { type: 'end_day', label: 'End Day' },
  ]
  
  return (
    <div className="flex flex-wrap gap-3 mb-6 justify-center">
      {actions.map(({ type, label }) => (
        <button 
          key={type} 
          onClick={() => performAction(type)} 
          className="px-4 py-2 bg-green-700 rounded-lg shadow-md hover:bg-green-600 transition-all duration-200 text-white font-semibold"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function StoryLog() {
  const { log, gameOver, gameOverReason } = useGame()
  return (
    <div className="bg-gray-800 p-4 rounded w-full max-w-md">
      <h2 className="text-lg font-bold mb-2">Event Log</h2>
      <ul className="space-y-1 text-sm text-gray-300">
        {[...log].reverse().map((entry, idx) => (
          <li key={idx}>{entry}</li>
        ))}
      </ul>
      {gameOver && (
        <p className="text-red-400 mt-4 font-bold">💀 {gameOverReason}</p>
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
      <div className="bg-white text-black p-6 rounded-xl max-w-sm w-full">
        <h3 className="text-xl font-bold mb-2">{popup.title}</h3>
        <p className="mb-4">{popup.message}</p>
        <button 
          onClick={closePopup} 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
        >
          OK
        </button>
      </div>
    </motion.div>
  )
}

export default function Page() {
  return (
    <GameProvider>
      <div className="min-h-screen text-white p-4 flex flex-col items-center bg-cover bg-center" style={{ backgroundImage: 'url(/images/island-background.png)' }}>
        <div className="bg-black/60 p-4 rounded-xl w-full max-w-2xl">
          <h1 className="text-3xl font-bold mb-4 text-center">🏝️ Island Survival</h1>
          <StatsPanel />
          <ActionPanel />
          <StoryLog />
        </div>
        <PopupDialog />
      </div>
    </GameProvider>
  )
}
