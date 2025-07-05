'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UserInfoForm() {
  const [age, setAge] = useState<string>('')
  const [gender, setGender] = useState<string>('')
  const router = useRouter()

  const handleSubmit = () => {
    // You can add validation here if needed
    if (age && gender) {
      router.push('/games/MemoryTest')
    }
  }

  return (
    <main className="min-h-screen bg-black text-white font-sans flex items-center justify-center px-6 py-20">
      <div className="max-w-md w-full space-y-6">
        <h1 className="text-3xl font-bold text-center mb-6">Tell us about yourself</h1>

        <div>
          <label htmlFor="age" className="block text-sm mb-2">Age</label>
          <input
            id="age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="gender" className="block text-sm mb-2">Gender at Birth</label>
          <select
            id="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>

        <button
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
          onClick={handleSubmit}
          disabled={!age || !gender}
        >
          Continue
        </button>
      </div>
    </main>
  )
}