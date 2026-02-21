import * as React from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';
import { cn } from '@/lib/utils';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, placeholderTextColor, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        className={cn(
          'web:flex native:h-12 web:h-10 web:w-full rounded-md border border-input bg-background px-3 py-2',
          'text-base text-foreground placeholder:text-muted-foreground',
          'web:ring-offset-background web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
          'native:text-lg native:leading-[1.25]',
          props.editable === false && 'opacity-50 web:cursor-not-allowed',
          className
        )}
        placeholderTextColor={placeholderTextColor || '#9ca3af'}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export interface TextAreaProps extends TextInputProps {
  rows?: number;
}

const TextArea = React.forwardRef<TextInput, TextAreaProps>(
  ({ className, rows = 4, placeholderTextColor, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        multiline
        numberOfLines={rows}
        textAlignVertical="top"
        className={cn(
          'web:flex web:w-full rounded-md border border-input bg-background px-3 py-2',
          'text-base text-foreground placeholder:text-muted-foreground',
          'web:ring-offset-background web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
          'native:text-lg native:leading-[1.25]',
          'min-h-[100px]',
          props.editable === false && 'opacity-50 web:cursor-not-allowed',
          className
        )}
        placeholderTextColor={placeholderTextColor || '#9ca3af'}
        {...props}
      />
    );
  }
);

TextArea.displayName = 'TextArea';

export { Input, TextArea };
