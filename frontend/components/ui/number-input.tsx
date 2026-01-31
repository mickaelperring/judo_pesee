"use client"

import * as React from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onChange?: (value: string) => void
  inputClassName?: string
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, inputClassName, value, onChange, min, max, step = 1, disabled, ...props }, ref) => {
    const handleDecrement = (e: React.MouseEvent) => {
      e.preventDefault()
      if (disabled) return
      
      const currentValue = Number(value) || 0
      const stepVal = Number(step)
      const newValue = currentValue - stepVal
      
      if (min !== undefined && newValue < Number(min)) return
      
      // Handle float precision
      const isFloat = stepVal % 1 !== 0 || currentValue % 1 !== 0
      const result = isFloat ? parseFloat(newValue.toFixed(2)).toString() : newValue.toString()
      
      onChange?.(result)
    }

    const handleIncrement = (e: React.MouseEvent) => {
      e.preventDefault()
      if (disabled) return

      const currentValue = Number(value) || 0
      const stepVal = Number(step)
      const newValue = currentValue + stepVal

      if (max !== undefined && newValue > Number(max)) return

      const isFloat = stepVal % 1 !== 0 || currentValue % 1 !== 0
      const result = isFloat ? parseFloat(newValue.toFixed(2)).toString() : newValue.toString()

      onChange?.(result)
    }

    return (
      <div className={cn("flex items-center", className)}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-r-none border-r-0 focus:z-10"
          onClick={handleDecrement}
          disabled={disabled}
          tabIndex={-1}
        >
          <Minus className="h-4 w-4" />
          <span className="sr-only">Diminuer</span>
        </Button>
        <Input
          type="number"
          className={cn(
            "rounded-none text-center h-9 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 z-0 focus:z-10 relative",
            "min-w-[50px] w-full",
            inputClassName
          )}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          ref={ref}
          {...props}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-l-none border-l-0 focus:z-10"
          onClick={handleIncrement}
          disabled={disabled}
          tabIndex={-1}
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">Augmenter</span>
        </Button>
      </div>
    )
  }
)
NumberInput.displayName = "NumberInput"

export { NumberInput }
