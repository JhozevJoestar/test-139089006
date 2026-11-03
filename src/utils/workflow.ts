import type { Role, Status } from "../types";
export const statuses: Record<Status, string> = {
  new: "Новая",
  in_progress: "В работе",
  review: "На проверке",
  accepted: "Принята",
  rework: "На доработке",
};
export function actions(role: Role, status: Status): Status[] {
  if (role === "manager")
    return status === "review" ? ["accepted", "rework"] : [];
  return status === "new" || status === "rework"
    ? ["in_progress"]
    : status === "in_progress"
      ? ["review"]
      : [];
}
export const formatDate = (value: string) =>
  new Date(value).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
