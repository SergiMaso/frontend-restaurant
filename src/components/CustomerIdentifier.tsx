import { useState } from "react";
import { Phone, Copy, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CustomerIdentifierProps {
  phone: string;
  bsuid?: string | null;
  showIcon?: boolean;
  className?: string;
}

export function CustomerIdentifier({ phone, bsuid, showIcon = true, className = "" }: CustomerIdentifierProps) {
  const [copied, setCopied] = useState(false);

  const isPhone = phone.startsWith("+");
  const display = isPhone
    ? phone
    : phone.slice(0, 15) + (phone.length > 15 ? "…" : "");
  const full = isPhone ? phone : (bsuid ?? phone);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`flex items-center gap-1 cursor-default ${className}`}>
            {showIcon && <Phone className="h-3 w-3 shrink-0" />}
            <span>{display}</span>
            <button
              onClick={handleCopy}
              className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Copy"
              type="button"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono text-xs break-all max-w-xs">{full}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
