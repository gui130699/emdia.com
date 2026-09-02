interface AvatarProps {
  name: string;
  size?: number;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, size = 36 }: AvatarProps) {
  return (
    <div
      className="flex items-center justify-center rounded-full bg-brand-600 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initialsOf(name)}
    </div>
  );
}
