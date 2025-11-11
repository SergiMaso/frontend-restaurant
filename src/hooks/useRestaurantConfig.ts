import { useQuery } from "@tanstack/react-query";
import { getClientConfigs } from "@/services/api";

/**
 * Hook personalitzat per accedir a les configuracions del restaurant
 */
export const useRestaurantConfig = () => {
  const { data: configs, isLoading, error } = useQuery({
    queryKey: ["client-configs"],
    queryFn: getClientConfigs,
    staleTime: 5 * 60 * 1000, // 5 minuts
    refetchOnWindowFocus: false,
  });

  // DEBUG: Mostrar configuració carregada
  console.log("🔍 [useRestaurantConfig] Configuració carregada:", {
    configs,
    isLoading,
    error,
    totalConfigs: configs?.length || 0
  });

  // Helper per obtenir un valor de configuració
  const getConfigValue = (key: string, defaultValue: string = ""): string => {
    const config = configs?.find((c) => c.key === key);
    const value = config?.value || defaultValue;
    console.log(`🔍 [getConfigValue] key="${key}", value="${value}", default="${defaultValue}"`);
    return value;
  };

  // Helper per obtenir un valor numèric
  const getConfigNumber = (key: string, defaultValue: number = 0): number => {
    const value = getConfigValue(key, defaultValue.toString());
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  // Helper per obtenir un valor booleà
  const getConfigBoolean = (key: string, defaultValue: boolean = false): boolean => {
    const value = getConfigValue(key, defaultValue.toString());
    return value === "true" || value === "1";
  };

  const restaurantName = getConfigValue("restaurant_name", "Restaurant");
  const maxPeoplePerBooking = getConfigNumber("max_people_per_booking", 8);
  const defaultBookingDuration = getConfigNumber("default_booking_duration_hours", 2);

  // DEBUG: Mostrar valors finals
  console.log("🎯 [useRestaurantConfig] Valors finals:", {
    restaurantName,
    maxPeoplePerBooking,
    defaultBookingDuration
  });

  return {
    configs,
    isLoading,
    error,
    getConfigValue,
    getConfigNumber,
    getConfigBoolean,
    // Configuracions específiques
    restaurantName,
    maxPeoplePerBooking,
    defaultBookingDuration,
  };
};
