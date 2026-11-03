import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { Task } from "../types";
import { useWorkspace } from "../contexts/Workspace";
import { Badge, Empty } from "./UI";
export function TaskTable({ tasks }: { tasks: Task[] }) {
  const { objects, profiles } = useWorkspace();
  if (!tasks.length)
    return <Empty>Задач пока нет. Новые поручения появятся здесь.</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Задача</th>
            <th>Объект</th>
            <th>Исполнитель</th>
            <th>Статус</th>
            <th>
              <span className="sr-only">Открыть</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>
                <Link className="task-title" to={`/tasks/${t.id}`}>
                  {t.title}
                </Link>
                <small>#{t.id.slice(0, 8)}</small>
              </td>
              <td>
                <Link to={`/objects/${t.object_id}`}>
                  {objects.find((o) => o.id === t.object_id)?.name ?? "Объект"}
                </Link>
              </td>
              <td>
                <span className="person">
                  <span className="avatar small">
                    {profiles
                      .find((p) => p.id === t.assignee_id)
                      ?.full_name.slice(0, 1) ?? "И"}
                  </span>
                  {profiles.find((p) => p.id === t.assignee_id)?.full_name ??
                    "Исполнитель"}
                </span>
              </td>
              <td>
                <Badge status={t.status} />
              </td>
              <td>
                <Link aria-label={`Открыть ${t.title}`} to={`/tasks/${t.id}`}>
                  <ArrowUpRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
