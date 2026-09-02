import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckBadgeIcon, ShieldIcon } from "./icons";
import "./AuthShell.css";

interface AuthShellProps {
  mode: "login" | "signup";
  title: string;
  subtitle: string;
  children: ReactNode;
}

export default function AuthShell({ mode, title, subtitle, children }: AuthShellProps) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <aside className="auth-brand">
          <div className="auth-logo">
            <span className="auth-logo-badge">
              <CheckBadgeIcon />
            </span>
            <span className="auth-logo-text">EM DIA</span>
          </div>
          <p className="auth-logo-domain">emdia.com</p>

          <h1 className="auth-headline">
            Seu dinheiro.
            <br />
            Sempre <span>em dia.</span>
          </h1>
          <p className="auth-tagline">
            Controle suas finanças com mais clareza e segurança.
          </p>

          <div className="auth-summary-card">
            <p className="auth-summary-title">Resumo do mês</p>
            <div className="auth-summary-row">
              <span>Receitas</span>
              <strong className="positive">R$ 6.250,00</strong>
            </div>
            <div className="auth-summary-row">
              <span>Despesas</span>
              <strong>R$ 2.430,00</strong>
            </div>
            <div className="auth-summary-balance">
              <span>Saldo</span>
              <strong>R$ 3.820,00</strong>
            </div>
            <svg className="auth-summary-chart" viewBox="0 0 64 40" fill="none">
              <path
                d="M2 32 14 24 26 27 38 14 50 18 62 6"
                stroke="#5fe3a1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="62" cy="6" r="3" fill="#5fe3a1" />
            </svg>
          </div>
        </aside>

        <section className="auth-panel">
          <div className="auth-tabs">
            <Link
              to="/login"
              className={`auth-tab${mode === "login" ? " active" : ""}`}
            >
              Entrar
            </Link>
            <Link
              to="/cadastro"
              className={`auth-tab${mode === "signup" ? " active" : ""}`}
            >
              Criar conta
            </Link>
          </div>

          <h2 className="auth-title">{title}</h2>
          <p className="auth-subtitle">{subtitle}</p>

          {children}

          <p className="auth-shield">
            <ShieldIcon /> Seus dados são protegidos
          </p>
        </section>
      </div>
    </div>
  );
}
