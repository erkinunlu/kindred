import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FILTER_KEY = '@kindred_distance_km';

interface FilterContextType {
  distanceKm: number;
  setDistanceKm: (km: number) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [distanceKm, setDistanceKmState] = useState(30);

  useEffect(() => {
    AsyncStorage.getItem(FILTER_KEY).then((v) => {
      if (v) setDistanceKmState(parseInt(v, 10) || 30);
    });
  }, []);

  const setDistanceKm = (km: number) => {
    setDistanceKmState(km);
    AsyncStorage.setItem(FILTER_KEY, String(km));
  };

  return (
    <FilterContext.Provider value={{ distanceKm, setDistanceKm }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}
