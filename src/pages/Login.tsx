import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { getAuthErrorMessage } from "../utils/authErrors";
import AuthShell from "../components/AuthShell";
import PasswordField from "../components/PasswordField";
import { MailIcon } from "../components/icons";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      mode="login"
      title="Bem-vindo de volta"
      subtitle="Acesse sua conta para acompanhar suas finanças."
    >
      {error && <div className="auth-error">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-input">
          <span className="auth-input-icon">
            <MailIcon />
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            autoComplete="email"
            required
          />
        </div>

        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Senha"
          autoComplete="current-password"
        />

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="auth-switch">
        Ainda não tem uma conta? <Link to="/cadastro">Criar conta</Link>
      </p>
    </AuthShell>
  );
}
