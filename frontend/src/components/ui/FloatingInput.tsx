import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Eye, EyeOff } from 'lucide-react';

export interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  containerClassName?: string;
  showPasswordToggle?: boolean;
}

export const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  (
    {
      label,
      error,
      id,
      type = 'text',
      value,
      onChange,
      onFocus,
      onBlur,
      className,
      containerClassName,
      showPasswordToggle = false,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    const isFloating = isFocused || hasValue;
    const isPassword = type === 'password';
    const resolvedType = isPassword && showPassword ? 'text' : type;

    return (
      <div className={cn('relative w-full', containerClassName)}>
        <input
          id={id}
          ref={ref}
          type={resolvedType}
          value={value}
          onChange={onChange}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          placeholder=" "
          className={cn(
            'peer w-full h-12 px-3.5 pt-3 pb-2 text-sm rounded-btn bg-transparent transition-colors duration-150',
            'border text-gray-900 dark:text-white outline-none focus:outline-none focus:ring-0',
            isFocused
              ? 'border-gray-400 dark:border-neutral-500'
              : error
              ? 'border-red-500'
              : 'border-surface-border dark:border-neutral-700 hover:border-gray-400 dark:hover:border-neutral-600',
            showPasswordToggle && 'pr-11',
            className
          )}
          {...props}
        />

        <label
          htmlFor={id}
          className={cn(
            'absolute left-3 px-1.5 transition-all duration-200 pointer-events-none rounded-sm select-none',
            'bg-white dark:bg-[#141414]', // Notch mask matching the card background
            isFloating
              ? '-top-2.5 text-xs font-medium z-10 ' +
                  (isFocused ? 'text-brand-500' : error ? 'text-red-500' : 'text-gray-500 dark:text-gray-400')
              : 'top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-neutral-500'
          )}
        >
          {label}
        </label>

        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-200 transition z-10"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}

        {error && (
          <p className="text-xs font-semibold text-red-500 mt-1 ml-0.5">{error}</p>
        )}
      </div>
    );
  }
);

FloatingInput.displayName = 'FloatingInput';

export default FloatingInput;
