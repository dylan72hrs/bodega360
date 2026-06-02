import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Camera,
  ClipboardList,
  Download,
  FileClock,
  FileSpreadsheet,
  History,
  LogOut,
  PackageSearch,
  Plus,
  Search,
  Shield,
  Upload,
  UserPlus
} from "lucide-react";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { api, assetUrl, clearToken } from "../services/api";
import type { AuditLog, ImportResult, Material, Role, SearchLog, User } from "../services/types";
import { MaterialForm } from "./MaterialForm";

type Tab = "search" | "warehouse" | "pending" | "history" | "users";

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  WAREHOUSE: "Encargado",
  VIEWER: "Consulta"
};

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0
});

export function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("search");
  const [search, setSearch] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterRut, setRequesterRut] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selected, setSelected] = useState<Material | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const canEdit = user.role === "ADMIN" || user.role === "WAREHOUSE";
  const canAdmin = user.role === "ADMIN";

  const incompleteMaterials = useMemo(() => materials.filter((material) => material.incomplete), [materials]);

  const loadMaterials = useCallback(async (nextSearch: string, options: { requesterName?: string; requesterRut?: string; track?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await api.listMaterials(nextSearch, false, options);
      setMaterials(result.materials);
      setSelected((current) => {
        if (!current) return result.materials[0] ?? null;
        return result.materials.find((material) => material.id === current.id) ?? result.materials[0] ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMaterials("");
  }, [loadMaterials]);

  useEffect(() => {
    if (tab === "history" && canEdit) {
      void Promise.all([api.listAudit(), api.listSearchLogs()]).then(([auditResult, searchResult]) => {
        setAuditLogs(auditResult.logs);
        setSearchLogs(searchResult.logs);
      });
    }

    if (tab === "users" && canAdmin) {
      void api.listUsers().then((result) => setUsers(result.users));
    }
  }, [tab, canAdmin, canEdit]);

  function logout() {
    clearToken();
    onLogout();
  }

  async function runSearch() {
    await loadMaterials(search, {
      requesterName: requesterName.trim(),
      requesterRut: requesterRut.trim(),
      track: true
    });
  }

  async function saveMaterial(material: Partial<Material>) {
    setSaving(true);
    setMessage("");
    try {
      const result = await api.saveMaterial(material);
      setSelected(result.material);
      setMessage("Material guardado correctamente. Ya queda disponible para busqueda por codigo o nombre.");
      await loadMaterials(search, { track: false });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    if (!selected || !event.target.files?.[0]) return;
    setMessage("");
    const result = await api.uploadPhoto(selected.id, event.target.files[0]);
    setSelected(result.material);
    await loadMaterials(search, { track: false });
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.[0]) return;
    const result = await api.importMaterials(event.target.files[0]);
    setImportResult(result);
    await loadMaterials(search, { track: false });
  }

  async function exportExcel() {
    await api.downloadExport();
  }

  async function reportError() {
    if (!selected) return;
    const note = window.prompt("Describe brevemente el error detectado en la ficha.");
    if (!note) return;
    await api.reportError(selected.id, note);
    setMessage("Reporte enviado a bodega.");
  }

  async function createUser(formData: FormData) {
    const input = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? "VIEWER") as Role
    };
    await api.createUser(input);
    const result = await api.listUsers();
    setUsers(result.users);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Boxes size={30} />
          <div>
            <strong>Bodega360</strong>
            <span>{roleLabels[user.role]}</span>
          </div>
        </div>

        <nav className="nav-list">
          <button className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}>
            <PackageSearch size={18} /> Buscador
          </button>
          {canEdit ? (
            <>
              <button className={tab === "warehouse" ? "active" : ""} onClick={() => setTab("warehouse")}>
                <Plus size={18} /> Panel bodega
              </button>
              <button className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>
                <AlertTriangle size={18} /> Pendientes
              </button>
              <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
                <History size={18} /> Historial
              </button>
            </>
          ) : null}
          {canAdmin ? (
            <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
              <Shield size={18} /> Usuarios
            </button>
          ) : null}
        </nav>

        <Button variant="ghost" icon={<LogOut size={18} />} onClick={logout}>
          Salir
        </Button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Portal interno</span>
            <h1>{tabTitle(tab)}</h1>
          </div>
          <div className="user-pill">{user.name}</div>
        </header>

        {message ? <div className="toast">{message}</div> : null}

        {tab === "search" ? (
          <section className="split-view">
            <div className="list-pane">
              <form
                className="search-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runSearch();
                }}
              >
                <div className="consultant-grid">
                  <label>
                    Nombre consultante
                    <input value={requesterName} onChange={(event) => setRequesterName(event.target.value)} placeholder="Opcional" />
                  </label>
                  <label>
                    RUT consultante
                    <input value={requesterRut} onChange={(event) => setRequesterRut(event.target.value)} placeholder="Opcional" />
                  </label>
                </div>
                <div className="search-box">
                  <Search size={20} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar codigo, nombre, descripcion, categoria o ubicacion"
                  />
                  <Button icon={<Search size={18} />}>Buscar</Button>
                </div>
              </form>
              <MaterialList materials={materials} selected={selected} onSelect={setSelected} loading={loading} />
            </div>
            <MaterialDetail material={selected} canEdit={canEdit} onReport={reportError} />
          </section>
        ) : null}

        {tab === "warehouse" && canEdit ? (
          <section className="management-grid">
            <div className="panel">
              <div className="panel-heading">
                <h2>{selected ? "Editar material" : "Crear material"}</h2>
                <Button variant="ghost" icon={<Plus size={18} />} onClick={() => setSelected(null)}>
                  Nuevo
                </Button>
              </div>
              <MaterialForm material={selected} onSave={saveMaterial} saving={saving} />
            </div>
            <div className="panel">
              <h2>Fotos e importacion</h2>
              <div className="action-stack">
                <label className={`file-action ${selected ? "" : "disabled"}`}>
                  <Camera size={20} />
                  <span>Subir foto del material</span>
                  <input disabled={!selected} type="file" accept="image/*" capture="environment" onChange={uploadPhoto} />
                </label>
                <label className="file-action">
                  <Upload size={20} />
                  <span>Importar materiales desde Excel</span>
                  <input type="file" accept=".xlsx,.xls" onChange={importExcel} />
                </label>
                <button className="file-action link-action" type="button" onClick={() => void exportExcel()}>
                  <Download size={20} />
                  <span>Exportar respaldo Excel</span>
                </button>
              </div>
              {importResult ? (
                <div className="import-result">
                  <strong>Importacion finalizada</strong>
                  <span>{importResult.created} creados</span>
                  <span>{importResult.updated} actualizados</span>
                  <span>{importResult.errors.length} errores</span>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "pending" && canEdit ? (
          <section className="panel">
            <div className="panel-heading">
              <h2>Registros incompletos</h2>
              <span className="metric">{incompleteMaterials.length}</span>
            </div>
            <MaterialList materials={incompleteMaterials} selected={selected} onSelect={setSelected} loading={loading} />
          </section>
        ) : null}

        {tab === "history" && canEdit ? (
          <section className="management-grid">
            <div className="panel">
              <h2>Consultas registradas</h2>
              <div className="timeline">
                {searchLogs.map((log) => (
                  <article key={log.id} className="timeline-row">
                    <ClipboardList size={18} />
                    <div>
                      <strong>{log.query}</strong>
                      <p>{log.hasResults ? `${log.resultCount} resultado(s)` : "Sin resultado"}</p>
                      <span>
                        {new Date(log.createdAt).toLocaleString("es-CL")} · {log.requesterName || "Sin nombre"} · {log.requesterRut || "Sin RUT"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="panel">
              <h2>Historial de cambios</h2>
              <div className="timeline">
                {auditLogs.map((log) => (
                  <article key={log.id} className="timeline-row">
                    <FileClock size={18} />
                    <div>
                      <strong>{log.action}</strong>
                      <p>{log.note ?? `${log.entity} ${log.entityId ?? ""}`}</p>
                      <span>
                        {new Date(log.createdAt).toLocaleString("es-CL")} · {log.user?.name ?? "Sistema"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "users" && canAdmin ? (
          <section className="management-grid">
            <div className="panel">
              <h2>Crear usuario</h2>
              <form
                className="form-stack"
                action={(formData) => {
                  void createUser(formData);
                }}
              >
                <label>
                  Nombre
                  <input name="name" required />
                </label>
                <label>
                  Correo
                  <input name="email" type="email" required />
                </label>
                <label>
                  Contrasena
                  <input name="password" type="password" minLength={8} required />
                </label>
                <label>
                  Rol
                  <select name="role" defaultValue="VIEWER">
                    <option value="VIEWER">Consulta</option>
                    <option value="WAREHOUSE">Encargado bodega</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
                <Button icon={<UserPlus size={18} />}>Crear usuario</Button>
              </form>
            </div>
            <div className="panel">
              <h2>Usuarios activos</h2>
              <div className="user-list">
                {users.map((item) => (
                  <div key={item.id} className="user-row">
                    <strong>{item.name}</strong>
                    <span>{item.email}</span>
                    <small>{roleLabels[item.role]}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function tabTitle(tab: Tab) {
  const titles: Record<Tab, string> = {
    search: "Buscador de materiales",
    warehouse: "Panel encargado bodega",
    pending: "Pendientes de validacion",
    history: "Auditoria",
    users: "Administracion de usuarios"
  };
  return titles[tab];
}

function MaterialList({
  materials,
  selected,
  onSelect,
  loading
}: {
  materials: Material[];
  selected: Material | null;
  onSelect: (material: Material) => void;
  loading: boolean;
}) {
  if (loading) {
    return <div className="loading-line">Cargando materiales...</div>;
  }

  if (!materials.length) {
    return <EmptyState icon={<FileSpreadsheet size={28} />} title="Sin materiales" text="Importa un Excel o crea el primer registro desde el panel de bodega." />;
  }

  return (
    <div className="material-list">
      {materials.map((material) => (
        <button key={material.id} className={selected?.id === material.id ? "material-row selected" : "material-row"} onClick={() => onSelect(material)}>
          <div>
            <strong>{material.name}</strong>
            <span>{material.code}</span>
          </div>
          <small className={material.incomplete ? "status-warning" : "status-ok"}>{material.incomplete ? "Pendiente" : "Validado"}</small>
        </button>
      ))}
    </div>
  );
}

function MaterialDetail({ material, canEdit, onReport }: { material: Material | null; canEdit: boolean; onReport: () => void }) {
  if (!material) {
    return <EmptyState icon={<PackageSearch size={32} />} title="Selecciona un material" text="La ficha mostrara codigo, ubicacion, stock, costo promedio y foto disponible." />;
  }

  return (
    <section className="detail-pane">
      <div className="photo-frame">
        {material.mainPhotoPath ? <img src={assetUrl(material.mainPhotoPath) ?? ""} alt={material.name} /> : <PackageSearch size={52} />}
      </div>
      <div className="detail-header">
        <div>
          <span className="eyebrow">{material.code}</span>
          <h2>{material.name}</h2>
        </div>
        <span className={material.validated ? "badge ok" : "badge warning"}>{material.validated ? "Validado" : "Pendiente"}</span>
      </div>
      <p className="description">{material.description ?? "Sin descripcion registrada."}</p>

      <div className="fact-grid">
        <Fact label="Categoria" value={material.category} />
        <Fact label="Ubicacion" value={material.location} />
        <Fact label="Stock" value={material.stock?.toLocaleString("es-CL")} />
        <Fact label="Unidad" value={material.unit} />
        <Fact label="Costo promedio" value={material.averageCost ? currencyFormatter.format(material.averageCost) : null} />
        <Fact label="Marca / Modelo" value={[material.brand, material.model].filter(Boolean).join(" / ")} />
        <Fact label="Codigo alternativo" value={material.alternateCode} />
        <Fact label="Actualizado" value={new Date(material.lastUpdatedAt).toLocaleDateString("es-CL")} />
      </div>

      {!canEdit ? (
        <Button variant="ghost" icon={<AlertTriangle size={18} />} onClick={onReport}>
          Reportar error
        </Button>
      ) : null}
    </section>
  );
}

function Fact({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value || "No disponible"}</strong>
    </div>
  );
}
