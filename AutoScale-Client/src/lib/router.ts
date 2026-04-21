import { startTransition, useEffect, useEffectEvent, useState } from "react";

export type Route =
  | { name: "login" }
  | { name: "models" }
  | { name: "workspace"; slug: string; boardId?: string | null }
  | { name: "gallery"; slug: string }
  | { name: "admin" };

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
    return {
      name: "workspace",
      slug: segments[1],
      boardId: url.searchParams.get("board"),
    };
  }

  if (segments[0] === "models" && segments.length >= 3 && segments[2] === "gallery") {
    return {
      name: "gallery",
      slug: segments[1],
    };
  }

  if (segments[0] === "admin") {
    return { name: "admin" };
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
    const url = new URL(`/models/${route.slug}/workspace`, window.location.origin);
    if (route.boardId) {
      url.searchParams.set("board", route.boardId);
    }
    return `${url.pathname}${url.search}`;
  }
  if (route.name === "gallery") {
    return `/models/${route.slug}/gallery`;
  }
  return "/admin";
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