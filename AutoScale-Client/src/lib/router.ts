import { startTransition, useEffect, useEffectEvent, useState } from "react";

export type WorkspaceMode = "image-sfw" | "image-nsfw" | "video-sfw" | "video-nsfw" | "voice-sfw" | "voice-nsfw" | "playground";

export type Route =
  | { name: "login" }
  | { name: "models" }
  | { name: "workspace"; slug: string; boardId?: string | null; mode?: WorkspaceMode }
  | { name: "gallery"; slug: string }
  | { name: "billing" }
  | { name: "admin"; sectionId?: string | null };

const workspaceModes = new Set<WorkspaceMode>(["image-sfw", "image-nsfw", "video-sfw", "video-nsfw", "voice-sfw", "voice-nsfw", "playground"]);

function normalizeWorkspaceMode(requestedMode: string | null | undefined): WorkspaceMode {
  if (requestedMode === "sfw") {
    return "image-sfw";
  }

  if (requestedMode === "nsfw") {
    return "image-nsfw";
  }

  return workspaceModes.has(requestedMode as WorkspaceMode) ? (requestedMode as WorkspaceMode) : "image-sfw";
}

function currentUrl(): URL {
  return new URL(window.location.href);
}

export function parseRoute(url = currentUrl()): Route {
  const segments = url.pathname.split("/").filter(Boolean);

  if (!segments.length) {
    return { name: "models" };
  }

  if (segments[0] === "login") {
    return { name: "login" };
  }

  if (segments[0] === "models" && segments.length === 1) {
    return { name: "models" };
  }

  if (segments[0] === "models" && segments.length >= 3 && segments[2] === "workspace") {
    const requestedMode = segments[3];
    return {
      name: "workspace",
      slug: segments[1],
      boardId: url.searchParams.get("board"),
      mode: normalizeWorkspaceMode(requestedMode),
    };
  }

  if (segments[0] === "models" && segments.length >= 3 && segments[2] === "gallery") {
    return {
      name: "gallery",
      slug: segments[1],
    };
  }

  if (segments[0] === "admin") {
    return { name: "admin", sectionId: url.hash ? url.hash.slice(1) : null };
  }

  if (segments[0] === "billing") {
    return { name: "billing" };
  }

  return { name: "models" };
}

export function toPath(route: Route): string {
  if (route.name === "login") {
    return "/login";
  }
  if (route.name === "models") {
    return "/models";
  }
  if (route.name === "workspace") {
    const modeSegment = route.mode && route.mode !== "image-sfw" ? `/${route.mode}` : "";
    const url = new URL(`/models/${route.slug}/workspace${modeSegment}`, window.location.origin);
    if (route.boardId) {
      url.searchParams.set("board", route.boardId);
    }
    return `${url.pathname}${url.search}`;
  }
  if (route.name === "gallery") {
    return `/models/${route.slug}/gallery`;
  }
  if (route.name === "billing") {
    return "/billing";
  }
  const url = new URL("/admin", window.location.origin);
  if (route.sectionId) {
    url.hash = route.sectionId;
  }
  return `${url.pathname}${url.hash}`;
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute());

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useEffectEvent((nextRoute: Route, options?: { replace?: boolean }) => {
    const nextPath = toPath(nextRoute);
    startTransition(() => {
      if (options?.replace) {
        window.history.replaceState({}, "", nextPath);
      } else {
        window.history.pushState({}, "", nextPath);
      }
      setRoute(parseRoute());
    });
  });

  return { route, navigate };
}
