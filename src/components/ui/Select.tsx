import { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'
import type { SelectProps } from '../../types'

const Select = ({
  className,
  options,
  value,
  defaultValue,
  placeholder = 'Select an option...',
  disabled = false,
  error,
  onChange,
  ...props
}: SelectProps) => {
  const [internalValue, setInternalValue] = useState(defaultValue || '')
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const currentValue = value !== undefined ? value : internalValue
  const selectedOption = options.find(option => option.value === currentValue)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setIsFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setIsOpen(false)
          setIsFocused(false)
          break
        case 'ArrowDown':
        case 'ArrowUp':
          e.preventDefault()
          // TODO: Implement keyboard navigation
          break
        case 'Enter':
          e.preventDefault()
          // TODO: Select focused option
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSelect = (optionValue: string) => {
    if (value === undefined) {
      setInternalValue(optionValue)
    }
    onChange?.(optionValue)
    setIsOpen(false)
    setIsFocused(false)
  }

  const handleToggle = () => {
    if (disabled) return
    setIsOpen(!isOpen)
    setIsFocused(!isOpen)
  }

  return (
    <div className="relative" ref={selectRef} {...props}>
      {/* Select trigger */}
      <button
        type="button"
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input",
          "bg-background px-3 py-2 text-sm ring-offset-background",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-200",
          error && "border-destructive focus:ring-destructive",
          isFocused && !error && "border-primary/50 ring-2 ring-ring ring-offset-2",
          isOpen && "ring-2 ring-ring ring-offset-2",
          className
        )}
        onClick={handleToggle}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={cn(
          "block truncate",
          !selectedOption && "text-muted-foreground"
        )}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        
        <svg
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className={cn(
            "absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          <div className="max-h-60 overflow-auto p-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No options available
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm",
                    "outline-none transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground",
                    "disabled:pointer-events-none disabled:opacity-50",
                    currentValue === option.value && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleSelect(option.value)}
                  disabled={option.disabled}
                >
                  <span className="block truncate">{option.label}</span>
                  
                  {currentValue === option.value && (
                    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      
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
}

export default Select