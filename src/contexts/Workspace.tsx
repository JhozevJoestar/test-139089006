import { createContext, useContext, type ReactNode } from "react";
import { api } from "../lib/api";
import { useData } from "../hooks/useData";
import { useAuth } from "./AuthContext";
import { ErrorBox, Loading } from "../components/UI";
import type { Building, Task, Profile } from "../types";
interface Data {
  objects: Building[];
  tasks: Task[];
  profiles: Profile[];
  reload: () => void;
  notify: (message: string) => void;
}
const Context = createContext<Data | null>(null);
export function Workspace({
  children,
  notify,
}: {
  children: ReactNode;
  notify: (message: string) => void;
}) {
  const { profile } = useAuth();
  const { data, error, loading, reload } = useData(async () => {
    const [objects, tasks, profiles] = await Promise.all([
      api.objects(),
      api.tasks(),
      api.profiles(),
    ]);
    return { objects, tasks, profiles };
  }, [profile?.id]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  return (
    <Context.Provider value={{ ...data!, reload, notify }}>
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Workspace missing");
  return ctx;
}
