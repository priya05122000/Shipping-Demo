import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

/** A multi-line TextInput. */
export function TextArea({ label, error, hint, required, className = "", rows = 3, ...props }: TextAreaProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={`block w-full resize-y rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:ring-4 focus:outline-none ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
            : "border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/10"
        }`}
        {...props}
      />
      {message && (
        <p id={messageId} className={`mt-1.5 text-xs ${error ? "text-red-600" : "text-slate-500"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
