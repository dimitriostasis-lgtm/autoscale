import { type PropsWithChildren, useRef, useState } from "react";

import { agencyBillingPlan } from "../../lib/billing";
import { cx } from "../../lib/cx";
import type { Route } from "../../lib/router";
import type { UserRecord } from "../../types";
import { theme } from "../../styles/theme";

function roleLabel(role: UserRecord["role"]): string {
  if (role === "PLATFORM_ADMIN") {
    return "Platform Admin";
  }

  if (role === "AGENCY_ADMIN") {
    return "Agency Admin";
  }

  if (role === "AGENCY_MANAGER") {
    return "Agency Manager";
  }

  return "User";
}

function accessTabLabel(role: UserRecord["role"]): string | null {
  if (role === "PLATFORM_ADMIN") {
    return "Admin Access";
  }

  if (role === "AGENCY_ADMIN") {
    return "Agency Access";
  }

  if (role === "AGENCY_MANAGER") {
    return "Manager Access";
  }

  return null;
}

type AccessJumpOption = {
  id: string;
  label: string;
};

function accessJumpOptions(currentUser: UserRecord): AccessJumpOption[] {
  const options: AccessJumpOption[] = [{ id: "access-directory", label: "Directory and accounts" }];

  if (currentUser.role === "PLATFORM_ADMIN") {
    return [
      { id: "access-platform-sales", label: "Weekly sales" },
      { id: "access-agency-performance", label: "Agency performance" },
      ...options,
      { id: "access-agency-settings", label: "Agency settings" },
      { id: "access-create-accounts", label: "Create accounts" },
      { id: "access-influencer-profiles", label: "Influencer profiles" },
    ];
  }

  if (currentUser.role === "AGENCY_ADMIN") {
    return [
      { id: "access-agency-summary", label: "Agency summary and credits" },
      ...options,
      { id: "access-create-accounts", label: "Create agency accounts" },
    ];
  }

  if (currentUser.role === "AGENCY_MANAGER" && currentUser.managerPermissions?.canManageCredits) {
    return [{ id: "access-agency-summary", label: "Agency summary and credits" }, ...options];
  }

  return options;
}

interface AppFrameProps extends PropsWithChildren {
  currentUser: UserRecord;
  route: Route;
  onNavigate: (route: Route, options?: { replace?: boolean }) => void;
  onLogout: () => Promise<void>;
  themeMode: "dark" | "light";
  onToggleThemeMode: () => void;
}

export function AppFrame({ currentUser, route, onNavigate, onLogout, themeMode, onToggleThemeMode, children }: AppFrameProps) {
  const modelSlug = route.name === "workspace" || route.name === "gallery" ? route.slug : null;
  const accessLabel = accessTabLabel(currentUser.role);
  const nextThemeLabel = themeMode === "dark" ? "light" : "dark";
  const isAgencyAdmin = currentUser.role === "AGENCY_ADMIN";
  const accessOptions = accessJumpOptions(currentUser);
  const [isAccessMenuOpen, setIsAccessMenuOpen] = useState(false);
  const accessMenuCloseTimerRef = useRef<number | null>(null);

  function openAccessMenu(): void {
    if (accessMenuCloseTimerRef.current !== null) {
      window.clearTimeout(accessMenuCloseTimerRef.current);
      accessMenuCloseTimerRef.current = null;
    }

    setIsAccessMenuOpen(true);
  }

  function scheduleAccessMenuClose(): void {
    if (accessMenuCloseTimerRef.current !== null) {
      window.clearTimeout(accessMenuCloseTimerRef.current);
    }

    accessMenuCloseTimerRef.current = window.setTimeout(() => {
      setIsAccessMenuOpen(false);
      accessMenuCloseTimerRef.current = null;
    }, 180);
  }

  function handleAccessJumpChange(sectionValue: string): void {
    const sectionId = sectionValue === "__top" ? null : sectionValue;
    setIsAccessMenuOpen(false);
    onNavigate({ name: "admin", sectionId });

    window.setTimeout(() => {
      if (!sectionId) {
        window.scrollTo({ behavior: "smooth", top: 0 });
        return;
      }

      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  return (
    <div className="app-shell-grid">
      <header className="sticky top-0 z-40 border-b border-[color:var(--surface-border)] bg-[color:var(--header-bg)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-4 lg:px-8 lg:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-col gap-4 md:flex-1 md:flex-row md:items-center md:gap-6">
              <button
                className="inline-flex shrink-0 items-center gap-3 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-2 text-left transition hover:bg-[color:var(--surface-soft-hover)]"
                onClick={() => onNavigate({ name: "models" })}
                type="button"
              >
                <span className="font-display inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--accent-main)] font-bold text-[color:var(--accent-foreground)]">
                  A
                </span>
                <span>
                  <span className="font-display block text-lg text-[color:var(--text-strong)]">Autoscale</span>
                  <span className="block text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">Internal Generation</span>
                </span>
              </button>

              <nav className="flex min-w-0 flex-wrap gap-2 md:flex-1 md:justify-start">
                {[
                  { label: "Models", route: { name: "models" } as Route, active: route.name === "models" },
                  {
                    label: "Workspace",
                    route: modelSlug ? ({ name: "workspace", slug: modelSlug, boardId: route.name === "workspace" ? route.boardId : null, mode: route.name === "workspace" ? route.mode : "sfw" } as Route) : null,
                    active: route.name === "workspace",
                  },
                  {
                    label: "Gallery",
                    route: modelSlug ? ({ name: "gallery", slug: modelSlug } as Route) : null,
                    active: route.name === "gallery",
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    className={cx(
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      item.active
                        ? "bg-[color:var(--accent-main)] text-[color:var(--accent-foreground)]"
                        : "border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]",
                      !item.route && "cursor-not-allowed opacity-40 hover:bg-[color:var(--surface-soft)]",
                    )}
                    disabled={!item.route}
                    onClick={() => item.route && onNavigate(item.route)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
                {accessLabel ? (
                  <div
                    className="relative"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setIsAccessMenuOpen(false);
                      }
                    }}
                    onMouseEnter={openAccessMenu}
                    onMouseLeave={scheduleAccessMenuClose}
                  >
                    <button
                      aria-expanded={isAccessMenuOpen}
                      className={cx(
                        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                        route.name === "admin"
                          ? "bg-[color:var(--accent-main)] text-[color:var(--accent-foreground)]"
                          : "border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]",
                      )}
                      onClick={() => handleAccessJumpChange("__top")}
                      type="button"
                    >
                      {accessLabel}
                      <span aria-hidden="true" className="text-xs opacity-70">
                        v
                      </span>
                    </button>

                    {isAccessMenuOpen ? (
                      <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-72 overflow-hidden rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] p-2 shadow-[var(--shadow-card-strong)]">
                        <button
                          className={cx(
                            "block w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition",
                            route.name === "admin" && !route.sectionId
                              ? "bg-[color:var(--accent-main)] text-[color:var(--accent-foreground)]"
                              : "text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]",
                          )}
                          onClick={() => handleAccessJumpChange("__top")}
                          type="button"
                        >
                          {accessLabel} overview
                        </button>
                        {accessOptions.map((option) => (
                          <button
                            key={option.id}
                            className={cx(
                              "mt-1 block w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition",
                              route.name === "admin" && route.sectionId === option.id
                                ? "bg-[color:var(--accent-main)] text-[color:var(--accent-foreground)]"
                                : "text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]",
                            )}
                            onClick={() => handleAccessJumpChange(option.id)}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {isAgencyAdmin ? (
                  <button
                    className={cx(
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      route.name === "billing"
                        ? "bg-[color:var(--accent-main)] text-[color:var(--accent-foreground)]"
                        : "border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]",
                    )}
                    onClick={() => onNavigate({ name: "billing" })}
                    type="button"
                  >
                    Billing
                  </button>
                ) : null}
              </nav>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              <button
                aria-label={`Switch to ${nextThemeLabel} mode`}
                aria-pressed={themeMode === "light"}
                className="relative inline-grid grid-cols-2 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] p-1 text-xs font-semibold shadow-[var(--shadow-soft)] transition"
                onClick={onToggleThemeMode}
                type="button"
              >
                <span
                  className={cx(
                    "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-[color:var(--accent-main)] shadow-[var(--shadow-soft)] transition-transform duration-300",
                    themeMode === "light" && "translate-x-full",
                  )}
                />
                <span className={cx("relative z-10 px-3 py-1.5 transition", themeMode === "dark" ? "text-[color:var(--accent-foreground)]" : "text-[color:var(--text-muted)]")}>Dark</span>
                <span className={cx("relative z-10 px-3 py-1.5 transition", themeMode === "light" ? "text-[color:var(--accent-foreground)]" : "text-[color:var(--text-muted)]")}>Light</span>
              </button>

              <div className="flex items-center gap-3 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-2">
                <div className="text-right">
                  <p className="text-sm font-semibold text-[color:var(--text-strong)]">{currentUser.name}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                    {roleLabel(currentUser.role)}
                    {currentUser.agencyName ? ` • ${currentUser.agencyName}` : ""}
                  </p>
                </div>
              </div>

              {isAgencyAdmin ? (
                <div className="flex items-center gap-2 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-3 py-2 shadow-[var(--shadow-soft)]">
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Credits</p>
                    <p className="text-sm font-bold text-[color:var(--text-strong)]">{agencyBillingPlan.creditBalance.toLocaleString()}</p>
                  </div>
                  <button
                    aria-label="Open billing"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--accent-main)] text-lg font-bold leading-none text-[color:var(--accent-foreground)] transition hover:brightness-105"
                    onClick={() => onNavigate({ name: "billing" })}
                    type="button"
                  >
                    +
                  </button>
                </div>
              ) : null}

              <button className={theme.buttonSecondary} onClick={() => void onLogout()} type="button">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
