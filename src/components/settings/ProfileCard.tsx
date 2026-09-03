import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../../contexts/AuthContext";
import { auth, storage } from "../../firebase";
import { userProfileService } from "../../services/userProfileService";
import { useToast } from "../../stores/ToastContext";
import { withTimeout } from "../../utils/withTimeout";
import { normalizePhone, formatPhoneDisplay } from "../../utils/phone";
import Avatar from "../layout/Avatar";
import SettingsCard from "./SettingsCard";
import FormField from "../ui/FormField";
import { inputClass } from "../ui/formStyles";

export default function ProfileCard() {
  const { currentUser } = useAuth();
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(currentUser?.displayName ?? "");
  const [phone, setPhone] = useState("");
  const [photoURL, setPhotoURL] = useState(currentUser?.photoURL ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    userProfileService
      .get(currentUser.uid)
      .then((profile) => {
        if (profile?.fullName) setFullName(profile.fullName);
        if (profile?.phone) setPhone(formatPhoneDisplay(profile.phone));
        if (profile?.photoURL) setPhotoURL(profile.photoURL);
      })
      .catch(() => {
        /* profile row may not exist/be reachable yet — fields just stay empty */
      });
  }, [currentUser]);

  async function handleSave() {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await userProfileService.update(auth.currentUser.uid, {
        fullName,
        phone: phone ? normalizePhone(phone) : undefined,
        email: auth.currentUser.email ?? "",
      });

      // Auth's displayName is a separate, less critical mirror used by some
      // Firebase-driven UI — its failure shouldn't block or mislabel the
      // profile save above, which already succeeded.
      updateProfile(auth.currentUser, { displayName: fullName }).catch(() => undefined);

      show(navigator.onLine ? "Perfil atualizado com sucesso." : "Alterações salvas neste dispositivo. A sincronização será feita quando você estiver online.");
    } catch {
      show("Não foi possível salvar as alterações.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;
    setUploading(true);
    try {
      const photoRef = ref(storage, `avatars/${auth.currentUser.uid}`);
      await withTimeout(uploadBytes(photoRef, file), 15000);
      const url = await getDownloadURL(photoRef);
      await updateProfile(auth.currentUser, { photoURL: url });
      await userProfileService.update(auth.currentUser.uid, { photoURL: url });
      setPhotoURL(url);
      show("Foto atualizada com sucesso.");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "storage/unauthorized") {
        show("Não foi possível enviar a foto: as regras do Firebase Storage ainda não liberam esse envio.", "error");
      } else {
        show("Não foi possível enviar a foto agora. Tente novamente em instantes.", "error");
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <SettingsCard icon={User} title="Perfil">
      <div className="flex items-center gap-4">
        {photoURL ? (
          <img src={photoURL} alt="Foto do perfil" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <Avatar name={fullName || currentUser?.email || "?"} size={56} />
        )}
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            {uploading ? "Enviando..." : "Alterar foto"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <FormField label="Nome completo" htmlFor="profile-name">
          <input id="profile-name" className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="E-mail" htmlFor="profile-email">
          <input id="profile-email" className={`${inputClass} bg-ink-50 text-ink-400`} value={currentUser?.email ?? ""} disabled />
        </FormField>
        <FormField label="Telefone" htmlFor="profile-phone">
          <input
            id="profile-phone"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))}
            placeholder="(11) 91234-5678"
            inputMode="tel"
          />
        </FormField>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar alterações"}
      </button>
    </SettingsCard>
  );
}
