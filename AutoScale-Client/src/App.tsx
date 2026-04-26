import { useEffect, useState } from "react";
import { ApolloProvider } from "@apollo/client/react";

import { AppFrame } from "./components/layout/AppFrame";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { apolloClient } from "./lib/apollo";
import { type Route, useRoute } from "./lib/router";
import { LoginPage } from "./pages/LoginPage";
import { AdminPage } from "./pages/AdminPage";
import { AgencyBillingPage } from "./pages/AgencyBillingPage";
import { AgencyInfluencerBuilderPage } from "./pages/AgencyInfluencerBuilderPage";
import { ModelGalleryPage } from "./pages/ModelGalleryPage";
import { ModelSelectionPage } from "./pages/ModelSelectionPage";
import { ModelWorkspacePage } from "./pages/ModelWorkspacePage";
import type { InfluencerModel, Role, UserRecord } from "./types";
import { theme } from "./styles/theme";

type ThemeMode = "dark" | "light";

const themeStorageKey = "autoscale-theme-mode";

function resolveAccessPageTitle(role: Role): string {
  if (role === "PLATFORM_ADMIN") {
    return "Admin Access";
  }

  if (role === "AGENCY_ADMIN") {
    return "Agency Access";
  }

  if (role === "AGENCY_MANAGER") {
    return "Manager Access";
  }

  return "Access";
}

function resolveRouteTitle(route: Route, user: UserRecord | null): string {
  if (route.name === "login") {
    return "Login | AutoScale";
  }

  if (route.name === "models") {
    return "Models | AutoScale";
  }

  if (route.name === "workspace") {
    return "Workspace | AutoScale";
  }

  if (route.name === "gallery") {
    return "Gallery | AutoScale";
  }

  if (route.name === "billing") {
    return "Billing | AutoScale";
  }

  if (route.name === "agencyInfluencerBuilder") {
    return "Add Influencer | AutoScale";
  }

  return `${user ? resolveAccessPageTitle(user.role) : "Admin Access"} | AutoScale`;
}

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
    document.title = resolveRouteTitle(route, user);
  }, [route, user]);

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

  let page = <ModelSelectionPage currentUser={user} onOpenModel={(model: InfluencerModel) => navigate({ name: "workspace", slug: model.slug })} />;

  if (route.name === "workspace") {
    page = (
      <ModelWorkspacePage
        boardId={route.boardId}
        mode={route.mode ?? "image-sfw"}
        onSelectBoard={(nextBoardId) => navigate({ name: "workspace", slug: route.slug, boardId: nextBoardId, mode: route.mode ?? "image-sfw" })}
        onSelectMode={(nextMode) => navigate({ name: "workspace", slug: route.slug, boardId: null, mode: nextMode })}
        slug={route.slug}
      />
    );
  } else if (route.name === "gallery") {
    page = <ModelGalleryPage slug={route.slug} />;
  } else if (route.name === "admin") {
    page = <AdminPage currentUser={user} onOpenAgencyInfluencerBuilder={() => navigate({ name: "agencyInfluencerBuilder" })} />;
  } else if (route.name === "billing") {
    page = user.role === "AGENCY_ADMIN" ? <AgencyBillingPage currentUser={user} /> : <AdminPage currentUser={user} onOpenAgencyInfluencerBuilder={() => navigate({ name: "agencyInfluencerBuilder" })} />;
  } else if (route.name === "agencyInfluencerBuilder") {
    page = user.role === "AGENCY_ADMIN" ? (
      <AgencyInfluencerBuilderPage
        currentUser={user}
        onCancel={() => navigate({ name: "admin", sectionId: "access-agency-summary" })}
        onCreated={(model: InfluencerModel) => navigate({ name: "workspace", slug: model.slug, mode: "playground" })}
      />
    ) : (
      <AdminPage currentUser={user} onOpenAgencyInfluencerBuilder={() => navigate({ name: "agencyInfluencerBuilder" })} />
    );
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
