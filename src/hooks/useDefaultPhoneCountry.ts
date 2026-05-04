import { useMemo } from "react";
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { useRestaurant } from "@/contexts/RestaurantContext";

const FALLBACK: CountryCode = "ES";

export function useDefaultPhoneCountry(): CountryCode {
  const { selectedRestaurant } = useRestaurant();
  return useMemo(() => {
    const raw = selectedRestaurant?.phone;
    if (!raw) return FALLBACK;
    const parsed = parsePhoneNumberFromString(raw);
    return parsed?.country ?? FALLBACK;
  }, [selectedRestaurant?.phone]);
}
