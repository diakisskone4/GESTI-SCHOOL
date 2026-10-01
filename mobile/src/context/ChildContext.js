import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { inscriptionsApi } from "../api/endpoints";
import { useAuth } from "./AuthContext";

// Pour un élève : une seule "inscription active" (lui-même).
// Pour un parent : une inscription active par enfant. Le backend restreint déjà
// la liste à l'élève lui-même / aux enfants du parent connecté (voir InscriptionViewSet.get_queryset).
const ChildContext = createContext(null);

export function ChildProvider({ children }) {
  const { user } = useAuth();
  const [inscriptions, setInscriptions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

  const isScoped = user?.est_eleve || user?.est_parent;

  const load = useCallback(async () => {
    if (!isScoped) return;
    setLoading(true);
    try {
      const data = await inscriptionsApi.list({ statut: "active" });
      const list = Array.isArray(data) ? data : data.results || [];
      setInscriptions(list);
      setSelectedId((current) => current ?? list[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [isScoped]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => inscriptions.find((i) => i.id === selectedId) || null,
    [inscriptions, selectedId]
  );

  return (
    <ChildContext.Provider
      value={{ inscriptions, selected, selectedId, setSelectedId, loading, reload: load }}
    >
      {children}
    </ChildContext.Provider>
  );
}

export function useChild() {
  const ctx = useContext(ChildContext);
  if (!ctx) throw new Error("useChild doit être utilisé à l'intérieur d'un ChildProvider");
  return ctx;
}
