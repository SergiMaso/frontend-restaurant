import * as React from "react";
import {
  AsYouType,
  parsePhoneNumberFromString,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const DEFAULT_COUNTRY: CountryCode = "ES";

const countryToFlag = (code: string) =>
  code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

export interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: string;
  onChange: (e164: string) => void;
  defaultCountry?: CountryCode;
  invalidMessage?: string;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      defaultCountry = DEFAULT_COUNTRY,
      invalidMessage,
      className,
      placeholder,
      ...rest
    },
    ref,
  ) => {
    const [display, setDisplay] = React.useState("");
    const lastEmitted = React.useRef<string>("");

    React.useEffect(() => {
      if (value === lastEmitted.current) return;
      if (!value) {
        setDisplay("");
        return;
      }
      const parsed = parsePhoneNumberFromString(value, defaultCountry);
      setDisplay(parsed ? parsed.formatInternational() : value);
      if (parsed && parsed.isValid() && parsed.number !== value) {
        lastEmitted.current = parsed.number;
        onChange(parsed.number);
      }
    }, [value, defaultCountry, onChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Show exactly what the user typed — no live reformatting (which was
      // stripping the leading '+' on partial prefixes like "+34").
      setDisplay(raw);

      const parsed = parsePhoneNumberFromString(raw, defaultCountry);
      const e164 = parsed && parsed.isValid() ? parsed.number : "";
      lastEmitted.current = e164;
      onChange(e164);
    };

    // Country detection during typing uses AsYouType.getCountry(), which
    // works on in-progress input (e.g. "+34" → ES) where parsePhoneNumberFromString
    // would still return undefined.
    const detectedCountry = React.useMemo<CountryCode | undefined>(() => {
      if (!display) return undefined;
      try {
        const fmt = new AsYouType(
          display.trim().startsWith("+") ? undefined : defaultCountry,
        );
        fmt.input(display);
        return fmt.getCountry();
      } catch {
        return undefined;
      }
    }, [display, defaultCountry]);

    const country = detectedCountry ?? defaultCountry;
    const callingCode = (() => {
      try {
        return `+${getCountryCallingCode(country)}`;
      } catch {
        return "";
      }
    })();
    const flag = countryToFlag(country);

    const parsedFull = display
      ? parsePhoneNumberFromString(display, defaultCountry)
      : undefined;
    const isInvalid =
      display.trim().length > 0 && !(parsedFull && parsedFull.isValid());

    return (
      <div className="space-y-1">
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-1 pl-3 text-base"
            aria-hidden
          >
            <span>{flag}</span>
            <span className="text-muted-foreground text-sm">{callingCode}</span>
          </div>
          <Input
            ref={ref}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={display}
            onChange={handleChange}
            placeholder={placeholder ?? "600 000 000"}
            className={cn("pl-20", isInvalid && "border-destructive", className)}
            {...rest}
          />
        </div>
        {isInvalid && (
          <p className="text-xs text-destructive">
            {invalidMessage ?? "Invalid phone number"}
          </p>
        )}
      </div>
    );
  },
);
PhoneInput.displayName = "PhoneInput";
