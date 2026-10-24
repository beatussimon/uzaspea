import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';

export interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  containerClassName?: string;
  showPasswordToggle?: boolean;
  icon?: React.ReactNode;
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
      icon,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const internalRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => internalRef.current!);

    React.useEffect(() => {
      if (props.autoFocus) {
        setIsFocused(true);
        const timer = setTimeout(() => {
          if (internalRef.current) {
            internalRef.current.focus();
          }
        }, 50);
        return () => clearTimeout(timer);
      } else if (internalRef.current && document.activeElement === internalRef.current) {
        setIsFocused(true);
      }
    }, [props.autoFocus]);

    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    const isDate = type === 'date';
    const isFloating = isFocused || hasValue || isDate;
    const isPassword = type === 'password';
    const resolvedType = isPassword && showPassword ? 'text' : type;

    return (
      <div className={cn('relative w-full', containerClassName)}>
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 pointer-events-none transition-colors duration-150 z-10 flex items-center justify-center">
            {icon}
          </div>
        )}

        <input
          id={id}
          ref={internalRef}
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
            'peer w-full h-12 pt-3 pb-2 text-sm rounded-btn bg-transparent transition-colors duration-150',
            'border text-gray-900 dark:text-white outline-none focus:outline-none focus:ring-0',
            icon ? 'pl-[40px] pr-3.5' : 'px-3.5',
            showPasswordToggle && 'pr-11',
            isFocused
              ? 'border-gray-400 dark:border-neutral-600'
              : error
              ? 'border-red-500'
              : 'border-surface-border dark:border-neutral-800 hover:border-gray-400 dark:hover:border-neutral-700',
            className
          )}
          {...props}
        />

        <label
          htmlFor={id}
          className={cn(
            'absolute transition-all duration-200 pointer-events-none rounded-sm select-none',
            isFloating
              ? '-top-2.5 left-3 px-1.5 text-xs font-medium z-10 bg-white dark:bg-black ' +
                  (isFocused ? 'text-brand-500' : error ? 'text-red-500' : 'text-gray-500 dark:text-gray-400')
              : cn(
                  'top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-neutral-500 bg-transparent px-0',
                  icon ? 'left-[40px]' : 'left-3.5'
                )
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

export interface FloatingSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  containerClassName?: string;
  icon?: React.ReactNode;
}

export const FloatingSelect = React.forwardRef<HTMLSelectElement, FloatingSelectProps>(
  (
    {
      label,
      error,
      id,
      value,
      onChange,
      onFocus,
      onBlur,
      options,
      className,
      containerClassName,
      icon,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    const isFloating = isFocused || hasValue;

    return (
      <div className={cn('relative w-full', containerClassName)}>
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 pointer-events-none transition-colors duration-150 z-10 flex items-center justify-center">
            {icon}
          </div>
        )}

        <select
          id={id}
          ref={ref}
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
          className={cn(
            'peer w-full h-12 pt-3 pb-2 text-sm rounded-btn bg-transparent transition-colors duration-150',
            'border text-gray-900 dark:text-white outline-none focus:outline-none focus:ring-0 appearance-none cursor-pointer pr-10',
            icon ? 'pl-[40px]' : 'px-3.5',
            isFocused
              ? 'border-gray-400 dark:border-neutral-600'
              : error
              ? 'border-red-500'
              : 'border-surface-border dark:border-neutral-800 hover:border-gray-400 dark:hover:border-neutral-700',
            className
          )}
          {...props}
        >
          <option value="" disabled hidden className="bg-white dark:bg-black text-gray-400">
            {label}
          </option>
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-white dark:bg-black text-gray-900 dark:text-white py-1"
            >
              {opt.label}
            </option>
          ))}
        </select>

        <label
          htmlFor={id}
          className={cn(
            'absolute transition-all duration-200 pointer-events-none rounded-sm select-none',
            isFloating
              ? '-top-2.5 left-3 px-1.5 text-xs font-medium z-10 bg-white dark:bg-black ' +
                  (isFocused ? 'text-brand-500' : error ? 'text-red-500' : 'text-gray-500 dark:text-gray-400')
              : cn(
                  'top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-neutral-500 bg-transparent px-0',
                  icon ? 'left-[40px]' : 'left-3.5'
                )
          )}
        >
          {label}
        </label>

        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-neutral-500">
          <ChevronDown size={18} />
        </div>

        {error && (
          <p className="text-xs font-semibold text-red-500 mt-1 ml-0.5">{error}</p>
        )}
      </div>
    );
  }
);

FloatingSelect.displayName = 'FloatingSelect';

export default FloatingInput;
