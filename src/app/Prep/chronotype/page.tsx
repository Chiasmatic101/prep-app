'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

export default function ChronotypeQuizPage() {
  const [formData, setFormData] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Quiz submitted:', formData)
    setSubmitted(true)
  }

  const Question = ({ label, name, options }) => (
    <div className="mb-6">
      <fieldset className="space-y-2">
        <legend className="block text-lg font-medium mb-2 text-gray-800">{label}</legend>
        {options.map((opt, i) => (
          <label key={i} className="block bg-white rounded-lg p-3 border hover:border-purple-400 transition cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt}
              onChange={handleChange}
              className="mr-2"
            />
            {opt}
          </label>
        ))}
      </fieldset>
    </div>
  )

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center bg-white p-10 rounded-2xl shadow-xl max-w-xl"
        >
          <h2 className="text-3xl font-bold text-purple-700 mb-4">Thanks for submitting!</h2>
          <p className="text-gray-700">We’ll use this info to help you discover your best study rhythm. Stay tuned! 🌟</p>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen font-sans bg-gradient-to-br from-yellow-50 to-pink-100 text-gray-900 px-6 py-16">
      <div className="max-w-3xl mx-auto bg-white p-10 rounded-3xl shadow-xl">
        <motion.h1
          className="text-4xl font-bold text-center text-purple-700 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          🧠 What’s Your Brain’s Rhythm?
        </motion.h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Question
            label="What time do you wake up on school days?"
            name="wakeSchool"
            options={['Before 6 AM', '6–6:59 AM', '7–7:59 AM', '8 AM or later']}
          />
          <Question
            label="What time does school start?"
            name="schoolStart"
            options={['Before 7:30 AM', '7:30–8:00 AM', 'After 8:00 AM']}
          />
          <Question
            label="What time do you get home from school?"
            name="homeTime"
            options={['Before 3:30 PM', '3:30–4:30 PM', 'After 4:30 PM']}
          />
          <Question
            label="When do you usually do your homework/study?"
            name="homeworkTime"
            options={['Right after school', 'After dinner', 'Late at night', 'Depends on the day']}
          />
          <Question
            label="What time do your extracurricular classes begin and finish?"
            name="extraTime"
            options={['Before 4 PM', '4–6 PM', 'After 6 PM', 'Varies']}
          />
          <Question
            label="Do you take any extra academic programs?"
            name="extras"
            options={['AoPS', 'RSM', 'Kumon', 'Other', 'None']}
          />
          <Question
            label="If you didn’t have school, what time would you naturally wake up?"
            name="naturalWake"
            options={['Before 8 AM', '8–10 AM', 'After 10 AM']}
          />
          <Question
            label="When do you feel most focused and ready to learn?"
            name="focusTime"
            options={['Morning', 'Afternoon', 'Evening']}
          />
          <Question
            label="How do you feel in the first hour after waking up?"
            name="wakeFeel"
            options={['Wide awake', 'A bit slow', 'Super groggy']}
          />
          <Question
            label="If you had to take a big test, when would you do your best?"
            name="testTime"
            options={['Morning', 'Midday', 'Evening']}
          />
          <Question
            label="What time do you fall asleep on weekends/holidays?"
            name="bedWeekend"
            options={['Before 10 PM', '10 PM–Midnight', 'After Midnight']}
          />
          <div className="text-center pt-6">
            <button
              type="submit"
              className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-full text-lg font-medium shadow-lg transition duration-300"
            >
              Submit My Answers
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
