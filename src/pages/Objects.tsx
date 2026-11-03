import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useAuth } from "../contexts/AuthContext";
import { Editor, DeleteDialog } from "../components/Editors";
import { Empty } from "../components/UI";
import { TaskTable } from "../components/TaskTable";
export function Objects() {
  const { objects, tasks, profiles, reload, notify } = useWorkspace(),
    { profile } = useAuth();
  const [create, setCreate] = useState(false),
    [query, setQuery] = useState("");
  const filtered = objects.filter((o) =>
    `${o.name} ${o.address}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</p>
          <h1>
            Строительные объекты<span className="count">{objects.length}</span>
          </h1>
          <p className="muted">Всё, что происходит на ваших объектах.</p>
        </div>
        {profile?.role === "manager" && (
          <button onClick={() => setCreate(true)}>
            <Plus size={18} />
            Создать объект
          </button>
        )}
      </div>
      <div className="stats">
        <div>
          <span>Всего объектов</span>
          <strong>{objects.length.toString().padStart(2, "0")}</strong>
          <Building2 />
        </div>
        <div>
          <span>Задач в работе</span>
          <strong>
            {tasks
              .filter((t) => t.status === "in_progress")
              .length.toString()
              .padStart(2, "0")}
          </strong>
          <span className="stat-dot blue" />
        </div>
        <div>
          <span>Ожидают проверки</span>
          <strong>
            {tasks
              .filter((t) => t.status === "review")
              .length.toString()
              .padStart(2, "0")}
          </strong>
          <span className="stat-dot amber" />
        </div>
        <div>
          <span>Задач принято</span>
          <strong>
            {tasks
              .filter((t) => t.status === "accepted")
              .length.toString()
              .padStart(2, "0")}
          </strong>
          <span className="stat-dot green" />
        </div>
      </div>
      <div className="section-bar">
        <h2>Все объекты</h2>
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Поиск объектов"
            placeholder="Поиск по названию или адресу"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="object-grid">
        {filtered.map((o, i) => {
          const related = tasks.filter((t) => t.object_id === o.id),
            done = related.filter((t) => t.status === "accepted").length;
          return (
            <Link className="object-card" to={`/objects/${o.id}`} key={o.id}>
              <div className="object-card-top">
                <span className="building-icon">
                  <Building2 size={25} />
                </span>
                <span className="object-number">
                  ОБЪЕКТ / {String(i + 1).padStart(2, "0")}
                </span>
                <ArrowUpRight size={20} />
              </div>
              <h2>{o.name}</h2>
              <p className="address">
                <MapPin size={15} />
                {o.address}
              </p>
              <div className="progress">
                <span
                  style={{
                    width: `${related.length ? (done / related.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="object-card-footer">
                <span>{related.length} задач</span>
                <span>{done} принято</span>
              </div>
            </Link>
          );
        })}
      </div>
      {!filtered.length && (
        <Empty>
          {query
            ? "Объекты не найдены. Измените запрос."
            : "Объектов пока нет. Постановщик может создать первый объект."}
        </Empty>
      )}
      {create && (
        <Editor
          kind="object"
          objects={objects}
          profiles={profiles}
          onClose={() => setCreate(false)}
          onSaved={() => {
            setCreate(false);
            notify("Объект создан");
            reload();
          }}
        />
      )}
    </>
  );
}
export function ObjectDetail() {
  const { id } = useParams(),
    navigate = useNavigate(),
    { profile } = useAuth();
  const { objects, tasks, profiles, reload, notify } = useWorkspace();
  const object = objects.find((o) => o.id === id);
  const [edit, setEdit] = useState<"object" | "task" | null>(null),
    [remove, setRemove] = useState(false);
  if (!object)
    return (
      <Empty>
        Объект не найден или доступ ограничен.{" "}
        <Link to="/objects">К объектам</Link>
      </Empty>
    );
  return (
    <>
      <Link className="back" to="/objects">
        ← Все объекты
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">КАРТОЧКА ОБЪЕКТА</p>
          <h1>{object.name}</h1>
          <p className="address">
            <MapPin size={16} />
            {object.address}
          </p>
        </div>
        {profile?.role === "manager" && (
          <div className="actions">
            <button className="secondary" onClick={() => setEdit("object")}>
              <Pencil size={16} />
              Изменить
            </button>
            <button
              className="icon-button danger-text"
              aria-label="Удалить объект"
              onClick={() => setRemove(true)}
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>
      <section className="panel">
        <div className="section-bar">
          <div>
            <h2>
              Задачи объекта{" "}
              <span className="count">
                {tasks.filter((t) => t.object_id === id).length}
              </span>
            </h2>
            <p className="muted">Текущий ход работ и ответственные</p>
          </div>
          {profile?.role === "manager" && (
            <button onClick={() => setEdit("task")}>
              <Plus size={18} />
              Создать задачу
            </button>
          )}
        </div>
        <TaskTable tasks={tasks.filter((t) => t.object_id === id)} />
      </section>
      {edit && (
        <Editor
          kind={edit}
          object={object}
          objects={objects}
          profiles={profiles}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            notify("Изменения сохранены");
            reload();
          }}
        />
      )}
      {remove && (
        <DeleteDialog
          kind="objects"
          id={object.id}
          name={object.name}
          onClose={() => setRemove(false)}
          onDeleted={() => {
            notify("Объект удалён");
            navigate("/objects");
            reload();
          }}
        />
      )}
    </>
  );
}
