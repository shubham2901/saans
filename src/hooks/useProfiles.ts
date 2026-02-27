import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { UserProfile } from '../types';
import { getProfiles } from '../services/storageService';

export function useProfiles() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Re-fetch every time this screen comes into focus so that changes
  // saved in Settings are immediately reflected without a full remount.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getProfiles().then((p) => {
        if (active) {
          setProfiles(p);
          setLoading(false);
        }
      });
      return () => { active = false; };
    }, []),
  );

  return { profiles, loading };
}
