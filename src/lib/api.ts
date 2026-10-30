/**
 * Central API Client for MyShift
 * Automatically handles credentials, Bearer tokens, and iframe session persistence.
 */

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem('hospitalist_token') || sessionStorage.getItem('hospitalist_token');
  } catch (e) {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem('hospitalist_token', token);
      sessionStorage.setItem('hospitalist_token', token);
    } else {
      localStorage.removeItem('hospitalist_token');
      sessionStorage.removeItem('hospitalist_token');
    }
  } catch (e) {}
}

export function getStoredUser(): any | null {
  try {
    const raw = localStorage.getItem('hospitalist_user') || sessionStorage.getItem('hospitalist_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredUser(user: any | null): void {
  try {
    if (user) {
      localStorage.setItem('hospitalist_user', JSON.stringify(user));
      sessionStorage.setItem('hospitalist_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('hospitalist_user');
      sessionStorage.removeItem('hospitalist_user');
    }
  } catch (e) {}
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const user = getStoredUser();

  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-auth-token'] = token;
  }

  if (user && user.email) {
    headers['x-user-email'] = user.email;
  }

  return fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });
}
