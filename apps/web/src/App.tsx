import { useEffect, useState } from "react";
import { api, clearToken, getToken } from "./services/api";
import type { User } from "./services/types";
import { Dashboard } from "./pages/Dashboard";
import { LoginPage } from "./pages/LoginPage";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;

    api
      .me()
      .then((result) => {
        if (result.user?.active === false) {
          clearToken();
          return;
        }
        setUser(result.user);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="boot-screen">Cargando Bodega360...</div>;
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

export default App;
