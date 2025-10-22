'use client'

import { useState, createContext, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Weather = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'hot'

interface Achievement {
  id: string
  title: string
  description: string
  unlocked: boolean
  icon: string
}

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
  dayNumber: number
  hasGameStarted: boolean
  weather: Weather
  timeOfDay: number
  signalFireBuilt: boolean
  rescueProgress: number
  achievements: Achievement[]
  totalDaysAlive: number
  performAction: (type: string) => void
  closePopup: () => void
  startGame: () => void
}

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
  dayNumber: 1,
  hasGameStarted: false,
  weather: 'sunny',
  timeOfDay: 6,
  signalFireBuilt: false,
  rescueProgress: 0,
  achievements: [
    { id: 'first_fire', title: 'Prometheus', description: 'Start your first fire', unlocked: false, icon: '🔥' },
    { id: 'build_shelter', title: 'Home Builder', description: 'Construct a shelter', unlocked: false, icon: '🏠' },
    { id: 'survive_week', title: 'Survivor', description: 'Survive 7 days', unlocked: false, icon: '📅' },
    { id: 'survive_storm', title: 'Storm Chaser', description: 'Survive a storm with shelter', unlocked: false, icon: '⛈️' },
    { id: 'well_fed', title: 'Well Fed', description: 'Reach 80+ hunger', unlocked: false, icon: '🍖' },
    { id: 'signal_fire', title: 'Beacon of Hope', description: 'Build a signal fire', unlocked: false, icon: '🔦' },
    { id: 'rescued', title: 'Rescue!', description: 'Get rescued from the island', unlocked: false, icon: '🚁' },
  ],
  totalDaysAlive: 0,
  performAction: () => {},
  closePopup: () => {},
  startGame: () => {},
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
    setState((s) => ({ ...s, log: [...s.log.slice(-5), text] }))
  }

  const getRandomWeather = (): Weather => {
    const rand = Math.random()
    if (rand < 0.35) return 'sunny'
    if (rand < 0.55) return 'cloudy'
    if (rand < 0.70) return 'rainy'
    if (rand < 0.85) return 'hot'
    return 'stormy'
  }

  const applyWeatherEffects = (newState: GameState) => {
    switch (newState.weather) {
      case 'rainy':
        newState.rawWater = Math.min(100, newState.rawWater + 3)
        newState.warmth = getClamped(newState.warmth, -5)
        if (!newState.hasShelter) {
          newState.health = getClamped(newState.health, -3)
        }
        if (newState.fireLit && Math.random() < 0.3) {
          newState.fireLit = false
          logEvent("🌧️ Rain extinguished your fire!")
        }
        break
      case 'stormy':
        newState.warmth = getClamped(newState.warmth, -10)
        newState.stress = getClamped(newState.stress, 10)
        if (!newState.hasShelter) {
          newState.health = getClamped(newState.health, -8)
          logEvent("⛈️ The storm batters you mercilessly!")
        }
        if (newState.fireLit) {
          newState.fireLit = false
          logEvent("⛈️ Storm winds blow out your fire!")
        }
        break
      case 'hot':
        newState.thirst = getClamped(newState.thirst, -8)
        newState.energy = getClamped(newState.energy, -5)
        break
      case 'sunny':
        newState.warmth = getClamped(newState.warmth, 5)
        break
    }
  }

  const startGame = () => {
    setState((s) => ({ 
      ...s, 
      hasGameStarted: true,
      popup: {
        title: '🎯 Your Mission',
        message: 'You crashed on a deserted island. Your goal: GET RESCUED!\n\n📋 Steps to Rescue:\n1. Gather resources (wood, food, water)\n2. Build a shelter (5 wood)\n3. Build a signal fire (10 wood)\n4. Survive until rescue arrives!\n\nTip: Balance survival with preparing for rescue. Good luck!'
      }
    }))
    logEvent("🏝️ You wake up on a mysterious island after a crash. The sun is hot, and you're alone...")
    logEvent("🎯 Goal: Build a signal fire and get rescued!")
  }

  const checkAchievements = (newState: GameState) => {
    const achievements = [...newState.achievements]
    let newAchievement = false

    // Check each achievement
    if (!achievements[0].unlocked && newState.fireLit) {
      achievements[0].unlocked = true
      newAchievement = true
      logEvent("🏆 Achievement: Prometheus!")
    }
    if (!achievements[1].unlocked && newState.hasShelter) {
      achievements[1].unlocked = true
      newAchievement = true
      logEvent("🏆 Achievement: Home Builder!")
    }
    if (!achievements[2].unlocked && newState.dayNumber >= 7) {
      achievements[2].unlocked = true
      newAchievement = true
      logEvent("🏆 Achievement: Survivor!")
    }
    if (!achievements[3].unlocked && newState.hasShelter && newState.weather === 'stormy') {
      achievements[3].unlocked = true
      newAchievement = true
      logEvent("🏆 Achievement: Storm Chaser!")
    }
    if (!achievements[4].unlocked && newState.hunger >= 80) {
      achievements[4].unlocked = true
      newAchievement = true
      logEvent("🏆 Achievement: Well Fed!")
    }
    if (!achievements[5].unlocked && newState.signalFireBuilt) {
      achievements[5].unlocked = true
      newAchievement = true
      logEvent("🏆 Achievement: Beacon of Hope!")
    }

    newState.achievements = achievements
    return newAchievement
  }

  const performAction = (type: string) => {
    if (state.gameOver) return

    setState((prevState) => {
      let newState = { ...prevState }
      let message = ''
      let popupTitle = 'Event'
      let timePassed = 0

      // Weather effects on actions
      const weatherModifier = {
        sunny: { energy: 0, success: 1.0 },
        cloudy: { energy: 0, success: 1.0 },
        rainy: { energy: -3, success: 0.8 },
        stormy: { energy: -5, success: 0.5 },
        hot: { energy: -4, success: 0.9 }
      }

      const modifier = weatherModifier[newState.weather]

      // Check if it's nighttime (after 20:00 or before 6:00)
      const isNight = newState.timeOfDay >= 20 || newState.timeOfDay < 6
      
      if (isNight && type !== 'rest' && type !== 'eat' && type !== 'drink' && type !== 'end_day' && type !== 'mindfulness') {
        popupTitle = 'Too Dark'
        message = `It's ${newState.timeOfDay}:00. Too dark to do that safely. You should rest or wait for morning.`
        newState.popup = { title: popupTitle, message }
        return newState
      }

      switch (type) {
        case 'search_area': {
          timePassed = 2
          const events = [
            {
              id: 'tide_pool',
              title: 'Tide Pool Mishap',
              message: "While exploring rocky shoreline, you slip and fall into a shallow tide pool. The cold water shocks your system, and sharp rocks scrape your leg. You climb out, shivering and nursing fresh wounds.",
              action: () => {
                newState.health = getClamped(newState.health, -10)
                newState.energy = getClamped(newState.energy, -10)
                newState.stress = getClamped(newState.stress, 10)
                newState.warmth = getClamped(newState.warmth, -15)
              }
            },
            {
              id: 'animal_tracks',
              title: 'Predator Signs',
              message: "You discover large, fresh animal tracks pressed deep into the mud near a water source. Whatever made these is big, and it passed through recently. Your heart races as you scan the treeline nervously.",
              action: () => {
                newState.stress = getClamped(newState.stress, 15)
              }
            },
            {
              id: 'crab_food',
              title: 'Lucky Find',
              message: "Lifting a large rock reveals a fat crab trying to hide underneath. Quick reflexes! You manage to catch it before it scuttles away. Fresh protein is rare out here.",
              action: () => {
                newState.rawFood = newState.rawFood + 1
                newState.hunger = getClamped(newState.hunger, 5)
              }
            },
            {
              id: 'rainwater',
              title: 'Natural Reservoir',
              message: "You notice water gleaming inside a hollowed tree trunk. Rainwater has collected here, relatively clean. You carefully gather what you can into makeshift containers.",
              action: () => {
                newState.rawWater = newState.rawWater + 1
                newState.thirst = getClamped(newState.thirst, 5)
              }
            },
            {
              id: 'driftwood',
              title: 'Beach Bounty',
              message: "The tide has brought in several pieces of weathered driftwood, dried by the sun and perfect for building or burning. You collect as much as you can carry.",
              action: () => {
                newState.wood = newState.wood + 2
              }
            },
            {
              id: 'calm_beauty',
              title: 'Moment of Peace',
              message: "You pause at a clifftop overlook. The ocean stretches endlessly before you, sparkling under the sun. Seabirds call overhead. For a moment, you forget your troubles and feel strangely at peace with this wild place.",
              action: () => {
                newState.stress = getClamped(newState.stress, -15)
                newState.energy = getClamped(newState.energy, 10)
              }
            },
            {
              id: 'useful_debris',
              title: 'Wreckage Discovery',
              message: "You find debris from what looks like a shipwreck - rope, plastic containers, even a rusty knife. These materials could be incredibly useful for survival.",
              action: () => {
                newState.wood = newState.wood + 1
                newState.stress = getClamped(newState.stress, -5)
              }
            }
          ]

          const unseen = events.filter(e => !newState.seenEvents.includes(e.id))
          const pool = unseen.length > 0 ? unseen : events
          const pick = pool[Math.floor(Math.random() * pool.length)]

          pick.action()
          popupTitle = pick.title
          message = pick.message
          newState.seenEvents = [...newState.seenEvents, pick.id]
          newState.energy = getClamped(newState.energy, -5)
          break
        }

        case 'rest':
          timePassed = 1
          popupTitle = 'Taking a Break'
          message = 'You find a shaded spot and lie down, letting your body recover. The sounds of the island - waves, birds, rustling leaves - gradually calm your racing thoughts. You feel a bit better.'
          newState.energy = getClamped(newState.energy, 15)
          newState.stress = getClamped(newState.stress, -10)
          newState.warmth = getClamped(newState.warmth, 5)
          break

        case 'find_wood': {
          timePassed = 2
          const found = Math.floor(Math.random() * 2) + 1
          popupTitle = 'Gathering Wood'
          message = `You spend time collecting fallen branches, driftwood, and dry twigs. You manage to gather ${found} usable pieces. Your arms ache from the work.`
          newState.wood = newState.wood + found
          newState.energy = getClamped(newState.energy, -8 + modifier.energy)
          break
        }

        case 'find_water': {
          timePassed = 2
          const baseChance = 0.6
          const found = Math.random() < (baseChance * modifier.success) ? 1 : 0
          if (found) {
            popupTitle = 'Water Source Located'
            message = 'Following the sound of trickling water, you discover a small stream feeding into a rocky pool. The water looks murky but it\'s better than nothing. You collect what you can.'
            newState.rawWater = newState.rawWater + found
            if (newState.weather === 'rainy') {
              newState.rawWater = newState.rawWater + 1
              message += ' The rain helps fill your containers even more!'
            }
          } else {
            popupTitle = 'Search Unsuccessful'
            message = 'Despite searching for over an hour, you find no water sources. The sun beats down mercilessly. Your throat grows drier with each passing minute.'
            newState.thirst = getClamped(newState.thirst, -5)
            if (newState.weather === 'stormy') {
              message = 'The storm makes it impossible to search safely. You return empty-handed and drenched.'
            }
          }
          newState.energy = getClamped(newState.energy, -8 + modifier.energy)
          break
        }

        case 'find_food': {
          timePassed = 2
          const baseChance = 0.6
          const found = Math.random() < (baseChance * modifier.success) ? 1 : 0
          if (found) {
            popupTitle = 'Foraging Success'
            message = 'Your search pays off! You find edible berries, some wild roots, and what looks like edible mushrooms. Not a feast, but it\'ll keep you going.'
            newState.rawFood = newState.rawFood + 1
            if (newState.weather === 'sunny') {
              message += ' The good weather made foraging easier!'
            }
          } else {
            popupTitle = 'Nothing Found'
            message = 'You search through undergrowth and along the beach but find nothing edible. Everything is either spoiled, unrecognizable, or potentially poisonous. Your stomach growls in protest.'
            newState.hunger = getClamped(newState.hunger, -5)
            if (newState.weather === 'stormy') {
              message = 'The violent storm forces you to abandon your search. Too dangerous to continue.'
            }
          }
          newState.energy = getClamped(newState.energy, -8 + modifier.energy)
          break
        }

        case 'build_shelter':
          timePassed = 3
          if (newState.wood >= 5) {
            popupTitle = 'Shelter Constructed'
            message = 'Using driftwood, branches, and large palm leaves, you construct a basic lean-to shelter. It\'s crude but should protect you from rain and wind. Having a home base makes you feel more secure.'
            newState.hasShelter = true
            newState.wood = newState.wood - 5
            newState.stress = getClamped(newState.stress, -15)
            newState.warmth = getClamped(newState.warmth, 10)
            newState.energy = getClamped(newState.energy, -10)
            newState.rescueProgress += 10
          } else {
            popupTitle = 'Insufficient Materials'
            message = `You need 5 pieces of wood to build a proper shelter. You only have ${newState.wood}. You'll need to gather more materials first.`
          }
          break

        case 'build_signal_fire':
          timePassed = 2
          if (newState.wood >= 10 && newState.hasShelter) {
            popupTitle = '🔦 Signal Fire Built!'
            message = 'You build a massive signal fire on the highest point of the beach. The smoke column rises high into the sky, visible for miles. Now you wait for rescue...'
            newState.signalFireBuilt = true
            newState.wood = newState.wood - 10
            newState.stress = getClamped(newState.stress, -20)
            newState.rescueProgress += 40
          } else if (!newState.hasShelter) {
            popupTitle = 'Need Shelter First'
            message = 'You should build a shelter before focusing on rescue. You need a safe place to wait.'
          } else {
            popupTitle = 'Insufficient Wood'
            message = `You need 10 pieces of wood for a proper signal fire. You only have ${newState.wood}.`
          }
          break

        case 'start_fire':
          timePassed = 1
          if (newState.wood >= 1) {
            const canStart = newState.weather !== 'rainy' && newState.weather !== 'stormy'
            if (canStart) {
              popupTitle = 'Fire Created'
              message = 'After patient work with dry tinder and friction, smoke begins to rise. You carefully nurse the ember into flame. Fire! The dancing flames bring warmth, light, and hope. This changes everything.'
              newState.fireLit = true
              newState.wood = newState.wood - 1
              newState.warmth = getClamped(newState.warmth, 20)
              newState.stress = getClamped(newState.stress, -10)
              newState.energy = getClamped(newState.energy, -5)
            } else {
              popupTitle = 'Too Wet'
              message = `The ${newState.weather === 'rainy' ? 'rain' : 'storm'} makes it impossible to start a fire. Everything is soaked. You'll need to wait for better weather.`
            }
          } else {
            popupTitle = 'No Wood Available'
            message = 'You need at least 1 piece of wood to start a fire. Better find some first.'
          }
          break

        case 'cook_food':
          timePassed = 0.5
          if (newState.rawFood >= 1 && newState.fireLit) {
            popupTitle = 'Cooking Meal'
            message = 'You prepare your foraged food over the fire, cooking it until safe to eat. The smell is incredible - smoky, savory, primal. Your mouth waters in anticipation.'
            newState.rawFood = Math.max(0, newState.rawFood - 1)
            newState.food = newState.food + 2
            newState.stress = getClamped(newState.stress, -5)
          } else if (!newState.fireLit) {
            popupTitle = 'No Fire'
            message = 'You need a fire to cook food safely. Eating raw food could make you sick.'
          } else {
            popupTitle = 'No Raw Food'
            message = 'You have nothing to cook. Better forage for some food first.'
          }
          break

        case 'boil_water':
          timePassed = 0.5
          if (newState.rawWater >= 1 && newState.fireLit) {
            popupTitle = 'Purifying Water'
            message = 'You boil the water in a makeshift container, watching bubbles rise and steam escape. After several minutes, you let it cool. The water is now safe to drink.'
            newState.rawWater = Math.max(0, newState.rawWater - 1)
            newState.water = newState.water + 2
          } else if (!newState.fireLit) {
            popupTitle = 'No Fire'
            message = 'You need fire to boil water. Drinking unclean water is risky.'
          } else {
            popupTitle = 'No Water to Boil'
            message = 'You have no water to purify. Find a water source first.'
          }
          break

        case 'eat':
          timePassed = 0.25
          if (newState.food > 0) {
            popupTitle = 'Eating'
            message = 'You eat slowly, savoring every bite. The food settles warmly in your stomach. Energy flows back into your body, and the gnawing hunger subsides.'
            newState.food = Math.max(0, newState.food - 1)
            newState.hunger = getClamped(newState.hunger, 25)
            newState.energy = getClamped(newState.energy, 10)
            newState.health = getClamped(newState.health, 5)
          } else {
            popupTitle = 'No Food'
            message = 'Your stomach is empty. You need to forage and cook food before you can eat.'
          }
          break

        case 'drink':
          timePassed = 0.25
          if (newState.water > 0) {
            popupTitle = 'Drinking'
            message = 'The clean water is refreshing beyond words. You drink deeply, feeling it revitalize your body. Your head clears and strength returns.'
            newState.water = Math.max(0, newState.water - 1)
            newState.thirst = getClamped(newState.thirst, 25)
            newState.energy = getClamped(newState.energy, 5)
            newState.health = getClamped(newState.health, 5)
          } else {
            popupTitle = 'No Clean Water'
            message = 'You have no clean water to drink. Find and boil water first.'
          }
          break

        case 'mindfulness':
          timePassed = 0.5
          popupTitle = 'Meditation'
          message = 'You sit cross-legged and focus on your breathing. In... out... in... out... The panic and stress gradually fade. You remind yourself: you\'re surviving. You\'re adapting. You\'re stronger than you knew.'
          newState.stress = getClamped(newState.stress, -15)
          newState.energy = getClamped(newState.energy, 8)
          break

        case 'end_day': {
          // Reset to next morning
          newState.timeOfDay = 6
          
          const hungerPenalty = newState.hunger < 20 ? -15 : 0
          const thirstPenalty = newState.thirst < 20 ? -20 : 0
          const coldPenalty = newState.warmth < 20 ? -10 : 0
          const stressPenalty = newState.stress > 90 ? -10 : 0
          const shelterBonus = newState.hasShelter ? 5 : 0

          const totalChange = hungerPenalty + thirstPenalty + coldPenalty + stressPenalty + shelterBonus

          // Change weather for next day
          const oldWeather = newState.weather
          newState.weather = getRandomWeather()

          popupTitle = 'Night Falls'
          let nightDesc = 'As darkness falls, you settle in for the night. '
          if (totalChange < -20) nightDesc += 'Your body is suffering. Hunger, thirst, and cold make sleep nearly impossible.'
          else if (totalChange < 0) nightDesc += 'You sleep fitfully, troubled by discomfort and worry.'
          else nightDesc += 'You rest relatively well, feeling prepared for tomorrow.'

          const weatherMessages = {
            sunny: '☀️ Morning breaks with clear skies and sunshine.',
            cloudy: '☁️ Dawn brings overcast skies.',
            rainy: '🌧️ You wake to the sound of rain.',
            stormy: '⛈️ Thunder rumbles as a storm rolls in!',
            hot: '🔥 The morning sun is already scorching hot.'
          }

          message = nightDesc + ' ' + weatherMessages[newState.weather]

          newState.health = getClamped(newState.health, totalChange)
          newState.energy = getClamped(newState.energy, -25)
          newState.hunger = getClamped(newState.hunger, -15)
          newState.thirst = getClamped(newState.thirst, -20)
          newState.stress = getClamped(newState.stress, 8)
          newState.warmth = getClamped(newState.warmth, -15)
          newState.dayNumber = newState.dayNumber + 1
          newState.totalDaysAlive = newState.dayNumber
          
          // Check for rescue
          if (newState.signalFireBuilt) {
            const rescueChance = Math.random() * 100
            newState.rescueProgress += 15
            
            if (newState.rescueProgress >= 100 || rescueChance < (newState.dayNumber * 3)) {
              newState.gameOver = true
              newState.gameOverReason = `After ${newState.dayNumber} days, a search plane spots your signal fire! A helicopter arrives within hours. You're going home!`
              achievements[6].unlocked = true
              message = '🚁 In the distance, you hear the sound of helicopter blades! Your signal fire worked!'
            } else {
              message += ` Your signal fire burns through the night. Rescue progress: ${Math.min(100, newState.rescueProgress)}%`
            }
          }
          
          if (newState.fireLit) {
            newState.fireLit = false
            if (!newState.signalFireBuilt) {
              message += ' Your fire burns out during the night.'
            }
          }

          // Apply weather effects
          applyWeatherEffects(newState)
          break
        }

        default:
          message = 'Nothing happens.'
      }

      // Advance time and apply passive effects
      if (timePassed > 0) {
        newState.timeOfDay += timePassed
        
        // Passive stat decay based on time passed
        const hourlyDecay = {
          hunger: -1.5,
          thirst: -2,
          energy: -2,
          warmth: -1
        }
        
        newState.hunger = getClamped(newState.hunger, hourlyDecay.hunger * timePassed)
        newState.thirst = getClamped(newState.thirst, hourlyDecay.thirst * timePassed)
        newState.energy = getClamped(newState.energy, hourlyDecay.energy * timePassed)
        newState.warmth = getClamped(newState.warmth, hourlyDecay.warmth * timePassed)
        
        // Check if day ended naturally (past 20:00)
        if (newState.timeOfDay >= 20) {
          newState.timeOfDay = 20
        }
      }

      // Check achievements
      checkAchievements(newState)

      newState.actionsTaken += 1
      const isDead = newState.health <= 0

      if (isDead) {
        newState.gameOver = true
        newState.gameOverReason = 'Your injuries and hardships proved too much. The island has claimed another victim.'
        newState.totalDaysAlive = newState.dayNumber
      }

      newState.popup = { title: popupTitle, message }
      logEvent(`${popupTitle}: ${message.split('.')[0]}...`)

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

function IntroductionScreen() {
  const { startGame } = useGame()

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-900 via-teal-800 to-green-900">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          <h1 className="text-4xl font-bold text-white text-center mb-6">
            🏝️ Island Survival
          </h1>
          <div className="space-y-3 text-white/90 text-base leading-relaxed">
            <p>
              Your plane went down in a storm. You barely made it to shore before losing consciousness.
            </p>
            <p>
              Now you wake on an uncharted tropical island - alone, injured, with nothing but the clothes on your back.
            </p>
            <p className="text-amber-200 font-semibold">
              Can you survive long enough to be rescued?
            </p>
          </div>
          <div className="mt-6">
            <button
              onClick={startGame}
              className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold py-3 px-8 rounded-xl transition-all duration-200 shadow-lg"
            >
              🚁 Begin Survival
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function StatsPanel() {
  const { health, stress, hunger, thirst, warmth, energy, food, water, rawFood, rawWater, wood, hasShelter, fireLit, dayNumber, weather, timeOfDay, signalFireBuilt, rescueProgress } = useGame()
  
  const getStatColor = (value: number, inverse = false) => {
    if (inverse) {
      if (value >= 80) return 'text-red-400'
      if (value >= 50) return 'text-yellow-400'
      return 'text-green-400'
    }
    if (value <= 20) return 'text-red-400'
    if (value <= 50) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getWeatherDisplay = () => {
    const weatherInfo = {
      sunny: { icon: '☀️', label: 'Sunny', color: 'bg-yellow-500/30 text-yellow-200' },
      cloudy: { icon: '☁️', label: 'Cloudy', color: 'bg-gray-500/30 text-gray-200' },
      rainy: { icon: '🌧️', label: 'Rainy', color: 'bg-blue-500/30 text-blue-200' },
      stormy: { icon: '⛈️', label: 'Stormy', color: 'bg-purple-500/30 text-purple-200' },
      hot: { icon: '🔥', label: 'Hot', color: 'bg-orange-500/30 text-orange-200' }
    }
    return weatherInfo[weather]
  }

  const getTimeDisplay = () => {
    const hour = Math.floor(timeOfDay)
    const minutes = Math.round((timeOfDay - hour) * 60)
    const timeString = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    
    let period = '🌅 Morning'
    let color = 'bg-amber-400/30 text-amber-200'
    
    if (hour >= 12 && hour < 17) {
      period = '☀️ Afternoon'
      color = 'bg-yellow-400/30 text-yellow-200'
    } else if (hour >= 17 && hour < 20) {
      period = '🌆 Evening'
      color = 'bg-orange-400/30 text-orange-200'
    } else if (hour >= 20 || hour < 6) {
      period = '🌙 Night'
      color = 'bg-indigo-500/30 text-indigo-200'
    }
    
    return { timeString, period, color }
  }

  const weatherDisplay = getWeatherDisplay()
  const timeDisplay = getTimeDisplay()

  const Stat = ({ icon, label, value, inverse = false }: { icon: string; label: string; value: number; inverse?: boolean }) => (
    <div className="flex justify-between items-center text-xs bg-white/5 px-2 py-1.5 rounded-lg backdrop-blur-sm">
      <span className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-white/80">{label}</span>
      </span>
      <span className={`font-bold ${getStatColor(value, inverse)}`}>{value}</span>
    </div>
  )

  const Resource = ({ icon, label, value }: { icon: string; label: string; value: number }) => (
    <div className="flex justify-between items-center text-xs bg-white/5 px-2 py-1.5 rounded-lg backdrop-blur-sm">
      <span className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-white/80">{label}</span>
      </span>
      <span className="font-bold text-blue-300">{value}</span>
    </div>
  )

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-amber-400">Day {dayNumber}</h2>
        <div className="flex gap-2 text-xs flex-wrap justify-end">
          <span className={`px-2 py-1 rounded-full ${timeDisplay.color}`}>
            {timeDisplay.period} {timeDisplay.timeString}
          </span>
          <span className={`px-2 py-1 rounded-full ${weatherDisplay.color}`}>
            {weatherDisplay.icon} {weatherDisplay.label}
          </span>
          <span className={`px-2 py-1 rounded-full ${hasShelter ? 'bg-green-500/30 text-green-200' : 'bg-white/10 text-white/60'}`}>
            🏠 {hasShelter ? 'Shelter' : 'No Shelter'}
          </span>
          <span className={`px-2 py-1 rounded-full ${fireLit ? 'bg-orange-500/30 text-orange-200' : 'bg-white/10 text-white/60'}`}>
            🔥 {fireLit ? 'Fire' : 'No Fire'}
          </span>
        </div>
      </div>
      
      {signalFireBuilt && (
        <div className="mb-3 bg-blue-500/20 border border-blue-400/30 rounded-lg p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-blue-200 font-semibold">🔦 Rescue Progress</span>
            <span className="text-xs text-blue-200">{Math.min(100, rescueProgress)}%</span>
          </div>
          <div className="w-full bg-blue-900/30 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, rescueProgress)}%` }}
            ></div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <Stat icon="❤️" label="Health" value={health} />
        <Stat icon="😰" label="Stress" value={stress} inverse />
        <Stat icon="🍖" label="Hunger" value={hunger} />
        <Stat icon="💧" label="Thirst" value={thirst} />
        <Stat icon="🔥" label="Warmth" value={warmth} />
        <Stat icon="⚡" label="Energy" value={energy} />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Resource icon="🥫" label="Food" value={food} />
        <Resource icon="🚰" label="Water" value={water} />
        <Resource icon="🪵" label="Wood" value={wood} />
        <Resource icon="🦀" label="Raw Food" value={rawFood} />
        <Resource icon="🥤" label="Raw H₂O" value={rawWater} />
        <div></div>
      </div>
    </div>
  )
}

function ActionPanel() {
  const { performAction, gameOver, hasShelter, signalFireBuilt } = useGame()
  if (gameOver) return null
  
  const actions = [
    { type: 'search_area', label: 'Search', icon: '🔍', color: 'from-purple-500/80 to-purple-600/80' },
    { type: 'rest', label: 'Rest', icon: '😌', color: 'from-blue-500/80 to-blue-600/80' },
    { type: 'find_food', label: 'Forage', icon: '🌿', color: 'from-green-500/80 to-green-600/80' },
    { type: 'find_water', label: 'Water', icon: '💧', color: 'from-cyan-500/80 to-cyan-600/80' },
    { type: 'find_wood', label: 'Wood', icon: '🪵', color: 'from-amber-500/80 to-amber-600/80' },
    { type: 'build_shelter', label: 'Shelter', icon: '🏠', color: 'from-gray-500/80 to-gray-600/80', hidden: hasShelter },
    { type: 'build_signal_fire', label: 'Signal Fire', icon: '🔦', color: 'from-cyan-400/80 to-blue-500/80', hidden: signalFireBuilt },
    { type: 'start_fire', label: 'Fire', icon: '🔥', color: 'from-orange-500/80 to-red-500/80' },
    { type: 'cook_food', label: 'Cook', icon: '🍳', color: 'from-yellow-500/80 to-orange-500/80' },
    { type: 'boil_water', label: 'Boil', icon: '🫖', color: 'from-blue-400/80 to-cyan-500/80' },
    { type: 'eat', label: 'Eat', icon: '🍽️', color: 'from-green-400/80 to-green-500/80' },
    { type: 'drink', label: 'Drink', icon: '🚰', color: 'from-cyan-400/80 to-blue-400/80' },
    { type: 'mindfulness', label: 'Meditate', icon: '🧘', color: 'from-indigo-500/80 to-purple-500/80' },
    { type: 'end_day', label: 'Sleep', icon: '🌙', color: 'from-gray-600/80 to-gray-700/80' },
  ].filter(action => !action.hidden)
  
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {actions.map(({ type, label, icon, color }) => (
        <motion.button 
          key={type} 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => performAction(type)} 
          className={`bg-gradient-to-br ${color} backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-white font-semibold p-2 border border-white/10`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xl">{icon}</span>
            <span className="text-[10px]">{label}</span>
          </div>
        </motion.button>
      ))}
    </div>
  )
function ActionPanel() {
  const { performAction, gameOver, hasShelter, signalFireBuilt } = useGame()
  if (gameOver) return null
  
  const actions = [
    { type: 'search_area', label: 'Search', icon: '🔍', color: 'from-purple-500/80 to-purple-600/80' },
    { type: 'rest', label: 'Rest', icon: '😌', color: 'from-blue-500/80 to-blue-600/80' },
    { type: 'find_food', label: 'Forage', icon: '🌿', color: 'from-green-500/80 to-green-600/80' },
    { type: 'find_water', label: 'Water', icon: '💧', color: 'from-cyan-500/80 to-cyan-600/80' },
    { type: 'find_wood', label: 'Wood', icon: '🪵', color: 'from-amber-500/80 to-amber-600/80' },
    { type: 'build_shelter', label: 'Shelter', icon: '🏠', color: 'from-gray-500/80 to-gray-600/80', hidden: hasShelter },
    { type: 'build_signal_fire', label: 'Signal Fire', icon: '🔦', color: 'from-cyan-400/80 to-blue-500/80', hidden: signalFireBuilt },
    { type: 'start_fire', label: 'Fire', icon: '🔥', color: 'from-orange-500/80 to-red-500/80' },
    { type: 'cook_food', label: 'Cook', icon: '🍳', color: 'from-yellow-500/80 to-orange-500/80' },
    { type: 'boil_water', label: 'Boil', icon: '🫖', color: 'from-blue-400/80 to-cyan-500/80' },
    { type: 'eat', label: 'Eat', icon: '🍽️', color: 'from-green-400/80 to-green-500/80' },
    { type: 'drink', label: 'Drink', icon: '🚰', color: 'from-cyan-400/80 to-blue-400/80' },
    { type: 'mindfulness', label: 'Meditate', icon: '🧘', color: 'from-indigo-500/80 to-purple-500/80' },
    { type: 'end_day', label: 'Sleep', icon: '🌙', color: 'from-gray-600/80 to-gray-700/80' },
  ].filter(action => !action.hidden)
  
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {actions.map(({ type, label, icon, color }) => (
        <motion.button 
          key={type} 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => performAction(type)} 
          className={`bg-gradient-to-br ${color} backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-white font-semibold p-2 border border-white/10`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xl">{icon}</span>
            <span className="text-[10px]">{label}</span>
          </div>
        </motion.button>
      ))}
    </div>
  )
}
  
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {actions.map(({ type, label, icon, color }) => (
        <motion.button 
          key={type} 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => performAction(type)} 
          className={`bg-gradient-to-br ${color} backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-white font-semibold p-2 border border-white/10`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xl">{icon}</span>
            <span className="text-[10px]">{label}</span>
          </div>
        </motion.button>
      ))}
    </div>
  )
}

function StoryLog() {
  const { log } = useGame()
  return (
    <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10">
      <h2 className="text-sm font-bold mb-2 text-amber-400 flex items-center gap-1.5">
        <span className="text-base">📋</span> Event Log
      </h2>
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {[...log].reverse().map((entry, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-white/70 leading-relaxed border-l-2 border-amber-500/50 pl-2 py-0.5"
          >
            {entry}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function PopupDialog() {
  const { popup, closePopup } = useGame()
  
  return (
    <AnimatePresence>
      {popup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4"
          onClick={closePopup}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white/10 backdrop-blur-md text-white p-6 rounded-2xl max-w-md w-full border border-white/20 shadow-2xl"
          >
            <h3 className="text-xl font-bold mb-3 text-amber-400">{popup.title}</h3>
            <p className="mb-5 leading-relaxed text-sm text-white/90">{popup.message}</p>
            <button
              onClick={closePopup}
              className="w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-900 rounded-lg transition-all duration-200 font-bold shadow-lg text-sm"
            >
              Continue
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function GameOverScreen() {
  const { gameOverReason, dayNumber, actionsTaken, achievements, totalDaysAlive } = useGame()
  
  const unlockedAchievements = achievements.filter(a => a.unlocked)
  const isRescued = achievements.find(a => a.id === 'rescued')?.unlocked
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-red-900 via-gray-900 to-black">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-red-500/30 shadow-2xl">
          <div className="text-center">
            <div className="text-6xl mb-4">{isRescued ? '🚁' : '💀'}</div>
            <h2 className={`text-3xl font-bold mb-4 ${isRescued ? 'text-green-400' : 'text-red-400'}`}>
              {isRescued ? 'Rescued!' : 'Game Over'}
            </h2>
            <p className="text-white/90 mb-4 leading-relaxed">
              {gameOverReason}
            </p>
            <div className="bg-white/5 rounded-lg p-4 mb-4">
              <p className="text-white/60 text-sm mb-2">You survived:</p>
              <p className="text-amber-400 font-bold text-2xl">{totalDaysAlive} days</p>
              <p className="text-white/60 text-sm mt-3">Actions taken: {actionsTaken}</p>
            </div>
            
            {unlockedAchievements.length > 0 && (
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <p className="text-white/80 font-semibold mb-2 text-sm">🏆 Achievements Unlocked</p>
                <div className="grid grid-cols-2 gap-2">
                  {unlockedAchievements.map(achievement => (
                    <div key={achievement.id} className="bg-amber-500/20 rounded p-2 text-xs">
                      <div className="text-lg mb-1">{achievement.icon}</div>
                      <div className="text-amber-200 font-semibold">{achievement.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className={`w-full ${isRescued ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 shadow-lg`}
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function IslandSurvivalGame() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  )
}

function GameContent() {
  const { hasGameStarted, gameOver } = useGame()

  if (!hasGameStarted) return <IntroductionScreen />
  if (gameOver) return <GameOverScreen />

  return (
    <div className="min-h-screen text-white p-4 flex flex-col items-center justify-center bg-gradient-to-br from-teal-900 via-green-800 to-blue-900">
      <div className="bg-white/10 backdrop-blur-md p-5 rounded-3xl w-full max-w-2xl border border-white/20 shadow-2xl">
        <h1 className="text-2xl font-bold mb-4 text-center text-white">
          🏝️ Island Survival
        </h1>
        <StatsPanel />
        <ActionPanel />
        <StoryLog />
      </div>
      <PopupDialog />
    </div>
  )
}