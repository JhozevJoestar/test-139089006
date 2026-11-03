export type Role = "manager" | "worker";
export type Status = "new" | "in_progress" | "review" | "accepted" | "rework";
export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
}
export interface Building {
  id: string;
  name: string;
  address: string;
  created_at: string;
  updated_at: string;
}
export interface Task {
  id: string;
  object_id: string;
  title: string;
  description: string;
  assignee_id: string;
  author_id: string;
  status: Status;
  created_at: string;
  updated_at: string;
}
export interface History {
  id: string;
  task_id: string;
  changed_by: string;
  old_status: Status | null;
  new_status: Status;
  comment: string | null;
  created_at: string;
}
