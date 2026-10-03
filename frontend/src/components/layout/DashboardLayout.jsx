import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileTabBar from "./MobileTabBar";
import OfflineBanner from "./OfflineBanner";
import PullToRefresh from "./PullToRefresh";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Ordinateur : menu latéral. Mobile et tablette : barre d'onglets en bas (MobileTabBar). */}
      <div className="hidden lg:contents">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar />
        <OfflineBanner />
        <PullToRefresh />
        {/* La clé relance l'animation d'entrée à chaque changement de page */}
        <main key={pathname} className="page-enter app-main flex-1 px-4 py-5 lg:px-8 lg:py-6">
          <Outlet />
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
