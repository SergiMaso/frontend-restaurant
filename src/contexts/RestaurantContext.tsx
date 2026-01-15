import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

export interface Restaurant {
  id: number;
  name: string;
  slug: string;
  phone?: string;
  is_active: boolean;
  created_at?: string;
}

interface RestaurantContextType {
  restaurants: Restaurant[];
  selectedRestaurant: Restaurant | null;
  setSelectedRestaurant: (restaurant: Restaurant) => void;
  loading: boolean;
  refreshRestaurants: () => Promise<void>;
  canSwitchRestaurant: boolean;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurantState] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isSuperadmin } = useAuth();

  const fetchRestaurants = useCallback(async () => {
    if (!user) {
      setRestaurants([]);
      setSelectedRestaurantState(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/restaurants`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error fetching restaurants');
      }

      const data = await response.json();
      setRestaurants(data);

      // Auto-select restaurant
      if (data.length > 0) {
        // Check if we have a saved selection in localStorage
        const savedId = localStorage.getItem('selectedRestaurantId');
        const savedRestaurant = savedId ? data.find((r: Restaurant) => r.id === parseInt(savedId)) : null;

        if (savedRestaurant) {
          setSelectedRestaurantState(savedRestaurant);
        } else {
          // Default to first restaurant
          setSelectedRestaurantState(data[0]);
          localStorage.setItem('selectedRestaurantId', data[0].id.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  const setSelectedRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurantState(restaurant);
    localStorage.setItem('selectedRestaurantId', restaurant.id.toString());
    // Trigger a page reload to refetch all data for the new restaurant
    window.location.reload();
  };

  const refreshRestaurants = async () => {
    await fetchRestaurants();
  };

  // Only superadmin can switch between restaurants (for now)
  // Later we can add multi-restaurant owners
  const canSwitchRestaurant = isSuperadmin && restaurants.length > 1;

  const value: RestaurantContextType = {
    restaurants,
    selectedRestaurant,
    setSelectedRestaurant,
    loading,
    refreshRestaurants,
    canSwitchRestaurant,
  };

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const context = useContext(RestaurantContext);
  if (context === undefined) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
}

// Helper to get restaurant ID for API calls
export function getRestaurantId(): number | null {
  const savedId = localStorage.getItem('selectedRestaurantId');
  return savedId ? parseInt(savedId) : null;
}
