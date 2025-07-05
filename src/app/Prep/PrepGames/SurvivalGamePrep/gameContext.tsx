// src/app/Prep/PrepGames/SurvivalGamePrep/gameContext.tsx
'use client'
import { createContext, useContext, useState } from 'react'

interface GameState {
  seenEvents: string[]
  condition: number
  overload: number
  energy: number
  hydration: number
  comfort: number
  stamina: number
  food: number
  water: number
  rawFood: number
  rawWater: number
  materials: number
  hasBase: boolean
  heatSourceActive: boolean
  log: string[]
  popup: { title: string; message: string } | null
  challengeReset: boolean
  resetReason: string
  actionsTaken: number
  hasGameStarted: boolean
  performAction: (type: string) => void
  closePopup: () => void
  startGame: () => void
}

const defaultState: GameState = {
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
  performAction: (type: string) => {},
  closePopup: () => {},
  startGame: () => {},
}

const GameContext = createContext<GameState>(defaultState)

export function useGame() {
  return useContext(GameContext)
}

function getClamped(val: number, delta: number) {
  return Math.max(0, Math.min(100, val + delta))
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(defaultState)

  const logEvent = (text: string) => {
    setState((s) => ({ ...s, log: [...s.log.slice(-4), text] }))
  }

  const startGame = () => {
    setState((s) => ({ ...s, hasGameStarted: true }))
    logEvent("🏝️ Adventure begins! You wake up on a mysterious island...")
  }

  const performAction = (type: string) => {
    setState((prevState) => {
      const newState = { ...prevState }
      newState.actionsTaken += 1

      switch (type) {
        case 'explore_vlog':
          newState.energy = getClamped(newState.energy, -15)
          newState.stamina = getClamped(newState.stamina, -10)
          newState.materials = getClamped(newState.materials, 10)
          logEvent("📹 Explored and documented the area. Found some useful materials!")
          break
        
        case 'self_care_break':
          newState.comfort = getClamped(newState.comfort, 15)
          newState.overload = getClamped(newState.overload, -20)
          logEvent("🧘 Took a self-care break. Feeling more balanced.")
          break
        
        case 'forage_content':
          newState.energy = getClamped(newState.energy, -10)
          newState.rawFood = getClamped(newState.rawFood, 20)
          logEvent("🌿 Foraged for food. Found some berries and edible plants!")
          break
        
        case 'hydration_hunt':
          newState.energy = getClamped(newState.energy, -10)
          newState.rawWater = getClamped(newState.rawWater, 25)
          logEvent("💧 Found a water source! Collected some fresh water.")
          break
        
        case 'gather_materials':
          newState.energy = getClamped(newState.energy, -15)
          newState.materials = getClamped(newState.materials, 25)
          logEvent("🧱 Gathered materials from the environment.")
          break
        
        case 'build_base':
          if (newState.materials >= 50) {
            newState.materials -= 50
            newState.hasBase = true
            newState.comfort = getClamped(newState.comfort, 30)
            logEvent("🏠 Built a basic shelter! Much more comfortable now.")
          } else {
            logEvent("🏠 Need more materials to build a base (50 required)")
          }
          break
        
        case 'light_heat_source':
          if (newState.materials >= 20) {
            newState.materials -= 20
            newState.heatSourceActive = true
            newState.comfort = getClamped(newState.comfort, 20)
            logEvent("🔥 Created a heat source! Warmth feels amazing.")
          } else {
            logEvent("🔥 Need more materials for heat source (20 required)")
          }
          break
        
        case 'cook_food':
          if (newState.heatSourceActive && newState.rawFood >= 10) {
            newState.rawFood -= 10
            newState.food = getClamped(newState.food, 15)
            logEvent("🍳 Cooked some food. Smells delicious!")
          } else {
            logEvent("🍳 Need heat source and raw food (10) to cook")
          }
          break
        
        case 'purify_water':
          if (newState.heatSourceActive && newState.rawWater >= 10) {
            newState.rawWater -= 10
            newState.water = getClamped(newState.water, 20)
            logEvent("🫖 Purified water. Safe to drink now!")
          } else {
            logEvent("🫖 Need heat source and raw water (10) to purify")
          }
          break
        
        case 'refuel':
          if (newState.food >= 10) {
            newState.food -= 10
            newState.energy = getClamped(newState.energy, 25)
            newState.condition = getClamped(newState.condition, 10)
            logEvent("🍕 Ate some food. Energy restored!")
          } else {
            logEvent("🍕 Need cooked food (10) to eat")
          }
          break
        
        case 'hydrate':
          if (newState.water >= 10) {
            newState.water -= 10
            newState.hydration = getClamped(newState.hydration, 30)
            newState.condition = getClamped(newState.condition, 5)
            logEvent("🚰 Drank clean water. Feeling refreshed!")
          } else {
            logEvent("🚰 Need purified water (10) to drink")
          }
          break
        
        case 'meditate_reset':
          newState.overload = getClamped(newState.overload, -30)
          newState.comfort = getClamped(newState.comfort, 10)
          logEvent("🔄 Meditated and reset mindset. Feeling clearer.")
          break
        
        case 'rest_cycle':
          newState.stamina = getClamped(newState.stamina, 40)
          newState.energy = getClamped(newState.energy, 20)
          newState.comfort = getClamped(newState.comfort, 10)
          logEvent("😴 Rested and recovered. Ready for more adventure!")
          break
        
        default:
          logEvent(`Unknown action: ${type}`)
      }

      // Check for challenge reset conditions
      if (newState.condition <= 0 || newState.overload >= 100) {
        newState.challengeReset = true
        newState.resetReason = newState.condition <= 0 
          ? "Your condition dropped too low. Time to regroup!" 
          : "Overload reached maximum. Taking a break to reset."
      }

      return newState
    })
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
