import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-dark-border dark:bg-[#111] dark:text-white',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface FormFieldProps extends InputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, helperText, containerClassName, className, id, ...props }, ref) => {
    const errorId = error ? `${id}-error` : undefined;
    const helperId = helperText ? `${id}-helper` : undefined;

    return (
      <div className={cn('flex flex-col gap-1.5 w-full', containerClassName)}>
        {label && (
          <label htmlFor={id} className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">
            {label}
          </label>
        )}
        <Input
          id={id}
          ref={ref}
          className={cn(
            error && 'border-red-500 focus-visible:ring-red-500/20 focus-visible:border-red-500 dark:border-red-500',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={errorId || helperId}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs font-semibold text-red-500 ml-0.5">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-gray-500 ml-0.5">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = 'FormField';

export { Input, FormField };
