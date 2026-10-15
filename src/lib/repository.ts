import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { defaultSteps } from "@/lib/types";
import type { BuildDefaults, DatabaseShape, Project, ReferenceStore, StoreConnection, ThemeProfile, User } from "@/lib/types";

const root = path.join(process.cwd(), "data");
const dbPath = path.join(root, "storeforge.json");

const defaultBuildSettings: BuildDefaults = {
  defaultCurrency: "USD",
  defaultMarkupMultiplier: 2.5,
  defaultCompareAtMultiplier: 1.6,
  enableBundleRecommendations: false,
  publishProductDuringBuild: false,
  shippingPromise: "",
  returnPolicySummary: "",
  supportEmail: "",
  claimGuardrails: "Never invent shipping times, guarantees, review counts, certifications, medical outcomes, or universal product performance.",
  useReferenceBrain: true,
  autoDiscoverReferences: true,
  referenceCountPerBuild: 6,
  enableConversionOpportunityScan: true,
  enableVisualQa: true,
  autoApplyVisualQaFixes: true,
  visualQaTargetScore: 90,
  visualQaMaxPasses: 4,
  autoDiscoverTikTokVideos: true,
  autoTikTokVideoCount: 5,
  autoDiscoverProductImages: true,
  autoProductImageCount: 6,
  allowRehostDiscoveredVideos: false,
};

const owner: User = {
  id: "owner-local",
  email: "owner@storeforge.local",
  name: "StoreForge Owner",
  role: "owner",
  createdAt: new Date().toISOString(),
};

async function ensureDb() {
  await fs.mkdir(root, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    const db: DatabaseShape = { users: [owner], stores: [], themeProfiles: [], projects: [], referenceStores: [], buildDefaults: defaultBuildSettings };
    await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
  }
}

async function readDb(): Promise<DatabaseShape> {
  await ensureDb();
  const db = JSON.parse(await fs.readFile(dbPath, "utf8")) as Partial<DatabaseShape>;
  const normalized: DatabaseShape = {
    users: Array.isArray(db.users) && db.users.length ? db.users : [owner],
    stores: Array.isArray(db.stores) ? db.stores : [],
    themeProfiles: Array.isArray(db.themeProfiles) ? db.themeProfiles : [],
    projects: Array.isArray(db.projects) ? db.projects.map((project) => { const existing = new Map((project.steps || []).map((step) => [step.key, step])); return { ...project, steps: defaultSteps().map((step) => existing.get(step.key) || step) }; }) : [],
    referenceStores: Array.isArray(db.referenceStores) ? db.referenceStores : [],
    buildDefaults: { ...defaultBuildSettings, ...(db.buildDefaults || {}) },
  };
  return normalized;
}

async function writeDb(db: DatabaseShape) {
  await ensureDb();
  const temp = `${dbPath}.tmp`;
  await fs.writeFile(temp, JSON.stringify(db, null, 2));
  await fs.rename(temp, dbPath);
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return value.trim();
  }
}

export const repo = {
  async owner() {
    const db = await readDb();
    return db.users[0] || owner;
  },
  async listProjects(ownerId = "owner-local") {
    const db = await readDb();
    return db.projects.filter((p) => p.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getProject(id: string) {
    const db = await readDb();
    return db.projects.find((p) => p.id === id) || null;
  },
  async createProject(project: Omit<Project, "id" | "createdAt" | "updatedAt">) {
    const db = await readDb();
    const now = new Date().toISOString();
    const record: Project = { ...project, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    db.projects.push(record);
    await writeDb(db);
    return record;
  },
  async updateProject(id: string, updater: (project: Project) => Project | void) {
    const db = await readDb();
    const index = db.projects.findIndex((p) => p.id === id);
    if (index < 0) throw new Error("Project not found");
    const clone = structuredClone(db.projects[index]);
    const result = updater(clone) || clone;
    result.updatedAt = new Date().toISOString();
    db.projects[index] = result;
    await writeDb(db);
    return result;
  },
  async listStores(ownerId = "owner-local") {
    const db = await readDb();
    return db.stores.filter((s) => s.ownerId === ownerId).map((s) => ({ ...s, encryptedAccessToken: "••••••••" }));
  },
  async getStore(id: string) {
    const db = await readDb();
    return db.stores.find((s) => s.id === id) || null;
  },
  async getStoreByShop(shop: string) {
    const db = await readDb();
    return db.stores.find((s) => s.shop === shop) || null;
  },
  async upsertStore(input: Omit<StoreConnection, "id" | "createdAt" | "updatedAt">) {
    const db = await readDb();
    const now = new Date().toISOString();
    const current = db.stores.find((s) => s.shop === input.shop && s.ownerId === input.ownerId);
    if (current) {
      Object.assign(current, input, { updatedAt: now });
      await writeDb(db);
      return current;
    }
    const record: StoreConnection = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    db.stores.push(record);
    await writeDb(db);
    return record;
  },
  async getBuildDefaults() {
    const db = await readDb();
    return { ...defaultBuildSettings, ...(db.buildDefaults || {}) };
  },
  async saveBuildDefaults(input: Partial<BuildDefaults>) {
    const db = await readDb();
    db.buildDefaults = { ...defaultBuildSettings, ...(db.buildDefaults || {}), ...input };
    await writeDb(db);
    return db.buildDefaults;
  },
  async listThemeProfiles(ownerId = "owner-local") {
    const db = await readDb();
    return db.themeProfiles.filter((t) => t.ownerId === ownerId);
  },
  async saveThemeProfile(input: Omit<ThemeProfile, "id" | "createdAt">) {
    const db = await readDb();
    const record: ThemeProfile = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    db.themeProfiles.push(record);
    await writeDb(db);
    return record;
  },
  async listReferences(ownerId = "owner-local") {
    const db = await readDb();
    return db.referenceStores.filter((r) => r.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getReference(id: string) {
    const db = await readDb();
    return db.referenceStores.find((r) => r.id === id) || null;
  },
  async getReferenceByUrl(url: string, ownerId = "owner-local") {
    const db = await readDb();
    const normalized = normalizeUrl(url);
    return db.referenceStores.find((r) => r.ownerId === ownerId && normalizeUrl(r.url) === normalized) || null;
  },
  async upsertReference(input: Omit<ReferenceStore, "id" | "createdAt" | "updatedAt">) {
    const db = await readDb();
    const now = new Date().toISOString();
    const normalized = normalizeUrl(input.url);
    const current = db.referenceStores.find((r) => r.ownerId === input.ownerId && normalizeUrl(r.url) === normalized);
    if (current) {
      Object.assign(current, input, { url: normalized, updatedAt: now });
      await writeDb(db);
      return current;
    }
    const record: ReferenceStore = { ...input, url: normalized, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    db.referenceStores.push(record);
    await writeDb(db);
    return record;
  },
  async updateReference(id: string, updater: (reference: ReferenceStore) => ReferenceStore | void) {
    const db = await readDb();
    const index = db.referenceStores.findIndex((r) => r.id === id);
    if (index < 0) throw new Error("Reference not found");
    const clone = structuredClone(db.referenceStores[index]);
    const result = updater(clone) || clone;
    result.updatedAt = new Date().toISOString();
    db.referenceStores[index] = result;
    await writeDb(db);
    return result;
  },
  async deleteReference(id: string) {
    const db = await readDb();
    const before = db.referenceStores.length;
    db.referenceStores = db.referenceStores.filter((r) => r.id !== id);
    if (db.referenceStores.length === before) return false;
    await writeDb(db);
    return true;
  },
};

export async function projectDir(projectId: string) {
  const dir = path.join(root, "projects", projectId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
