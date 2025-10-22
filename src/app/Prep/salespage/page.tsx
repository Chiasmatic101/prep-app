// File: src/app/Prep/SalesPage.tsx
"use client";

import { Brain, Moon, BarChart, Users, Activity, Zap } from "lucide-react";
import Link from "next/link";

export default function SalesPage() {
  return (
    <main className="bg-gradient-to-b from-purple-900 via-indigo-900 to-black text-white font-sans">
      {/* Hero Section */}
      <section className="py-24 px-6 text-center max-w-5xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          Unlock Your Peak Learning 🚀
        </h1>
        <p className="text-xl md:text-2xl text-purple-200 mb-8">
          60% of students study at the wrong times for their brain’s natural
          rhythm. Prep helps you flip that advantage in your favor.
        </p>
        <Link
          href="/signup"
          className="inline-block px-8 py-4 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-2xl shadow-lg transition"
        >
          Start Free Trial — 14 Days On Us
        </Link>
        <p className="mt-3 text-sm text-purple-300">
          $9.99/month after trial • Cancel anytime
        </p>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-10">
        <div className="bg-purple-800/30 rounded-2xl p-8 shadow-lg">
          <BarChart className="w-10 h-10 mb-4 text-green-400" />
          <h3 className="text-xl font-semibold mb-2">Boost Test Scores</h3>
          <p className="text-purple-200">
            Track focus, memory, and performance with validated cognitive games
            and insights.
          </p>
        </div>

        <div className="bg-purple-800/30 rounded-2xl p-8 shadow-lg">
          <Moon className="w-10 h-10 mb-4 text-green-400" />
          <h3 className="text-xl font-semibold mb-2">Improve Sleep</h3>
          <p className="text-purple-200">
            AI-guided experiments align your sleep and chronotype for sharper
            focus.
          </p>
        </div>

        <div className="bg-purple-800/30 rounded-2xl p-8 shadow-lg">
          <Brain className="w-10 h-10 mb-4 text-green-400" />
          <h3 className="text-xl font-semibold mb-2">Pre-Study Warmups</h3>
          <p className="text-purple-200">
            Quick brain warmups and guided breathing exercises to get you study
            ready.
          </p>
        </div>

        <div className="bg-purple-800/30 rounded-2xl p-8 shadow-lg">
          <Users className="w-10 h-10 mb-4 text-green-400" />
          <h3 className="text-xl font-semibold mb-2">Study-Along & Social</h3>
          <p className="text-purple-200">
            Study together, invite friends, and take part in challenges that
            make learning fun.
          </p>
        </div>

        <div className="bg-purple-800/30 rounded-2xl p-8 shadow-lg">
          <Activity className="w-10 h-10 mb-4 text-green-400" />
          <h3 className="text-xl font-semibold mb-2">Lifestyle Insights</h3>
          <p className="text-purple-200">
            See how diet, activity, and sleep directly impact the way you learn.
          </p>
        </div>

        <div className="bg-purple-800/30 rounded-2xl p-8 shadow-lg">
          <Zap className="w-10 h-10 mb-4 text-green-400" />
          <h3 className="text-xl font-semibold mb-2">AI-Guided Experiments</h3>
          <p className="text-purple-200">
            Personalized experiments designed to improve your sync score and
            cognitive edge.
          </p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-24 px-6 text-center max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          Smarter Study Starts Here
        </h2>
        <p className="text-lg text-purple-200 mb-8">
          Prep is like a personal coach for your brain — helping you study
          smarter, sleep better, and perform at your best.
        </p>
        <Link
          href="/signup"
          className="inline-block px-10 py-4 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-2xl shadow-lg transition"
        >
          Start Your 14-Day Free Trial
        </Link>
      </section>
    </main>
  );
}
