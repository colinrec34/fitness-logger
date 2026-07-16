// Drop-in replacement for the Supabase JS client, backed by the self-hosted
// Express API. It supports exactly the subset the app uses:
//   supabase.from(table).select/insert/upsert + .eq/.gte/.lte/.filter/.order/.limit/.single/.maybeSingle
//   supabase.auth.getSession/getUser/signInWithPassword/signUp/signOut/onAuthStateChange
// The server scopes everything to the JWT user (replacing RLS), and returns rows
// in the same snake_case shape Supabase did, so the rest of the app is unchanged.

const BASE = "/api";

export type User = { id: string; email: string };
export type Session = { user: User; access_token: string };

const TOKEN_KEY = "fl_token";
const USER_KEY = "fl_user";

function loadUser(): User | null {
  try {
    const s = localStorage.getItem(USER_KEY);
    return s ? (JSON.parse(s) as User) : null;
  } catch {
    return null;
  }
}
let currentUser: User | null = loadUser();

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function setAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  currentUser = user;
}
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  currentUser = null;
}

// Error type mirrors what the app reads off Supabase errors: .message and .code.
type ApiError = Error & { code?: string };

async function apiFetch(path: string, opts: RequestInit = {}): Promise<any> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    if (res.status === 401) {
      clearAuth();
      notify("SIGNED_OUT", null);
    }
    const err: ApiError = new Error(body?.error || `Request failed (${res.status})`);
    if (body?.code) err.code = body.code;
    throw err;
  }
  return body;
}

// ── auth state listeners ──────────────────────────────────────────────────────
type AuthCb = (event: string, session: Session | null) => void;
const listeners = new Set<AuthCb>();
function notify(event: string, session: Session | null) {
  listeners.forEach((cb) => {
    try {
      cb(event, session);
    } catch {
      /* ignore listener errors */
    }
  });
}
function sessionFor(user: User | null): Session | null {
  return user ? { user, access_token: getToken() || "" } : null;
}

// ── query builder ─────────────────────────────────────────────────────────────
type Filter = { col: string; op: string; val: any };
type Result = { data: any; error: ApiError | null };

function matchFilter(a: any, op: string, b: any): boolean {
  switch (op) {
    case "eq": return a == b;
    case "neq": return a != b;
    case "gt": return a > b;
    case "gte": return a >= b;
    case "lt": return a < b;
    case "lte": return a <= b;
    default: return true;
  }
}
function cmp(a: any, b: any): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

class QueryBuilder implements PromiseLike<Result> {
  private table: string;
  private op: "select" | "write" = "select";
  private payload: any = null;
  private filters: Filter[] = [];
  private orderBy: { col: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  constructor(table: string) {
    this.table = table;
  }

  select(_cols?: string) { this.op = "select"; return this; }
  insert(obj: any) { this.op = "write"; this.payload = obj; return this; }
  upsert(obj: any, _opts?: any) { this.op = "write"; this.payload = obj; return this; }
  eq(col: string, val: any) { this.filters.push({ col, op: "eq", val }); return this; }
  neq(col: string, val: any) { this.filters.push({ col, op: "neq", val }); return this; }
  gt(col: string, val: any) { this.filters.push({ col, op: "gt", val }); return this; }
  gte(col: string, val: any) { this.filters.push({ col, op: "gte", val }); return this; }
  lt(col: string, val: any) { this.filters.push({ col, op: "lt", val }); return this; }
  lte(col: string, val: any) { this.filters.push({ col, op: "lte", val }); return this; }
  filter(col: string, op: string, val: any) { this.filters.push({ col, op, val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending !== false };
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }

  private eqVal(col: string) {
    return this.filters.find((f) => f.col === col && f.op === "eq")?.val;
  }

  private async run(): Promise<Result> {
    try {
      if (this.op === "write") {
        const data = await apiFetch(`/${this.table}`, {
          method: "POST",
          body: JSON.stringify(this.payload),
        });
        return { data, error: null };
      }
      let path = `/${this.table}`;
      const activityId = this.eqVal("activity_id");
      if (activityId != null) path += `?activity_id=${encodeURIComponent(activityId)}`;
      let rows: any[] = await apiFetch(path);
      if (!Array.isArray(rows)) rows = rows == null ? [] : [rows];
      for (const f of this.filters) rows = rows.filter((r) => matchFilter(r[f.col], f.op, f.val));
      if (this.orderBy) {
        const { col, ascending } = this.orderBy;
        rows = [...rows].sort((a, b) => cmp(a[col], b[col]) * (ascending ? 1 : -1));
      }
      if (this.limitN != null) rows = rows.slice(0, this.limitN);
      return { data: rows, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async single(): Promise<Result> {
    const { data, error } = await this.run();
    if (error) return { data: null, error };
    const arr = Array.isArray(data) ? data : data == null ? [] : [data];
    if (arr.length !== 1) return { data: null, error: new Error("Expected exactly one row") };
    return { data: arr[0], error: null };
  }
  async maybeSingle(): Promise<Result> {
    const { data, error } = await this.run();
    if (error) return { data: null, error };
    const arr = Array.isArray(data) ? data : data == null ? [] : [data];
    if (arr.length > 1) return { data: null, error: new Error("Expected at most one row") };
    return { data: arr[0] ?? null, error: null };
  }
  then<TR1 = Result, TR2 = never>(
    onfulfilled?: ((value: Result) => TR1 | PromiseLike<TR1>) | null,
    onrejected?: ((reason: any) => TR2 | PromiseLike<TR2>) | null
  ): PromiseLike<TR1 | TR2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

// ── the supabase-compatible client ────────────────────────────────────────────
export const supabase = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  auth: {
    async getSession(): Promise<{ data: { session: Session | null }; error: ApiError | null }> {
      if (!getToken()) return { data: { session: null }, error: null };
      try {
        const user: User = await apiFetch("/auth/me");
        currentUser = user;
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        return { data: { session: sessionFor(user) }, error: null };
      } catch {
        clearAuth();
        return { data: { session: null }, error: null };
      }
    },
    async getUser(): Promise<{ data: { user: User | null }; error: ApiError | null }> {
      return { data: { user: currentUser }, error: null };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        const { token, user } = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setAuth(token, user);
        notify("SIGNED_IN", sessionFor(user));
        return { data: { user, session: sessionFor(user) }, error: null };
      } catch (err) {
        return { data: { user: null, session: null }, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    async signUp({ email, password }: { email: string; password: string }) {
      try {
        const { token, user } = await apiFetch("/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setAuth(token, user);
        notify("SIGNED_IN", sessionFor(user));
        return { data: { user, session: sessionFor(user) }, error: null };
      } catch (err) {
        return { data: { user: null, session: null }, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    async signOut() {
      clearAuth();
      notify("SIGNED_OUT", null);
      return { error: null };
    },
    onAuthStateChange(cb: AuthCb) {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => { listeners.delete(cb); } } } };
    },
  },
};
