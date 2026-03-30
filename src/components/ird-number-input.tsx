"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { validateIrdNumber, type IrdValidationResult } from "@/lib/tax/ird-validator";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type IrdNumberInputProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  required?: boolean;
};

export function IrdNumberInput({
  value,
  onChange,
  id = "ird_number",
  placeholder = "e.g. 123-456-789",
  required,
}: IrdNumberInputProps) {
  const [result, setResult] = useState<IrdValidationResult | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      onChange(raw);

      // Only validate if there's meaningful input
      const digits = raw.replace(/\D/g, "");
      if (digits.length === 0) {
        setResult(null);
      } else {
        setResult(validateIrdNumber(raw));
      }
    },
    [onChange]
  );

  const hasInput = value.replace(/\D/g, "").length > 0;

  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          className={cn(
            hasInput && result?.valid && "border-green-500 focus-visible:ring-green-500/20",
            hasInput && result && !result.valid && "border-destructive focus-visible:ring-destructive/20"
          )}
        />
        {hasInput && result?.valid && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
        )}
      </div>
      {hasInput && result?.valid && result.formatted && (
        <p className="mt-1 text-xs text-green-600">{result.formatted}</p>
      )}
      {hasInput && result && !result.valid && result.error && (
        <p className="mt-1 text-xs text-destructive">{result.error}</p>
      )}
    </div>
  );
}
