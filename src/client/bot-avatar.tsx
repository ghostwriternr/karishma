export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function BotAvatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={`bot-avatar${large ? " large" : ""}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
