import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import "./Dashboard.css";

export default function Dashboard() {
  const { currentUser } = useAuth();

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>emdia.com</h1>
        <button onClick={() => signOut(auth)}>Sair</button>
      </header>
      <main className="dashboard-content">
        <h2>Olá, {currentUser?.displayName || currentUser?.email}!</h2>
        <p>Suas finanças em breve estarão por aqui.</p>
      </main>
    </div>
  );
}
