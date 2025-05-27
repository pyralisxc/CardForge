
"use client";

import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(initialValue); // Always initialize with initialValue

  // Effect to load from localStorage ONCE after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          setStoredValue(JSON.parse(item));
        }
        // If no item, it remains initialValue, which is correct for this phase
      } catch (error) {
        console.error(`Error reading localStorage key "${key}":`, error);
        // Remains initialValue if error
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Key is included so if it ever changes, it re-reads. initialValue is not needed as it's for first init.

  // Effect to update localStorage when storedValue changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // We only want to save to localStorage if the storedValue is not the initial seed value,
      // or if it has been explicitly set by the user/application logic after initial load.
      // A simple check here is sufficient because the first effect handles the "load" phase.
      // Any subsequent change to storedValue (via the returned setter) should be persisted.
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
