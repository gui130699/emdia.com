import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../stores/ToastContext";
import { getAuthErrorMessage } from "../../utils/authErrors";
import SettingsCard from "./SettingsCard";
import FormField from "../ui/FormField";
import { inputClass } from "../ui/formStyles";
import { formatDateObj } from "../../utils/date";

export default function SecurityCard() {
  const { currentUser } = useAuth();
  const { show } = useToast();

  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const lastSignIn = currentUser?.metadata.lastSignInTime;

  async function handleChangePassword() {
    if (!auth.currentUser?.email) return;
    if (newPassword.length < 8) {
      show("A nova senha deve ter pelo menos 8 caracteres.", "error");
      return;
    }
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      show("Senha alterada com sucesso.");
      setOpen(false);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      show(getAuthErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard icon={ShieldCheck} title="Segurança" description="Proteja sua conta">
      <div className="divide-y divide-ink-100">
        <div className="py-3">
          {!open ? (
            <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between text-left text-sm">
              <span className="font-medium text-ink-900">Senha</span>
              <span className="text-ink-400">••••••••••••</span>
            </button>
          ) : (
            <div className="space-y-3">
              <FormField label="Senha atual" htmlFor="current-password">
                <input id="current-password" type="password" className={inputClass} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </FormField>
              <FormField label="Nova senha" htmlFor="new-password">
                <input id="new-password" type="password" className={inputClass} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </FormField>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-ink-100 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50">
                  Cancelar
                </button>
                <button onClick={handleChangePassword} disabled={saving} className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-ink-900">Autenticação de dois fatores</p>
            <p className="text-xs text-ink-400">Em breve</p>
          </div>
          <span className="rounded-full bg-ink-100 px-2 py-1 text-xs font-semibold text-ink-400">Em breve</span>
        </div>

        <div className="py-3">
          <p className="text-sm font-medium text-ink-900">Sessão atual</p>
          <p className="text-xs text-ink-400">
            {lastSignIn ? `Último acesso em ${formatDateObj(new Date(lastSignIn))}` : "—"}
          </p>
        </div>
      </div>
    </SettingsCard>
  );
}
