import { useEffect, useState } from "react";
import { ApolloProvider } from "@apollo/client/react";

import { AppFrame } from "./components/layout/AppFrame";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { apolloClient } from "./lib/apollo";
import { useRoute } from "./lib/router";
import { LoginPage } from "./pages/LoginPage";
import { AdminPage } from "./pages/AdminPage";
import { AgencyBillingPage } from "./pages/AgencyBillingPage";
import { ModelGalleryPage } from "./pages/ModelGalleryPage";
import { ModelSelectionPage } from "./pages/ModelSelectionPage";
import { ModelWorkspacePage } from "./pages/ModelWorkspacePage";
import type { InfluencerModel } from "./types";
import { theme } from "./styles/theme";

type ThemeMode = "dark" | "light";

const themeStorageKey = "autoscale-theme-mode";

function resolveStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark";
}

function applyThemeMode(themeMode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = themeMode;
  document.documentElement.style.colorScheme = themeMode;
}

function AppContent() {
  const { route, navigate } = useRoute();
  const { user, loading, login, logout } = useAuth();
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const nextThemeMode = resolveStoredThemeMode();
    applyThemeMode(nextThemeMode);
    return nextThemeMode;
  });

  useEffect(() => {
    applyThemeMode(themeMode);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(themeStorageKey, themeMode);
    }
  }, [themeMode]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user && route.name !== "login") {
      navigate({ name: "login" }, { replace: true });
      return;
    }

    if (user && route.name === "login") {
      navigate({ name: "models" }, { replace: true });
    }
  }, [loading, navigate, route.name, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className={theme.cardStrong + " glass-panel rounded-[32px] px-8 py-6 text-sm font-semibold text-white/66"}>
          Loading AutoScale...
        </div>
      </div>
    );
  }

  if (!user || route.name === "login") {
    return <LoginPage onLogin={async (email, password) => login(email, password)} />;
  }

  let page = <ModelSelectionPage onOpenModel={(model: InfluencerModel) => navigate({ name: "workspace", slug: model.slug })} />;

  if (route.name === "workspace") {
    page = (
      <ModelWorkspacePage
        boardId={route.boardId}
        mode={route.mode ?? "sfw"}
        onSelectBoard={(nextBoardId) => navigate({ name: "workspace", slug: route.slug, boardId: nextBoardId, mode: route.mode ?? "sfw" })}
        onSelectMode={(nextMode) => navigate({ name: "workspace", slug: route.slug, boardId: null, mode: nextMode })}
        slug={route.slug}
      />
    );
  } else if (route.name === "gallery") {
    page = <ModelGalleryPage slug={route.slug} />;
  } else if (route.name === "admin") {
    page = <AdminPage currentUser={user} />;
  } else if (route.name === "billing") {
    page = user.role === "AGENCY_ADMIN" ? <AgencyBillingPage currentUser={user} /> : <AdminPage currentUser={user} />;
  }

  return (
    <AppFrame
      currentUser={user}
      onLogout={logout}
      onNavigate={navigate}
      onToggleThemeMode={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
      route={route}
      themeMode={themeMode}
    >
      {page}
    </AppFrame>
  );
}

export default function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ApolloProvider>
  );
}
