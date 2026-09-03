import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import BottomNav from "../components/layout/BottomNav";
import MoreSheet from "../components/layout/MoreSheet";
import OfflineBanner from "../components/layout/OfflineBanner";
import InstallPrompt from "../components/layout/InstallPrompt";
import { FinanceDataProvider } from "../stores/FinanceDataContext";
import { SettingsProvider } from "../stores/SettingsContext";

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <SettingsProvider>
      <FinanceDataProvider>
        <div className="flex min-h-screen bg-ink-50">
          <Sidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

          <div className="flex min-w-0 flex-1 flex-col">
            <OfflineBanner />
            <main className="flex-1 pb-20 md:pb-0">
              <Outlet context={{ onOpenMenu: () => setMobileMenuOpen(true) }} />
            </main>
            <BottomNav onOpenMore={() => setMoreOpen(true)} />
          </div>

          <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
          <InstallPrompt />
        </div>
      </FinanceDataProvider>
    </SettingsProvider>
  );
}
