// hooks/useCognitiveProfile.ts

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/firebase/config';
import { UnifiedCognitiveProfile } from '@/types/cognitiveProfile';

export const useCognitiveProfile = () => {
  const [profile, setProfile] = useState<UnifiedCognitiveProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, `users/${user.uid}/cognitiveProfile/current`),
      (doc) => {
        if (doc.exists()) {
          setProfile(doc.data() as UnifiedCognitiveProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching cognitive profile:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const refreshProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const response = await fetch(
        `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/refreshCognitiveProfile?userId=${user.uid}`
      );
      const data = await response.json();
      console.log('Profile refreshed:', data);
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  };

  return { profile, loading, error, refreshProfile };
};