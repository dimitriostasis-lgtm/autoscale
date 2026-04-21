import {
  type PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { useApolloClient } from "@apollo/client/react";

import { LOGIN_MUTATION, LOGOUT_MUTATION, ME_QUERY } from "../queries/auth";
import type { AuthPayload, UserRecord } from "../types";

interface AuthContextValue {
  user: UserRecord | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const client = useApolloClient();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useEffectEvent(async () => {
    try {
      const { data } = await client.query<{ me: UserRecord | null }>({
        query: ME_QUERY,
        fetchPolicy: "network-only",
      });
      setUser(data?.me ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const value: AuthContextValue = {
    user,
    loading,
    login: async (email, password) => {
      const { data } = await client.mutate<{ login: AuthPayload }>({
        mutation: LOGIN_MUTATION,
        variables: { email, password },
      });

      if (!data?.login.user) {
        throw new Error("Login failed");
      }

      setUser(data.login.user);
    },
    logout: async () => {
      await client.mutate({ mutation: LOGOUT_MUTATION });
      await client.clearStore();
      setUser(null);
    },
    refresh: async () => {
      setLoading(true);
      await loadSession();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}