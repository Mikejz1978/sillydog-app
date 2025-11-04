import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCsrfToken, clearCsrfToken } from "./csrf";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add CSRF token for state-changing methods
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
    try {
      const token = await getCsrfToken();
      headers["X-CSRF-Token"] = token;
    } catch (error) {
      console.error("Failed to get CSRF token:", error);
      throw error;
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // If we get a 403 (invalid CSRF token), clear token and retry once
  if (res.status === 403 && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
    clearCsrfToken();
    const newToken = await getCsrfToken();
    headers["X-CSRF-Token"] = newToken;
    
    const retryRes = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    
    await throwIfResNotOk(retryRes);
    return retryRes;
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
