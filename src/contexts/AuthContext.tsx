import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, configured } from "../lib/supabase";
import type { Profile } from "../types";
interface Auth {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string;
  retry: () => void;
  logout: () => Promise<void>;
}
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(configured),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    if (!configured) return;
    let alive = true,
      revision = 0;
    const load = async (next: Session | null) => {
      const current = ++revision;
      setSession(next);
      setProfile(null);
      setError("");
      setLoading(Boolean(next));
      if (!next) return;
      try {
        const { data, error: err } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", next.user.id)
          .single();
        if (!alive || current !== revision) return;
        if (err) throw err;
        if (!data || !["manager", "worker"].includes(data.role))
          throw new Error("Профиль не настроен. Обратитесь к администратору.");
        setProfile(data as Profile);
      } catch (e) {
        if (alive && current === revision)
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить профиль",
          );
      } finally {
        if (alive && current === revision) setLoading(false);
      }
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      void load(next);
    });
    void supabase.auth.getSession().then(({ data, error: err }) => {
      if (!alive) return;
      if (err) {
        setError(err.message);
        setLoading(false);
      } else void load(data.session);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [version]);
  async function logout() {
    const { error: err } = await supabase.auth.signOut();
    if (err) throw new Error(err.message);
    setProfile(null);
    setSession(null);
  }
  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        error,
        retry: () => setVersion((v) => v + 1),
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
