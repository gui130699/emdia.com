import { LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import Header from "../components/layout/Header";
import { useLayoutContext } from "../hooks/useLayoutContext";
import ProfileCard from "../components/settings/ProfileCard";
import SecurityCard from "../components/settings/SecurityCard";
import NotificationsCard from "../components/settings/NotificationsCard";
import BankAccountsCard from "../components/settings/BankAccountsCard";
import CategoriesCard from "../components/settings/CategoriesCard";
import AppearanceCard from "../components/settings/AppearanceCard";

export default function SettingsPage() {
  const { onOpenMenu } = useLayoutContext();

  return (
    <>
      <Header onOpenMenu={onOpenMenu} title="Configurações" subtitle="Personalize sua conta e preferências." showSearch={false} />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <ProfileCard />
          <SecurityCard />
          <NotificationsCard />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <BankAccountsCard />
          <CategoriesCard />
          <AppearanceCard />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-surface p-4">
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-1.5 rounded-lg border border-danger-200 px-4 py-2 text-sm font-semibold text-danger-600 hover:bg-danger-500/10"
          >
            <LogOut size={16} /> Sair da conta
          </button>
          <p className="flex items-center gap-1.5 text-xs text-ink-400">
            <ShieldCheck size={14} /> Seus dados são protegidos com criptografia de ponta a ponta.
          </p>
        </div>
      </div>
    </>
  );
}
