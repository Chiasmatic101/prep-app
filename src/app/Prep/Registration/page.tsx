'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { auth, db } from '@/firebase/config'
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', age: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const signInMethods = await fetchSignInMethodsForEmail(auth, form.email)
      if (signInMethods.length > 0) {
        setError('An account with this email already exists. Please log in instead.')
        return
      }

      const userCred = await createUserWithEmailAndPassword(auth, form.email, form.password)

      await setDoc(doc(db, 'users', userCred.user.uid), {
        name: form.name,
        email: form.email,
        age: parseInt(form.age),
        createdAt: new Date(),
      })

      // Redirect after registration
      router.push('/Prep/Registration/chronotype-survey')

    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-xl shadow-md">
      <h2 className="text-2xl font-bold mb-4">Register for Prep</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="name" value={form.name} onChange={handleChange} placeholder="Name" required className="w-full p-2 border rounded" />
        <input name="email" value={form.email} onChange={handleChange} type="email" placeholder="Email" required className="w-full p-2 border rounded" />
        <input name="age" value={form.age} onChange={handleChange} type="number" placeholder="Age" required className="w-full p-2 border rounded" />
        <input name="password" value={form.password} onChange={handleChange} type="password" placeholder="Password" required className="w-full p-2 border rounded" />
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-500 transition">Register</button>
      </form>
      {error && <p className="text-red-600 mt-3">{error}</p>}
      {success && <p className="text-green-600 mt-3">{success}</p>}
    </div>
  )
}