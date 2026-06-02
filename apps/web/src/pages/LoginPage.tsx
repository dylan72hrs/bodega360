import { FormEvent, useState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";
import { Button } from "../components/Button";
import { api, saveToken } from "../services/api";
import type { User } from "../services/types";

export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await api.login(identifier, password);
      saveToken(result.token);
      onLogin(result.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No fue posible iniciar sesion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">
          <LockKeyhole size={28} />
        </div>
        <h1>Bodega360</h1>
        <p>Portal interno para consulta y administracion de materiales.</p>

        <form onSubmit={handleSubmit} className="form-stack">
          <label>
            Usuario
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
          </label>
          <label>
            Contrasena
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>
          {error ? <div className="alert">{error}</div> : null}
          <Button type="submit" icon={<LogIn size={18} />} disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
