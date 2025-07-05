'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'

interface FeatureCardProps {
  icon: string
  title: string
  description: string
  alt: string
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, alt }) => (
  <div className="bg-gray-900 rounded-xl p-8 shadow hover:shadow-lg transition">
    <div className="mb-4">
      <Image src={icon} alt={alt} width={48} height={48} className="mx-auto" />
    </div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-gray-400">{description}</p>
  </div>
)

interface LogoProps {
  src: string
  alt: string
}

const Logo: React.FC<LogoProps> = ({ src, alt }) => (
  <Image 
    src={src} 
    alt={alt} 
    width={120} 
    height={32} 
    className="h-8 w-auto grayscale hover:grayscale-0 transition" 
  />
)

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white font-sans">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500 rounded-full blur-[120px] opacity-30 pointer-events-none z-[-1]" />

        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
          Think Smarter. Sleep Deeper. Perform Better.
        </h1>
        <p className="text-lg md:text-xl max-w-2xl mb-8 text-gray-300">
          Revolutionizing human potential through AI-driven sleep optimization
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/signup" className="px-6 py-3 bg-blue-600 rounded-xl text-white hover:bg-blue-500 transition">
            Get Started
          </Link>
          <Link href="/games" className="px-6 py-3 border border-white rounded-xl text-white hover:bg-white hover:text-black transition">
            Try a Demo
          </Link>
        </div>
      </section>

      {/* Trusted by Section */}
      <section className="bg-gray-950 py-12 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-400 uppercase text-sm tracking-widest mb-6">
            Trusted by teams around the world
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-80">
            <Logo src="/logos/crayon.svg" alt="Crayon" />
            <Logo src="/logos/jaguar.svg" alt="Jaguar" />
            <Logo src="/logos/lazyvim.svg" alt="LazyVim" />
            <Logo src="/logos/raylib.svg" alt="Raylib" />
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section className="bg-black py-20 px-6 border-t border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">What We Do</h2>
          <p className="text-lg text-gray-400 leading-relaxed">
            At Chiasmatic, we combine AI, cognitive testing, and sleep science to uncover how daily habits shape the mind and body. Through structured, personalized experiments, we help individuals test and refine changes to their sleep, activity, and routines—revealing what truly enhances cognitive performance and recovery. It's precision health, powered by your own data.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-black py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">
            Train Smarter, Perform Better
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon="/icons/brain.svg"
              alt="Cognition"
              title="Cognitive Precision"
              description="Test your focus, memory, and reaction time with tools designed for elite performance."
            />
            <FeatureCard
              icon="/icons/data.svg"
              alt="Insights"
              title="Real-Time Insights"
              description="Track your brain performance over time and understand your mental trends."
            />
            <FeatureCard
              icon="/icons/secure.svg"
              alt="Privacy"
              title="Secure & Private"
              description="Your data is protected and used only to help you improve. Nothing else."
            />
          </div>
        </div>
      </section>

      {/* Our Products Section with Glow and Motion */}
      <section className="relative bg-black py-24 px-6 text-center overflow-hidden">
        {/* Glow Background */}
        <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 blur-[150px] opacity-20 z-[-1]" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white">Our Products</h2>
        </motion.div>
      </section>

      {/* Meet SleepMax Section */}
      <section className="relative bg-black py-28 px-6 text-center overflow-hidden">
        {/* Glowing Background */}
        <div className="absolute -z-10 top-1/2 left-1/2 w-[700px] h-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600 opacity-25 blur-[160px]" />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-4xl md:text-6xl font-extrabold leading-tight text-white mb-6">
            Meet <span className="text-purple-400">SleepMax</span><br />
            Your Personal Cognitive Optimizer
          </h2>
          <p className="text-lg md:text-xl text-gray-300 mb-8">
            Track. Learn. Transform. SleepMax helps you improve sleep, mental clarity, and resilience through AI and behavioral science.
          </p>
          <Link
            href="/max"
            className="inline-block px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-lg transition"
          >
            Visit
          </Link>
        </motion.div>
      </section>

      {/* Prep Feature Section */}
      <section className="bg-black py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Image Column */}
          <div className="w-full flex justify-center order-2 md:order-1">
            <Image
              src="/screens/study2.png"
              alt="Prep Feature Screenshot"
              width={400}
              height={600}
              className="w-full max-w-md rounded-xl shadow-lg"
            />
          </div>

          {/* Text Column */}
          <div className="order-1 md:order-2">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Get Mentally Ready with Prep</h2>
            <p className="text-gray-400 mb-6">
              Prep is a cognitive training and lifestyle tracking app designed to help students reach their full academic potential. Using fun, science-based games, Prep identifies each students peak learning times and shows how sleep, stress, and daily habits impact focus and memory. It's an engaging, data-driven tool to support smarter studying and healthier routines—for learners aged 13 and up.
            </p>
            <Link
              href="/Prep"
              className="inline-block mt-2 px-6 py-3 bg-blue-600 rounded-xl text-white hover:bg-blue-500 transition"
            >
              Try Prep
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-gray-800 px-6 py-10 text-gray-400 text-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Brand */}
          <div className="text-white font-semibold text-lg">Chiasmatic</div>

          {/* Nav Links */}
          <nav className="flex gap-6">
            <Link href="/about" className="hover:text-white transition">About</Link>
            <Link href="/games" className="hover:text-white transition">Games</Link>
            <Link href="/contact" className="hover:text-white transition">Contact</Link>
          </nav>

          {/* Copyright */}
          <div className="text-gray-500 text-xs text-center md:text-right">
            © {new Date().getFullYear()} Chiasmatic. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  )
}