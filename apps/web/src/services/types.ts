export type Role = "ADMIN" | "WAREHOUSE" | "VIEWER";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active?: boolean;
};

export type MaterialStatus = "ACTIVE" | "INACTIVE" | "OBSOLETE";

export type Material = {
  id: string;
  code: string;
  alternateCode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  unit: string | null;
  stock: number | null;
  averageCost: number | null;
  currency: string | null;
  location: string | null;
  status: MaterialStatus;
  mainPhotoPath: string | null;
  validated: boolean;
  lastUpdatedAt: string;
  incomplete: boolean;
};

export type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  note: string | null;
  createdAt: string;
  user: Pick<User, "name" | "email" | "role"> | null;
};

export type SearchLog = {
  id: string;
  query: string;
  requesterName: string | null;
  requesterRut: string | null;
  resultCount: number;
  hasResults: boolean;
  ipAddress: string | null;
  createdAt: string;
  user: Pick<User, "name" | "email" | "role"> | null;
};

export type ImportResult = {
  created: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
};
