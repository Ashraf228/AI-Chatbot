export async function dashboardFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error(`Dashboard API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
