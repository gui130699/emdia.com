import { Bell } from "lucide-react";
import { useSettings } from "../../stores/SettingsContext";
import SettingsCard from "./SettingsCard";
import ToggleRow from "./ToggleRow";

export default function NotificationsCard() {
  const { settings, updateNotifications } = useSettings();
  const { notifications } = settings;

  return (
    <SettingsCard icon={Bell} title="Notificações" description="Escolha como deseja ser notificado">
      <div className="divide-y divide-ink-100">
        <ToggleRow
          label="E-mail"
          description="Receba notificações por e-mail"
          checked={notifications.email}
          onChange={(checked) => updateNotifications({ email: checked })}
        />
        <ToggleRow
          label="Lembretes de contas"
          description="Avisos antes do vencimento"
          checked={notifications.billReminders}
          onChange={(checked) => updateNotifications({ billReminders: checked })}
        />
        <ToggleRow
          label="Lembretes de metas"
          description="Seus objetivos e prazos"
          checked={notifications.goalReminders}
          onChange={(checked) => updateNotifications({ goalReminders: checked })}
        />
        <ToggleRow
          label="Alertas importantes"
          description="Movimentações e segurança"
          checked={notifications.importantAlerts}
          onChange={(checked) => updateNotifications({ importantAlerts: checked })}
        />
        <ToggleRow
          label="Promoções e novidades"
          description="Dicas e atualizações do EM DIA"
          checked={notifications.promotions}
          onChange={(checked) => updateNotifications({ promotions: checked })}
        />
      </div>
    </SettingsCard>
  );
}
