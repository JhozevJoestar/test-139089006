import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
} from "react-router-dom";
import { Building2, ListTodo, LogOut, ShieldCheck, Menu } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Workspace } from "./contexts/Workspace";
import { Login } from "./pages/Login";
import { Objects, ObjectDetail } from "./pages/Objects";
import { Tasks, TaskDetail } from "./pages/Tasks";
import { Loading, ErrorBox } from "./components/UI";
function Shell() {
  const { session, profile, loading, error, logout, retry } = useAuth();
  const [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [logoutError, setLogoutError] = useState("");
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  if (error || !profile)
    return (
      <div className="auth-error">
        <ErrorBox error={error || "Профиль не найден"} retry={retry} />
        <button
          onClick={() => void logout().catch((e) => setLogoutError(String(e)))}
        >
          Выйти
        </button>
        {logoutError && <ErrorBox error={logoutError} />}
      </div>
    );
  return (
    <div className="app-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <NavLink className="brand" to="/objects">
          <Building2 />
          <span>
            контур<span className="brand-dot">.</span>
          </span>
        </NavLink>
        <p className="sidebar-label">УПРАВЛЕНИЕ СТРОИТЕЛЬСТВОМ</p>
        <nav>
          <NavLink to="/objects" onClick={() => setMenu(false)}>
            <Building2 size={19} />
            Объекты
          </NavLink>
          <NavLink to="/my-tasks" onClick={() => setMenu(false)}>
            <ListTodo size={19} />
            {profile.role === "manager" ? "Все задачи" : "Мои задачи"}
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-label">
            <ShieldCheck size={17} />
            Защищённое пространство
          </div>
          <div className="user-row">
            <span className="avatar">{profile.full_name.slice(0, 1)}</span>
            <div>
              <strong>{profile.full_name}</strong>
              <small>
                {profile.role === "manager" ? "Постановщик" : "Исполнитель"}
              </small>
            </div>
            <button
              aria-label="Выйти из аккаунта"
              className="icon-button"
              onClick={() =>
                void logout().catch((e) => setLogoutError(String(e)))
              }
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Открыть навигацию"
            onClick={() => setMenu((v) => !v)}
          >
            <Menu />
          </button>
          <span>
            Рабочее пространство <span className="top-divider">/</span> Объекты
            и задачи
          </span>
          <span className="workspace-tag">
            <i />
            Команда строительства
          </span>
        </header>
        <main>
          {logoutError && <ErrorBox error={logoutError} />}
          <Workspace notify={setToast}>
            <Outlet />
          </Workspace>
        </main>
        <footer>
          КОНТУР <span>Порядок на каждом этапе строительства</span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Shell />}>
            <Route index element={<Navigate to="/objects" replace />} />
            <Route path="/objects" element={<Objects />} />
            <Route path="/objects/:id" element={<ObjectDetail />} />
            <Route path="/my-tasks" element={<Tasks />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="*" element={<Navigate to="/objects" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
