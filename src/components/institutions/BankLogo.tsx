import { useState } from "react";
import { institutionColor } from "../../constants/institutions";

interface BankLogoProps {
  name: string;
  code?: string;
  logoUrl?: string;
  size?: number;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function BankLogo({ name, code, logoUrl, size = 36 }: BankLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (logoUrl && !imgFailed) {
    return (
      <img
        src={logoUrl}
        alt={name}
        onError={() => setImgFailed(true)}
        className="rounded-lg object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg font-bold text-white"
      style={{ width: size, height: size, backgroundColor: institutionColor(code), fontSize: size * 0.38 }}
      aria-hidden
    >
      {initialsOf(name)}
    </div>
  );
}
