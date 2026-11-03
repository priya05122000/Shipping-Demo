import { useId, type InputHTMLAttributes, type ReactNode } from "react";

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  /** Renders a lock icon and muted styling; implies readOnly. */
  locked?: boolean;
  icon?: ReactNode;
}

export function TextInput({ label, error, hint, required, locked, icon, className = "", ...props }: TextInputProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          required={required}
          readOnly={locked || props.readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={`block h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-1 ${
            icon ? "pr-9" : ""
          } ${
            error
              ? "border-red-400 focus:outline-red-500"
              : "border-slate-300 focus:outline-indigo-600"
          } ${locked ? "cursor-not-allowed bg-slate-50 font-mono text-slate-600" : ""}`}
          {...props}
        />
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">{icon}</span>
        )}
      </div>
      {message && (
        <p id={messageId} className={`mt-1.5 text-xs ${error ? "text-red-600" : "text-slate-500"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
