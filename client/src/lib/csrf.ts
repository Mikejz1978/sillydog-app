let csrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  const response = await fetch("/api/csrf-token", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch CSRF token");
  }
  
  const data = await response.json();
  csrfToken = data.csrfToken;
  
  if (!csrfToken) {
    throw new Error("CSRF token is empty");
  }
  
  return csrfToken;
}

export function clearCsrfToken() {
  csrfToken = null;
}

export async function apiRequestWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getCsrfToken();
  
  const headers = new Headers(options.headers);
  headers.set("X-CSRF-Token", token);
  headers.set("Content-Type", "application/json");
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
  
  // If we get a 403 (invalid CSRF token), clear token and retry once
  if (response.status === 403) {
    clearCsrfToken();
    const newToken = await getCsrfToken();
    headers.set("X-CSRF-Token", newToken);
    
    return fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
  }
  
  return response;
}
