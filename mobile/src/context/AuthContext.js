import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "../api/endpoints";
import { tokenStore, setOnSessionExpired } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const access = await tokenStore.getAccess();
    if (!access) {
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      await tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
    // Déclenché par l'intercepteur axios quand le refresh token est invalide/expiré.
    setOnSessionExpired(() => setUser(null));
  }, [loadMe]);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    await tokenStore.setTokens({ access: data.access, refresh: data.refresh });
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await authApi.logout(await tokenStore.getRefresh());
    } catch {
      // ignore : on nettoie côté client de toute façon
    }
    await tokenStore.clear();
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await authApi.me();
    setUser(me);
    return me;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
  return ctx;
}

export const ROLE_LABELS = {
  superadmin: "Super Administrateur",
  admin: "Administrateur",
  enseignant: "Enseignant",
  eleve: "Élève",
  parent: "Parent",
  comptable: "Comptable",
  surveillant: "Surveillant",
};
