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
