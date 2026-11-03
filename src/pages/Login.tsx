import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Building2, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { configured, supabase } from "../lib/supabase";
import { ErrorBox, Loading } from "../components/UI";
export function Login() {
  const {
    session,
    profile,
    loading,
    error: authError,
    retry,
    logout,
  } = useAuth();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (session && profile)
    return (
      <Navigate
        to={profile.role === "worker" ? "/my-tasks" : "/objects"}
        replace
      />
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: String(f.get("email")).trim(),
        password: String(f.get("password")),
      });
      if (err) throw err;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <Building2 />
          <span>
            контур<span className="brand-dot">.</span>
          </span>
        </div>
        <div>
          <p className="eyebrow">ОБЪЕКТЫ И ЗАДАЧИ</p>
          <h1>
            Строим порядок.
            <br />
            Управляем результатом.
          </h1>
          <p>
            Объекты, команда и задачи — в одном рабочем пространстве. От первого
            поручения до принятой работы.
          </p>
          <div className="story-lines">
            <span>01 / Планируйте</span>
            <span>02 / Выполняйте</span>
            <span>03 / Принимайте</span>
          </div>
        </div>
        <small>Рабочее пространство строительной команды</small>
      </section>
      <section className="login-form">
        <div>
          <p className="eyebrow">ДОБРО ПОЖАЛОВАТЬ</p>
          <h2>Вход в рабочее пространство</h2>
          <p className="muted">Используйте учётную запись вашей компании.</p>
          {!configured ? (
            <ErrorBox error="Supabase пока не подключён. Заполните .env по инструкции README и перезапустите приложение." />
          ) : session ? (
            <>
              <ErrorBox
                error={
                  authError || "Профиль не найден. Обратитесь к администратору."
                }
                retry={retry}
              />
              <button
                className="secondary"
                onClick={() => void logout().catch((e) => setError(String(e)))}
              >
                Выйти
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <label>
                Рабочая почта
                <input
                  name="email"
                  type="email"
                  placeholder="name@company.ru"
                  required
                  autoComplete="username"
                />
              </label>
              <label>
                Пароль
                <input
                  name="password"
                  type="password"
                  placeholder="Введите пароль"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button className="login-button" disabled={busy}>
                {busy ? "Вход…" : "Войти"}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          {(error || (!session && authError)) && (
            <ErrorBox error={error || authError} />
          )}
          <p className="login-note">
            <ShieldCheck size={18} />
            Доступ выдаёт администратор компании.
          </p>
        </div>
      </section>
    </div>
  );
}
