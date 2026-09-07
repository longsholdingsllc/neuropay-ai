const API_BASE = (import.meta as any).env?.VITE_API_URL || "";
export const getToken = () => localStorage.getItem("np_token");
export const setToken = (t: string | null) => t ? localStorage.setItem("np_token", t) : localStorage.removeItem("np_token");

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any).error || `Request failed (${res.status})`);
  return json as T;
}
export const apiGet = <T = any>(path: string): Promise<T> =>
  fetch(`${API_BASE}/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then((r) => handle<T>(r));
export const apiSend = <T = any>(method: "POST" | "PUT" | "DELETE", path: string, body?: any): Promise<T> =>
  fetch(`${API_BASE}/api${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }, body: body ? JSON.stringify(body) : undefined }).then((r) => handle<T>(r));
export const login = async (email: string, password: string) => {
  const res = await fetch(`${API_BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  return handle<{ token: string; user: any }>(res);
};
