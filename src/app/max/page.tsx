'use client'

import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

// Fixed import paths to use @ alias
import mainAppAnimation from '@/lotties/main_app.json'
import maxAiAnimation from '@/lotties/max-ai.json'
import trackSleepAnimation from '@/lotties/track_sleep.json'
import pongAnimation from '@/lotties/Pong.json'
import guessingAnimation from '@/lotties/guessing.json'
import dataDrivenAnimation from '@/lotties/Data_Driven.json'
import athleteAnimation from '@/lotties/athlete.json'

export default function MaxLandingPage() {
  return (
    <main className="min-h-screen bg-black text-white font-sans">
      {/* New Hero Section */}
      <section className="bg-black py-24 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4">Max</h1>
            <p className="text-lg md:text-xl text-gray-300 mb-6">Sleep Optimization App</p>
            <Link
              href="/info_pages"
              className="inline-block px-6 py-3 bg-purple-600 rounded-xl text-white hover:bg-purple-500 transition"
            >
              Learn More
            </Link>
          </div>
          <div className="w-full flex justify-center">
            <Lottie animationData={mainAppAnimation} loop={true} className="w-full max-w-md" />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-[#0f0f0f] py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">How It Works</h2>
          <p className="text-gray-400 text-lg">
            Max guides you through daily experiments that combine sleep, stress, cognitive tests, and behavior change. Your real data reveals what works best.
          </p>
        </div>
      </section>

      {/* Meet Max */}
      <section className="bg-gradient-to-b from-black to-gray-900 py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Meet Max</h2>
            <p className="text-gray-400 mb-4">
              Your AI-powered guide to smarter sleep, sharper cognition, and better performance.
            </p>
            <Link
              href="/start-info"
              className="inline-block px-6 py-3 bg-purple-600 rounded-xl text-white hover:bg-purple-500 transition"
            >
              Ready to Begin
            </Link>
          </div>
          <div className="w-full flex justify-center">
            <Lottie animationData={maxAiAnimation} loop={true} className="w-full max-w-md" />
          </div>
        </div>
      </section>

      {/* Validated Cognitive Testing */}
      <section className="bg-[#1a1a1a] py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Validated Cognitive Testing</h2>
            <p className="text-gray-400 mb-4">
              Max includes tests used by elite athletes, neuroscientists, and doctors to measure attention, memory, and reaction time — all simplified for everyday use.
            </p>
            <Link
              href="/start-info"
              className="inline-block px-6 py-3 bg-purple-600 rounded-xl text-white hover:bg-purple-500 transition"
            >
              Ready to Begin
            </Link>
          </div>
          <div className="w-full flex justify-center">
            <Lottie animationData={pongAnimation} loop={true} className="w-full max-w-md" />
          </div>
        </div>
      </section>

      {/* Sleep Optimization */}
      <section className="bg-gradient-to-b from-[#0a0a0a] to-black py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="w-full flex justify-center">
            <Lottie animationData={trackSleepAnimation} loop={true} className="w-full max-w-md" />
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Sleep Optimization</h2>
            <p className="text-gray-400 mb-4">
              Track how your lifestyle impacts your REM, deep, and total sleep. Max helps you understand what habits support the best recovery.
            </p>
            <Link
              href="/start-info"
              className="inline-block px-6 py-3 bg-purple-600 rounded-xl text-white hover:bg-purple-500 transition"
            >
              Ready to Begin
            </Link>
          </div>
        </div>
      </section>

      {/* Tired of Guessing? */}
      <section className="bg-[#111111] py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Tired of Guessing What Works?</h2>
            <p className="text-lg text-gray-400 mb-6">
              Max uses real data, not trends, to guide your improvement. Every feature is designed to close the loop between lifestyle and mental performance.
            </p>
            <Link
              href="/start-info"
              className="inline-block px-6 py-3 bg-purple-600 rounded-xl text-white hover:bg-purple-500 transition"
            >
              Ready to Begin
            </Link>
          </div>
          <div className="w-full flex justify-center">
            <Lottie animationData={guessingAnimation} loop={true} className="w-full max-w-md" />
          </div>
        </div>
      </section>

      {/* Data Driven */}
      <section className="bg-gradient-to-b from-gray-900 to-black py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="w-full flex justify-center order-2 md:order-1">
            <Lottie animationData={dataDrivenAnimation} loop={true} className="w-full max-w-md" />
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Data-Driven, Built for You</h2>
            <p className="text-lg text-gray-400">
              Whether you're an athlete, student, or just want to think more clearly, Max is the tool for transforming daily actions into cognitive gains.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Again */}
      <section className="bg-[#101010] py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Max is Built to Help You Improve</h2>
            <p className="text-lg text-gray-400 mb-6">
              Take control of your sleep, focus, and mental edge — starting today.
            </p>
            <Link
              href="/start-info"
              className="inline-block px-6 py-3 bg-purple-600 rounded-xl text-white hover:bg-purple-500 transition"
            >
              Ready to Begin
            </Link>
          </div>
          <div className="w-full flex justify-center">
            <Lottie animationData={athleteAnimation} loop={true} className="w-full max-w-md" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-gray-800 px-6 py-10 text-gray-400 text-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Brand */}
          <div className="text-white font-semibold text-lg">Max</div>

          {/* Nav Links */}
          <nav className="flex gap-6">
            <Link href="/about" className="hover:text-white transition">About</Link>
            <Link href="/games" className="hover:text-white transition">Games</Link>
            <Link href="/contact" className="hover:text-white transition">Contact</Link>
          </nav>

          {/* Copyright */}
          <div className="text-gray-500 text-xs text-center md:text-right">
            © {new Date().getFullYear()} Max. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  )
}
