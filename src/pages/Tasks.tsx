import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Clock3, Check, RotateCcw } from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";
import { Badge, Empty, ErrorBox, Loading, Modal } from "../components/UI";
import { Editor, DeleteDialog } from "../components/Editors";
import { TaskTable } from "../components/TaskTable";
import { actions, statuses, formatDate } from "../utils/workflow";
import type { Status } from "../types";
export function Tasks() {
  const { objects, tasks, profiles, reload, notify } = useWorkspace(),
    { profile } = useAuth();
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [create, setCreate] = useState(false);
  const visible = tasks.filter(
    (t) =>
      (profile?.role === "manager" || t.assignee_id === profile?.id) &&
      (filter === "all" || t.status === filter) &&
      t.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ПЛАНИРОВАНИЕ И КОНТРОЛЬ</p>
          <h1>{profile?.role === "manager" ? "Все задачи" : "Мои задачи"}</h1>
          <p className="muted">
            От поручения до результата — каждый шаг под контролем.
          </p>
        </div>
        {profile?.role === "manager" && (
          <button onClick={() => setCreate(true)} disabled={!objects.length}>
            <Plus size={18} />
            Создать задачу
          </button>
        )}
      </div>
      <section className="panel">
        <div className="section-bar filters">
          <label className="search">
            <input
              aria-label="Поиск задач"
              placeholder="Найти задачу…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Фильтр по статусу"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Все статусы</option>
            {Object.entries(statuses).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <TaskTable tasks={visible} />
      </section>
      {create && (
        <Editor
          kind="task"
          objects={objects}
          profiles={profiles}
          onClose={() => setCreate(false)}
          onSaved={() => {
            setCreate(false);
            notify("Задача создана");
            reload();
          }}
        />
      )}
    </>
  );
}
export function TaskDetail() {
  const { id } = useParams(),
    navigate = useNavigate(),
    { profile } = useAuth();
  const { objects, tasks, profiles, reload, notify } = useWorkspace();
  const task = tasks.find((t) => t.id === id);
  const history = useData(
    () => (task ? api.history(task.id) : Promise.resolve([])),
    [task?.id],
  );
  const [edit, setEdit] = useState(false),
    [remove, setRemove] = useState(false),
    [target, setTarget] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!task)
    return (
      <Empty>
        Задача не найдена или доступ ограничен.{" "}
        <Link to="/my-tasks">К задачам</Link>
      </Empty>
    );
  const name = (id: string) =>
    profiles.find((p) => p.id === id)?.full_name ?? "Пользователь";
  async function change(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!task || !target) return;
    const comment = String(
      new FormData(e.currentTarget).get("comment") ?? "",
    ).trim();
    if (target === "rework" && !comment) {
      setError("Укажите причину возврата");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.change(task.id, target, comment);
      setTarget(null);
      notify("Статус обновлён");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить статус");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back" to={`/objects/${task.object_id}`}>
        ← К объекту
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ЗАДАЧА / {task.id.slice(0, 8)}</p>
          <h1>{task.title}</h1>
          <Badge status={task.status} />
        </div>
        {profile?.role === "manager" && (
          <div className="actions">
            <button className="secondary" onClick={() => setEdit(true)}>
              <Pencil size={16} />
              Изменить
            </button>
            <button
              className="icon-button danger-text"
              aria-label="Удалить задачу"
              onClick={() => setRemove(true)}
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>
      <div className="detail-grid">
        <section className="panel task-content">
          <h2>Описание задачи</h2>
          <p className="description">
            {task.description || "Описание не добавлено."}
          </p>
          <div className="task-meta">
            <div>
              <span>Объект</span>
              <Link to={`/objects/${task.object_id}`}>
                {objects.find((o) => o.id === task.object_id)?.name}
              </Link>
            </div>
            <div>
              <span>Исполнитель</span>
              <strong>{name(task.assignee_id)}</strong>
            </div>
            <div>
              <span>Постановщик</span>
              <strong>{name(task.author_id)}</strong>
            </div>
            <div>
              <span>Дата создания</span>
              <strong>{formatDate(task.created_at)}</strong>
            </div>
          </div>
          <div className="status-actions">
            {profile &&
              actions(profile.role, task.status)
                .filter(
                  () =>
                    profile.role === "manager" ||
                    task.assignee_id === profile.id,
                )
                .map((s) => (
                  <button
                    key={s}
                    className={s === "rework" ? "secondary" : ""}
                    onClick={() => {
                      setError("");
                      setTarget(s);
                    }}
                  >
                    {s === "accepted" ? (
                      <Check size={16} />
                    ) : s === "rework" ? (
                      <RotateCcw size={16} />
                    ) : null}
                    {s === "in_progress"
                      ? "Взять в работу"
                      : s === "review"
                        ? "Отправить на проверку"
                        : s === "accepted"
                          ? "Принять работу"
                          : "Вернуть на доработку"}
                  </button>
                ))}
            {task.status === "accepted" && (
              <p className="muted">Работа принята. Задача завершена.</p>
            )}
          </div>
        </section>
        <section className="panel history-panel">
          <h2>
            <Clock3 size={19} />
            История статусов
          </h2>
          {history.loading ? (
            <Loading />
          ) : history.error ? (
            <ErrorBox error={history.error} retry={history.reload} />
          ) : !history.data?.length ? (
            <Empty>История пока пуста</Empty>
          ) : (
            <ol className="timeline">
              {history.data.map((h) => (
                <li key={h.id}>
                  <div className="history-transition">
                    {h.old_status ? (
                      <>
                        <span>{statuses[h.old_status]}</span>
                        <span>→</span>
                      </>
                    ) : (
                      <span>Создана →</span>
                    )}
                    <Badge status={h.new_status} />
                  </div>
                  <strong>{name(h.changed_by)}</strong>
                  <small>{formatDate(h.created_at)}</small>
                  {h.comment && <p className="comment">{h.comment}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      {edit && (
        <Editor
          kind="task"
          task={task}
          objects={objects}
          profiles={profiles}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            notify("Задача обновлена");
            reload();
          }}
        />
      )}
      {remove && (
        <DeleteDialog
          kind="tasks"
          id={task.id}
          name={task.title}
          onClose={() => setRemove(false)}
          onDeleted={() => {
            notify("Задача удалена");
            navigate(`/objects/${task.object_id}`);
            reload();
          }}
        />
      )}
      {target && (
        <Modal
          title={
            target === "rework"
              ? "Возврат на доработку"
              : `Перевести: ${statuses[target]}`
          }
          onClose={() => {
            if (!busy) setTarget(null);
          }}
        >
          <form onSubmit={change}>
            <label>
              {target === "rework"
                ? "Причина возврата *"
                : "Комментарий (необязательно)"}
              <textarea
                name="comment"
                rows={4}
                maxLength={4000}
                required={target === "rework"}
                autoFocus
                placeholder={
                  target === "rework"
                    ? "Что нужно исправить?"
                    : "Добавьте пояснение"
                }
              />
            </label>
            {error && <ErrorBox error={error} />}
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setTarget(null)}
              >
                Отмена
              </button>
              <button disabled={busy}>
                {busy ? "Сохранение…" : "Подтвердить"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
