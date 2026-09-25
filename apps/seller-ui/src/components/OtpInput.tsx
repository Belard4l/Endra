"use client";
import { useRef } from "react";

const OtpInput = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  return (
    <div className="flex justify-center gap-2">
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={digit}
          className="h-12 w-11 rounded-lg border border-stone-300 text-center text-xl outline-none focus:border-brand-600"
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(-1);
            const next = [...value];
            next[i] = v;
            onChange(next);
            if (v && i < value.length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, value.length).split("");
            if (digits.length) {
              e.preventDefault();
              onChange(value.map((_, idx) => digits[idx] || ""));
            }
          }}
        />
      ))}
    </div>
  );
};

export default OtpInput;
