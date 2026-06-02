import type { AuditLog, ImportResult, Material, Role, SearchLog, User } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "bodega360.token";

type RequestOptions = RequestInit & {
  auth?: boolean;
};

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function assetUrl(path: string | null) {
  if (!path) return null;
  return `${API_URL}${path}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth ?? true) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Error de comunicacion." }));
    throw new Error(error.message ?? "Error de comunicacion.");
  }

  return response.json() as Promise<T>;
}

export const api = {
  async login(identifier: string, password: string) {
    return request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
      auth: false
    });
  },

  async me() {
    return request<{ user: User | null }>("/api/auth/me");
  },

  async listMaterials(
    search = "",
    incomplete = false,
    options: { requesterName?: string; requesterRut?: string; track?: boolean } = {}
  ) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (incomplete) params.set("incomplete", "true");
    if (options.requesterName) params.set("requesterName", options.requesterName);
    if (options.requesterRut) params.set("requesterRut", options.requesterRut);
    if (options.track === false) params.set("track", "false");
    return request<{ materials: Material[] }>(`/api/materials?${params.toString()}`);
  },

  async saveMaterial(material: Partial<Material>) {
    const body = JSON.stringify(material);
    if (material.id) {
      return request<{ material: Material }>(`/api/materials/${material.id}`, { method: "PUT", body });
    }
    return request<{ material: Material }>("/api/materials", { method: "POST", body });
  },

  async uploadPhoto(materialId: string, file: File) {
    const body = new FormData();
    body.append("photo", file);
    return request<{ material: Material }>(`/api/materials/${materialId}/photo`, { method: "POST", body });
  },

  async reportError(materialId: string, note: string) {
    return request<{ message: string }>(`/api/materials/${materialId}/report-error`, {
      method: "POST",
      body: JSON.stringify({ note })
    });
  },

  async importMaterials(file: File): Promise<ImportResult> {
    const body = new FormData();
    body.append("file", file);
    return request<ImportResult>("/api/import/materials", { method: "POST", body });
  },

  async downloadExport() {
    const token = getToken();
    const response = await fetch(`${API_URL}/api/export/materials.xlsx`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      throw new Error("No fue posible exportar el respaldo.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bodega360-materiales.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
  },

  async listAudit() {
    return request<{ logs: AuditLog[] }>("/api/audit");
  },

  async listSearchLogs() {
    return request<{ logs: SearchLog[] }>("/api/search-logs");
  },

  async listUsers() {
    return request<{ users: User[] }>("/api/users");
  },

  async createUser(input: { name: string; email: string; password: string; role: Role }) {
    return request<{ user: User }>("/api/users", { method: "POST", body: JSON.stringify(input) });
  }
};
