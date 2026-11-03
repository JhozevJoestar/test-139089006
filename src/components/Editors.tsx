import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { Building, Task, Profile } from "../types";
import { ErrorBox, Modal } from "./UI";
export function Editor({
  kind,
  object,
  task,
  objects,
  profiles,
  onClose,
  onSaved,
}: {
  kind: "object" | "task";
  object?: Building;
  task?: Task;
  objects: Building[];
  profiles: Profile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    setBusy(true);
    setError("");
    try {
      if (kind === "object") {
        if (!text("name") || !text("address"))
          throw new Error("Заполните название и адрес");
        await api.saveObject(
          { name: text("name"), address: text("address") },
          object?.id,
        );
      } else {
        if (!text("title") || !text("object_id") || !text("assignee_id"))
          throw new Error("Заполните обязательные поля");
        await api.saveTask(
          {
            title: text("title"),
            description: text("description"),
            object_id: text("object_id"),
            assignee_id: text("assignee_id"),
          },
          task?.id,
        );
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${(kind === "object" ? object : task) ? "Редактировать" : "Создать"} ${kind === "object" ? "объект" : "задачу"}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        {kind === "object" ? (
          <>
            <label>
              Название объекта
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={object?.name}
                placeholder="Например, ЖК «Северный парк»"
                autoFocus
              />
            </label>
            <label>
              Адрес
              <input
                name="address"
                required
                maxLength={500}
                defaultValue={object?.address}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Название задачи
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={task?.title}
                autoFocus
              />
            </label>
            <label>
              Описание
              <textarea
                name="description"
                maxLength={10000}
                rows={4}
                defaultValue={task?.description}
              />
            </label>
            <label>
              Объект
              <select
                name="object_id"
                required
                defaultValue={task?.object_id ?? object?.id ?? ""}
              >
                <option value="" disabled>
                  Выберите объект
                </option>
                {objects.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Исполнитель
              <select
                name="assignee_id"
                required
                defaultValue={task?.assignee_id ?? ""}
              >
                <option value="" disabled>
                  Выберите исполнителя
                </option>
                {profiles
                  .filter((p) => p.role === "worker")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
              </select>
            </label>
            {profiles.filter((p) => p.role === "worker").length === 0 && (
              <p className="muted">Сначала добавьте исполнителя в Supabase.</p>
            )}
          </>
        )}
        {error && <ErrorBox error={error} />}
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Отмена
          </button>
          <button disabled={busy}>{busy ? "Сохранение…" : "Сохранить"}</button>
        </div>
      </form>
    </Modal>
  );
}
export function DeleteDialog({
  kind,
  name,
  id,
  onClose,
  onDeleted,
}: {
  kind: "objects" | "tasks";
  name: string;
  id: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title="Подтвердите удаление"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>
        Удалить «{name}»?{" "}
        {kind === "tasks"
          ? "История задачи также будет удалена."
          : "Объект можно удалить только после удаления его задач."}
      </p>
      {error && <ErrorBox error={error} />}
      <div className="form-actions">
        <button className="secondary" disabled={busy} onClick={onClose}>
          Отмена
        </button>
        <button
          className="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.remove(kind, id);
              onDeleted();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Не удалось удалить");
              setBusy(false);
            }
          }}
        >
          {busy ? "Удаление…" : "Удалить"}
        </button>
      </div>
    </Modal>
  );
}
