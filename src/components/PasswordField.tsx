import { useState } from "react";
import { LockIcon, EyeIcon, EyeOffIcon } from "./icons";

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}

export default function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-input">
      <span className="auth-input-icon">
        <LockIcon />
      </span>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
      <button
        type="button"
        className="auth-input-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
