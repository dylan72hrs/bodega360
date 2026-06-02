import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "../components/Button";
import type { Material } from "../services/types";

const blankMaterial: Partial<Material> = {
  code: "",
  alternateCode: "",
  name: "",
  description: "",
  category: "",
  brand: "",
  model: "",
  unit: "",
  stock: null,
  averageCost: null,
  currency: "CLP",
  location: "",
  status: "ACTIVE",
  validated: false
};

export function MaterialForm({
  material,
  onSave,
  saving
}: {
  material: Material | null;
  onSave: (material: Partial<Material>) => Promise<void>;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<Partial<Material>>(blankMaterial);

  useEffect(() => {
    setDraft(material ?? blankMaterial);
  }, [material]);

  function update<K extends keyof Material>(field: K, value: Material[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSave(draft);
    if (!draft.id) setDraft(blankMaterial);
  }

  return (
    <form className="material-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Codigo
          <input value={draft.code ?? ""} onChange={(event) => update("code", event.target.value)} required />
        </label>
        <label>
          Codigo alternativo
          <input value={draft.alternateCode ?? ""} onChange={(event) => update("alternateCode", event.target.value)} />
        </label>
        <label>
          Nombre
          <input value={draft.name ?? ""} onChange={(event) => update("name", event.target.value)} required />
        </label>
        <label>
          Categoria
          <input value={draft.category ?? ""} onChange={(event) => update("category", event.target.value)} />
        </label>
        <label>
          Marca
          <input value={draft.brand ?? ""} onChange={(event) => update("brand", event.target.value)} />
        </label>
        <label>
          Modelo
          <input value={draft.model ?? ""} onChange={(event) => update("model", event.target.value)} />
        </label>
        <label>
          Unidad
          <input value={draft.unit ?? ""} onChange={(event) => update("unit", event.target.value)} />
        </label>
        <label>
          Ubicacion
          <input value={draft.location ?? ""} onChange={(event) => update("location", event.target.value)} />
        </label>
        <label>
          Stock
          <input
            value={draft.stock ?? ""}
            onChange={(event) => update("stock", event.target.value === "" ? null : Number(event.target.value))}
            type="number"
            step="0.001"
          />
        </label>
        <label>
          Costo promedio
          <input
            value={draft.averageCost ?? ""}
            onChange={(event) => update("averageCost", event.target.value === "" ? null : Number(event.target.value))}
            type="number"
            step="0.01"
          />
        </label>
        <label>
          Moneda
          <input value={draft.currency ?? "CLP"} onChange={(event) => update("currency", event.target.value)} />
        </label>
        <label>
          Estado
          <select value={draft.status ?? "ACTIVE"} onChange={(event) => update("status", event.target.value as Material["status"])}>
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
            <option value="OBSOLETE">Obsoleto</option>
          </select>
        </label>
      </div>

      <label>
        Descripcion
        <textarea value={draft.description ?? ""} onChange={(event) => update("description", event.target.value)} rows={3} />
      </label>

      <label className="check-row">
        <input checked={Boolean(draft.validated)} onChange={(event) => update("validated", event.target.checked)} type="checkbox" />
        Informacion validada
      </label>

      <Button icon={<Save size={18} />} disabled={saving}>
        {saving ? "Guardando..." : material ? "Guardar cambios" : "Crear material"}
      </Button>
    </form>
  );
}
