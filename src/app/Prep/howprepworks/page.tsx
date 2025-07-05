'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo } from 'react'
import Lottie from 'lottie-react'

// Lottie Animations
import chronotypeAnimation from '@/lotties/sun.json'
import brainAnimation from '@/lotties/brain.json'
import jetlagAnimation from '@/lotties/airplane.json'
import lifestyleAnimation from '@/lotties/lifestyle.json'
import athleteAnimation from '@/lotties/athlete.json'

import sunAnimation from '@/lotties/sun.json'
import ongAnimation from '@/lotties/Pong_1.json'
import learningAnimation from '@/lotties/learning.json'
import memoryAnimation from '@/lotties/memory.json'

export default function PrepLandingPage() {
  const router = useRouter()
  const [currentHour, setCurrentHour] = useState(6)
  const [isPlaying, setIsPlaying] = useState(false)
  const [mounted, setMounted] = useState(false)

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const navigateToChronotype = useCallback(() => {
    router.push('/Prep/chronotype')
  }, [router])

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => setCurrentHour(h => (h + 1) % 24), 1000)
    return () => clearInterval(interval)
  }, [isPlaying])

  useEffect(() => {
    if (!mounted) return
    const timeout = setTimeout(() => setIsPlaying(true), 2000)
    return () => clearTimeout(timeout)
  }, [mounted])

  const togglePlayback = useCallback(() => setIsPlaying(p => !p), [])

  const learningData = useMemo(() => [
    40, 35, 30, 35, 45, 55, 70, 85, 90, 85, 80, 75,
    70, 60, 50, 45, 55, 70, 80, 75, 65, 55, 50, 45
  ], [])

  const computed = useMemo(() => {
    const val = learningData[currentHour]
    const hr = currentHour % 12 || 12
    const period = currentHour < 12 ? 'AM' : 'PM'
    const rotate = currentHour * 15 + 90
    const isDay = currentHour >= 6 && currentHour < 18

    const perfColor = val >= 80 ? 'text-green-500' : val >= 60 ? 'text-yellow-500' : 'text-red-500'
    const gradient =
      currentHour < 10 ? 'from-orange-200 via-yellow-200 to-pink-200' :
      currentHour < 15 ? 'from-blue-200 via-cyan-200 to-green-200' :
      currentHour < 18 ? 'from-purple-200 via-pink-200 to-indigo-200' :
      currentHour < 21 ? 'from-pink-300 via-purple-300 to-indigo-300' :
                         'from-gray-600 via-blue-800 to-purple-800'

    return {
      val, hr, period, rotate, isDay,
      perfColor,
      gradient,
      celestial: isDay ? '☀️' : '🌙',
      celestialClass: isDay
        ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-yellow-400/50'
        : 'bg-gradient-to-br from-gray-300 to-gray-500 shadow-gray-400/50'
    }
  }, [currentHour, learningData])

  const helpSections = [
    {
      title: 'Understand Your Chronotype',
      color: 'from-yellow-50 to-pink-100',
      text: `Your natural rhythm—called your chronotype—is influenced by your sleep, activity, and diet habits. We help you figure out whether you're a morning, evening, or somewhere-in-between type.`,
      animation: sunAnimation,
    },
    {
      title: 'Measure Your Mind (the Fun Way)',
      color: 'from-pink-100 to-purple-100',
      text: `Prep uses short, clinically validated games that test your memory, focus, and thinking speed. These aren’t just any games—they’re based on the same tests used in neuroscience labs.`,
      animation: ongAnimation,
    },
    {
      title: 'Match Lifestyle to Learning',
      color: 'from-purple-100 to-blue-100',
      text: `Once we know your brain’s rhythm and cognitive strengths, we suggest simple changes—adjusting sleep, improving your environment, timing meals—to help you peak when it matters most.`,
      animation: learningAnimation,
    },
    {
      title: 'Target Specific Skills',
      color: 'from-blue-100 to-green-100',
      text: `Want to boost memory during study hours? Or recall during exam time? Prep helps you train exactly what you need, when you need it—based on your profile and schedule.`,
      animation: memoryAnimation,
    }
  ]

  return (
    <main className="min-h-screen font-sans text-gray-900 bg-white scroll-smooth">
      {/* Welcome */}
      <section className="bg-gradient-to-br from-yellow-100 to-pink-100 py-24 px-6 text-center min-h-screen flex flex-col justify-center items-center">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6">Welcome to <span className="text-pink-500">Prep</span> 🎓</h1>
        <p className="text-lg md:text-xl max-w-3xl mx-auto mb-10 text-gray-700">
          A smarter way to boost focus, memory, and grades—by syncing your learning to your brain's natural rhythm.
        </p>
        <button
          onClick={() => scrollToSection('how-it-works')}
          className="bg-pink-600 hover:bg-pink-500 text-white px-8 py-4 rounded-full text-lg font-semibold shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Learn More
        </button>
      </section>

      {/* Explainers */}
      <section className="bg-white py-20 px-6" id="how-it-works">
        <div className="max-w-6xl mx-auto space-y-24">
          {[
            {
              title: 'Your natural rhythm affects how you learn',
              animation: chronotypeAnimation,
              color: 'text-pink-600',
              text: 'Everyone has a chronotype. Some people peak early in the day, others later. When you learn matters almost as much as what you learn.'
            },
            {
              title: 'Your brain works differently across the day',
              animation: brainAnimation,
              color: 'text-purple-600',
              text: 'Memory, attention, and thinking speed fluctuate with your internal clock. Learning at the wrong time can mean wasted effort.'
            },
            {
              title: "School schedules don't fit everyone",
              animation: jetlagAnimation,
              color: 'text-blue-600',
              text: "Students who are out of sync feel like they're studying while jet-lagged. It's not laziness—it's biology."
            },
            {
              title: 'Prep helps you align your day to your brain',
              animation: lifestyleAnimation,
              color: 'text-green-600',
              text: 'We guide you to tweak sleep, routines, and study blocks to match your rhythm—so you learn better and score higher.'
            },
            {
              title: 'Used by elite performers—adapted for students',
              animation: athleteAnimation,
              color: 'text-indigo-600',
              text: "We've used this same system to help world-class athletes perform through constant travel. Now, it's tuned to help you thrive in school or university."
            }
          ].map((s, i) => (
            <div key={i} className={`flex flex-col ${i % 2 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12`}>
              <div className="md:w-1/2 h-80 flex items-center justify-center">
                <Lottie animationData={s.animation} loop className="w-full h-full max-w-sm" />
              </div>
              <div className="md:w-1/2 text-center md:text-left">
                <h3 className={`text-2xl md:text-3xl font-bold ${s.color} mb-4`}>{s.title}</h3>
                <p className="text-gray-600 text-lg">{s.text}</p>
              </div>
            </div>
          ))}
          <div className="text-center pt-8">
            <button
              onClick={navigateToChronotype}
              className="bg-purple-600 hover:bg-purple-500 text-white px-10 py-4 rounded-full text-lg font-semibold shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              🔍 Discover Your Chronotype
            </button>
          </div>
        </div>
      </section>

      {/* Circadian Learning */}
      <section className={`py-20 px-6 bg-gradient-to-br ${computed.gradient}`}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">🧠 Your Brain's Natural Learning Rhythm</h2>
          <p className="text-lg text-gray-700 mb-12">Discover how your learning ability naturally peaks and dips throughout the day.</p>
          <div className="relative mx-auto mb-12 w-80 h-80">
            <div className="absolute inset-0 border-2 border-white/30 rounded-full bg-white/10 backdrop-blur-sm" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex flex-col items-center justify-center">
              <div className={`text-4xl font-bold ${computed.perfColor}`}>{computed.val}%</div>
              <div className="text-sm mt-2 font-medium uppercase text-gray-700">Learning</div>
            </div>
            <div className="absolute inset-0 transition-transform duration-1000 ease-linear" style={{ transform: `rotate(${computed.rotate}deg)` }}>
              <div className={`absolute w-12 h-12 rounded-full ${computed.celestialClass} -top-6 left-1/2 transform -translate-x-1/2 flex items-center justify-center text-xl`}>
                {computed.celestial}
              </div>
            </div>
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
              <div className="text-xl font-bold text-purple-600">{computed.hr}:00 {computed.period}</div>
            </div>
          </div>
          <button
            onClick={togglePlayback}
            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-8 py-3 rounded-full font-medium shadow-lg transition-transform hover:scale-105 active:scale-95 mb-12"
          >
            {isPlaying ? '⏸️ Pause Cycle' : '▶️ Start Day Cycle'}
          </button>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Insight icon="🌅" title="Morning Peak" desc="Your brain hits 90% learning capacity around 9–10 AM." />
            <Insight icon="😴" title="Afternoon Dip" desc="Energy drops to 50–60% around 2–3 PM." />
            <Insight icon="🌆" title="Evening Recovery" desc="A second wind lifts you back to 75–80% by evening." />
          </div>
        </div>
      </section>

      {/* How Prep Can Help */}
      <section className="bg-white py-20 px-6 text-center">
        <h2 className="text-[2.5rem] leading-[2.75rem] font-bold text-purple-700 mb-10">🌟 How Prep Can Help</h2>
        {helpSections.map((section, i) => (
          <section key={i} className={`bg-gradient-to-br ${section.color} py-20 px-6`}>
            <div className={`max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
              <div className="md:w-1/2 h-80 rounded-[2rem] shadow-lg flex items-center justify-center bg-white/20 backdrop-blur-sm">
                <Lottie animationData={section.animation} loop className="w-full h-full max-w-sm" />
              </div>
              <div className="md:w-1/2">
                <h2 className="text-[1.75rem] leading-[2rem] font-bold text-gray-900 mb-4">{section.title}</h2>
                <p className="text-[1.25rem] leading-[1.75rem] text-gray-700">{section.text}</p>
              </div>
            </div>
          </section>
        ))}
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-10 text-sm text-gray-500 text-center">
        <p>© {new Date().getFullYear()} Prep by Chiasmatic. All rights reserved.</p>
        <div className="mt-4 space-x-4">
          <a href="/privacy" className="hover:underline hover:text-gray-700 transition-colors">Privacy</a>
          <a href="/contact" className="hover:underline hover:text-gray-700 transition-colors">Contact</a>
        </div>
      </footer>
    </main>
  )
}

const Insight = ({ icon, title, desc }) => (
  <div className="bg-white/30 backdrop-blur-sm rounded-xl p-6 border border-white/40 hover:bg-white/40 transition-transform transform hover:scale-105">
    <div className="text-2xl mb-2">{icon}</div>
    <h3 className="font-semibold text-lg mb-2 text-gray-800">{title}</h3>
    <p className="text-gray-700 text-sm">{desc}</p>
  </div>
)
