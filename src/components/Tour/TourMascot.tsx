'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

type Size = 'sm' | 'md' | 'lg'
type Color = 'purple' | 'blue' | 'pink' | 'green'

export function TourMascot({
  emotion = 'happy',
  size = 'md',
  enter = false,
  enterFrom = 'left'
}: {
  emotion?: 'happy' | 'excited' | 'winking'
  size?: Size
  /** Slide-in on first show */
  enter?: boolean
  /** Which side to fly in from */
  enterFrom?: 'left' | 'right'
}) {
  const sizeClasses: Record<Size, string> = { sm: 'w-12 h-12', md: 'w-16 h-16', lg: 'w-20 h-20' }
  const offset = enterFrom === 'left' ? -220 : 220

  return (
    <motion.div
      initial={enter ? { x: offset, opacity: 0, scale: 0.95 } : false}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative"
    >
      {/* Inner bobbing/expressions */}
      <motion.div
        className={`${sizeClasses[size]} relative`}
        animate={{
          y: [0, -4, 0],
          rotate: emotion === 'excited' ? [0, 5, -5, 0] : 0
        }}
        transition={{
          y: { duration: 2, repeat: Infinity },
          rotate: { duration: 0.6, repeat: Infinity }
        }}
      >
        {/* Body */}
        <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-500 rounded-full relative overflow-visible border-4 border-white shadow-lg">
          {/* Eyes */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex gap-1 items-center">
              <div className="w-2 h-2 bg-white rounded-full">
                <div className="w-1 h-1 bg-gray-800 rounded-full m-0.5" />
              </div>
              <div className="w-2 h-2 bg-white rounded-full overflow-hidden">
                <div className={`bg-gray-800 rounded-full ${emotion === 'winking' ? 'w-2 h-0.5 mt-0.5' : 'w-1 h-1 m-0.5'}`} />
              </div>
            </div>
          </div>

          {/* Smile */}
          <div
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 w-5 h-1.5 rounded-full ${
              emotion === 'excited' ? 'bg-yellow-300' : 'bg-pink-200'
            }`}
          />

          {/* Sparkles */}
          {emotion === 'excited' && (
            <>
              <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-yellow-300 animate-pulse" />
              <Sparkles className="absolute -bottom-1 -left-1 w-3 h-3 text-blue-300 animate-pulse" />
            </>
          )}
        </div>

        {/* Drop shadow */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-2 bg-black/10 rounded-full blur-sm" />
      </motion.div>
    </motion.div>
  )
}

export function SpeechBubble({
  children,
  position = 'right',
  color = 'purple',
  enter = false,
  enterFrom = 'left'
}: {
  children: React.ReactNode
  position?: 'left' | 'right'
  color?: Color
  /** Slide-in with a slight delay */
  enter?: boolean
  enterFrom?: 'left' | 'right'
}) {
  const map: Record<Color, string> = {
    purple: 'bg-white border-purple-300 text-gray-900',
    blue: 'bg-white border-blue-300 text-gray-900',
    pink: 'bg-white border-pink-300 text-gray-900',
    green: 'bg-white border-green-300 text-gray-900'
  }
  const offset = enterFrom === 'left' ? -120 : 120

  return (
    <motion.div
      initial={enter ? { x: offset, opacity: 0 } : false}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: enter ? 0.08 : 0 }}
      className={`relative max-w-xs p-4 rounded-2xl border-2 ${map[color]} shadow-xl`}
    >
      <div className="text-sm leading-relaxed text-current">{children}</div>
      {/* Tail */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 ${
          position === 'right' ? '-left-2' : '-right-2'
        } w-4 h-4 rotate-45 bg-white border-2 ${
          position === 'right' ? 'border-l-purple-300 border-t-purple-300' : 'border-r-purple-300 border-b-purple-300'
        }`}
      />
    </motion.div>
  )
}

// Demo
export default function Demo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-8 flex items-center justify-center">
      <div className="flex items-center gap-4">
        <TourMascot emotion="excited" size="lg" enter enterFrom="left" />
        <SpeechBubble color="purple" enter enterFrom="left">
          <strong>Hi there!</strong> I'm your friendly tour guide. No pointing arm needed! 👋
        </SpeechBubble>
      </div>
    </div>
  )
}