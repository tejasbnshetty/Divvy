const PALETTE = ['bg-coral', 'bg-mint', 'bg-butter', 'bg-lavender']

function colorFor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function MemberAvatar({ name, id, size = 36 }: { name: string; id: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorFor(id)}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      title={name}
    >
      {initial}
    </div>
  )
}
