import { useEffect, useRef } from 'react'

/** PIN de 4 dígitos: quatro casinhas, teclado numérico; chama onComplete ao digitar o 4º número */
export function PinInput({ value, onChange, onComplete, disabled, autoFocus = true, id = 'pin', label }: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  disabled?: boolean
  autoFocus?: boolean
  id?: string
  label?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  return (
    <label className="pin-input" htmlFor={id} onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        aria-label={label ?? 'PIN de 4 dígitos'}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
          onChange(v)
          if (v.length === 4) onComplete?.(v)
        }}
      />
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`pin-box${value.length === i ? ' current' : ''}${value.length > i ? ' filled' : ''}`} aria-hidden="true" />
      ))}
    </label>
  )
}
