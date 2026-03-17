import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import type { User } from "../types";

const LoginPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const { data } = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
      setAuth(data.token, data.user);
      await Promise.all([
        useCartStore.getState().syncGuestToServer(),
        useFavoritesStore.getState().syncGuestToServer(),
      ]);
      navigate("/");
    } catch {
      setError(t("login.errorInvalidCredentials"));
    }
  };

  return (
    <section className="auth-wrap">
      <div className="surface auth-card">
        <h1>{t("login.title")}</h1>
        <p className="muted">{t("login.description")}</p>
        <form className="form" onSubmit={onSubmit}>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("common.email")} />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("login.password")}
            type="password"
          />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">{t("login.submit")}</button>
        </form>
        <p>
          {t("login.noAccount")} <Link to="/register">{t("login.goRegister")}</Link>
        </p>
      </div>
    </section>
  );
};

export default LoginPage;
