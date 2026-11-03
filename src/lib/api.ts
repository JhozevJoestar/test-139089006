import { supabase } from "./supabase";
import type { Building, Task, Profile, History, Status } from "../types";
function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export const api = {
  async objects() {
    return checked(
      await supabase
        .from("objects")
        .select("*")
        .order("created_at", { ascending: false }),
    ) as Building[];
  },
  async tasks() {
    return checked(
      await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false }),
    ) as Task[];
  },
  async profiles() {
    return checked(
      await supabase.from("profiles").select("*").order("full_name"),
    ) as Profile[];
  },
  async history(id: string) {
    return checked(
      await supabase
        .from("task_history")
        .select("*")
        .eq("task_id", id)
        .order("created_at", { ascending: false }),
    ) as History[];
  },
  async saveObject(value: Pick<Building, "name" | "address">, id?: string) {
    checked(
      await (
        id
          ? supabase.from("objects").update(value).eq("id", id)
          : supabase.from("objects").insert(value)
      )
        .select("id")
        .single(),
    );
  },
  async saveTask(
    value: Pick<Task, "title" | "description" | "object_id" | "assignee_id">,
    id?: string,
  ) {
    checked(
      await (
        id
          ? supabase.from("tasks").update(value).eq("id", id)
          : supabase.from("tasks").insert(value)
      )
        .select("id")
        .single(),
    );
  },
  async remove(table: "objects" | "tasks", id: string) {
    checked(
      await supabase.from(table).delete().eq("id", id).select("id").single(),
    );
  },
  async change(id: string, status: Status, comment: string) {
    checked(
      await supabase.rpc("change_task_status", {
        p_task_id: id,
        p_new_status: status,
        p_comment: comment,
      }),
    );
  },
};
