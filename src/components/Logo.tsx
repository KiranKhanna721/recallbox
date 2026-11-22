import { BrainCircuit } from 'lucide-react'

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-10 w-10 rounded-xl' : 'h-8 w-8 rounded-lg'
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`${box} flex items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-[0_4px_16px_-4px_rgba(124,108,246,0.7)]`}
      >
        <BrainCircuit className={size === 'lg' ? 'h-5 w-5 text-white' : 'h-4 w-4 text-white'} aria-hidden />
      </span>
      <span className={`${size === 'lg' ? 'text-lg' : 'text-[15px]'} font-semibold tracking-tight text-foreground`}>
        Recall<span className="text-primary">Box</span>
      </span>
    </span>
  )
}
