import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getAuthErrorMessage } from "../utils/authErrors";
import AuthShell from "../components/AuthShell";
import PasswordField from "../components/PasswordField";
import { UserIcon, MailIcon } from "../components/icons";

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function SignUp() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!PASSWORD_RULE.test(password)) {
      setError("A senha deve ter no mínimo 8 caracteres, com letra e número.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(credential.user, { displayName: fullName });

      // Best-effort profile sync: the account is already usable via Firebase
      // Auth at this point, so a Firestore hiccup (rules not configured yet,
      // offline, etc.) must never block the user from getting into the app.
      setDoc(doc(db, "users", credential.user.uid), {
        fullName,
        email,
        createdAt: serverTimestamp(),
      }).catch(() => {
        /* profile doc will be created/synced later from Configurações */
      });

      navigate("/");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      mode="signup"
      title="Crie sua conta"
      subtitle="Comece hoje a organizar sua vida financeira."
    >
      {error && <div className="auth-error">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-input">
          <span className="auth-input-icon">
            <UserIcon />
          </span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome completo"
            autoComplete="name"
            required
          />
        </div>

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
          autoComplete="new-password"
        />
        <p className="auth-field-hint">Mínimo de 8 caracteres, com letra e número</p>

        <PasswordField
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirmar senha"
          autoComplete="new-password"
        />

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Criando conta..." : "Criar minha conta"}
        </button>
      </form>

      <p className="auth-switch">
        Já possui uma conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthShell>
  );
}
