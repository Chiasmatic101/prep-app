'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { auth, db } from '@/firebase/config'
import { doc, getDoc } from 'firebase/firestore'
import { 
  Mail, 
  Share2, 
  Copy, 
  Check, 
  Users, 
  Send, 
  MessageCircle,
  Facebook,
  Twitter,
  Instagram,
  Plus,
  X
} from 'lucide-react'

export default function FriendsPage() {
  const [emailAddresses, setEmailAddresses] = useState([''])
  const [message, setMessage] = useState('Hey! I found this amazing learning platform that helps optimize study time based on your chronotype. Want to check it out together?')
  const [copied, setCopied] = useState(false)
  const [invitesSent, setInvitesSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteLink, setInviteLink] = useState('')

  useEffect(() => {
    const generateInviteLink = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
        const userData = userDoc.data()
        const inviteCode = userData?.inviteCode || auth.currentUser.uid.substring(0, 8)
        setInviteLink(`${window.location.origin}/join?ref=${inviteCode}`)
      }
    }
    generateInviteLink()
  }, [])
  
 const handleAddEmail = () => {
  setEmailAddresses([...emailAddresses, ''])
}
  
  const handleRemoveEmail = (index: number) => {
  if (emailAddresses.length > 1) {
    setEmailAddresses(emailAddresses.filter((_, i) => i !== index))
  }
}

  const handleEmailChange = (index: number, value: string) => {
  const newEmails = [...emailAddresses]
  newEmails[index] = value
  setEmailAddresses(newEmails)
}

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

const handleSendInvites = async () => {
  setLoading(true)
  try {
    const user = auth.currentUser
    if (!user) {
      setError('You must be logged in to send invites')
      return
    }

    const validEmails = emailAddresses.filter(email => email.trim())
    
    const response = await fetch('/api/invites/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emails: validEmails,
        message,
        userId: user.uid
      })
    })

    if (response.ok) {
      setInvitesSent(true)
      setTimeout(() => {
        setInvitesSent(false)
        setEmailAddresses([''])
      }, 3000)
    }
  } catch (error) {
    console.error('Error sending invites:', error)
  } finally {
    setLoading(false)
  }
}


  const socialPlatforms = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'bg-green-500 hover:bg-green-400',
      url: `https://wa.me/?text=${encodeURIComponent(message + ' ' + inviteLink)}`
    },
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-600 hover:bg-blue-500',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}`
    },
    {
      name: 'Twitter',
      icon: Twitter,
      color: 'bg-sky-500 hover:bg-sky-400',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(inviteLink)}`
    },
    {
      name: 'Instagram',
      icon: Instagram,
      color: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400',
      url: '#',
      note: 'Copy link to share in stories'
    }
  ]

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 font-sans px-4 py-8">
      <div className="max-w-2xl mx-auto">
        
        {/* Success Message */}
        {invitesSent && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            Invites sent successfully!
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Invite Your Friends
          </h1>
          <p className="text-gray-600">
            Share your learning journey and discover your optimal study times together
          </p>
        </motion.div>

        {/* Email Invitation Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-800">Send Email Invites</h2>
          </div>

          <div className="space-y-4">
            {/* Email Addresses */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Addresses
              </label>
              <div className="space-y-2">
                {emailAddresses.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => handleEmailChange(index, e.target.value)}
                      placeholder="friend@example.com"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    {emailAddresses.length > 1 && (
                      <button
                        onClick={() => handleRemoveEmail(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddEmail}
                className="mt-2 flex items-center gap-1 text-purple-600 hover:text-purple-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add another email
              </button>
            </div>

            {/* Custom Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personal Message (Optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Add a personal note..."
              />
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendInvites}
              disabled={loading || !emailAddresses.some(email => email.trim())}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-400 disabled:to-gray-400 text-white py-3 rounded-lg font-semibold transition-all hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Invites
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Share Link Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Share Your Link</h2>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={inviteLink}
              readOnly
              className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600"
            />
            <button
              onClick={handleCopyLink}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                copied 
                  ? 'bg-green-500 text-white' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-105'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Social Media Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {socialPlatforms.map((platform) => (
              <a
                key={platform.name}
                href={platform.url}
                target={platform.url !== '#' ? '_blank' : undefined}
                rel="noopener noreferrer"
                onClick={platform.url === '#' ? handleCopyLink : undefined}
                className={`${platform.color} text-white p-3 rounded-lg font-medium transition-all hover:scale-105 flex items-center justify-center gap-2 text-sm`}
              >
                <platform.icon className="w-4 h-4" />
                {platform.name}
              </a>
            ))}
          </div>

          <p className="text-xs text-gray-500 mt-3 text-center">
            Share on social media to reach more friends
          </p>
        </motion.div>

        {/* Benefits Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-green-100 to-blue-100 rounded-2xl p-6 border border-green-200"
        >
          <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
            🎯 Why invite friends?
          </h3>
          <ul className="space-y-2 text-sm text-green-700">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>Compare chronotypes and find study buddies with similar schedules</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>Challenge each other in brain training games</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>Share lifestyle tips and learning strategies</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>Unlock group challenges and collaborative features</span>
            </li>
          </ul>
        </motion.div>

        {/* Back to Dashboard */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8"
        >
          <button
            onClick={() => window.history.back()}
            className="text-purple-600 hover:text-purple-700 font-medium text-sm transition-colors"
          >
            ← Back to Dashboard
          </button>
        </motion.div>

      </div>
    </main>
  )
}
