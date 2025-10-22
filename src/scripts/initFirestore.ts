import { db } from '@/firebase/config'
import { collection, doc, setDoc } from 'firebase/firestore'

async function initializeFirestore() {
  try {
    console.log('Initializing Firestore collections...')

    // Existing collections
    await setDoc(doc(db, 'invites', '_init'), {
      _placeholder: true,
      createdAt: new Date(),
      description: 'Placeholder to initialize collection'
    })
    console.log('✓ invites collection created')

    await setDoc(doc(db, 'friendships', '_init'), {
      _placeholder: true,
      createdAt: new Date(),
      description: 'Placeholder to initialize collection'
    })
    console.log('✓ friendships collection created')

    // NEW: User presence collection
    await setDoc(doc(db, 'userPresence', '_init'), {
      _placeholder: true,
      createdAt: new Date(),
      description: 'Placeholder to initialize collection'
    })
    console.log('✓ userPresence collection created')

    console.log('\n✅ All collections initialized!')
    
  } catch (error) {
    console.error('Error initializing Firestore:', error)
  }
}

export default initializeFirestore