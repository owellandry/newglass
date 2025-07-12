import { forwardRef, useState } from 'react'
import { cn } from '../../lib/utils'
import type { InputProps } from '../../types'

const Input = forwardRef<HTMLInputElement, InputProps>((
  {
    className,
    type = 'text',
    placeholder,
    value,
    defaultValue,
    disabled = false,
    error,
    onChange,
    onEnter,
    ...props
  },
  ref
) => {
  const [internalValue, setInternalValue] = useState(defaultValue || '')
  const [isFocused, setIsFocused] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    if (value === undefined) {
      setInternalValue(newValue)
    }
    onChange?.(newValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault()
      onEnter()
    }
  }

  const currentValue = value !== undefined ? value : internalValue

  return (
    <div className="relative">
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-200",
          error && "border-destructive focus-visible:ring-destructive",
          isFocused && !error && "border-primary/50",
          className
        )}
        placeholder={placeholder}
        value={currentValue}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
      
      {error && (
        <div className="absolute -bottom-5 left-0 text-xs text-destructive flex items-center space-x-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input