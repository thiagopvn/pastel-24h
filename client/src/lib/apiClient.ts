// Centralized API client with credentials included for all requests
export async function apiClient<T = any>(
  url: string, 
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    // IMPORTANT: Always include credentials to send session cookies
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    // Special handling for 401 Unauthorized
    if (response.status === 401) {
      // You could redirect to login here if needed
      throw new Error('Unauthorized - Please login again');
    }
    
    // Try to get error message from response body
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If response body is not JSON, use default message
    }
    
    throw new Error(errorMessage);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Helper functions for common HTTP methods
export const api = {
  get: <T = any>(url: string, options?: RequestInit) => 
    apiClient<T>(url, { ...options, method: 'GET' }),
  
  post: <T = any>(url: string, data?: any, options?: RequestInit) => 
    apiClient<T>(url, { 
      ...options, 
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    }),
  
  put: <T = any>(url: string, data?: any, options?: RequestInit) => 
    apiClient<T>(url, { 
      ...options, 
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    }),
  
  delete: <T = any>(url: string, options?: RequestInit) => 
    apiClient<T>(url, { ...options, method: 'DELETE' }),
  
  patch: <T = any>(url: string, data?: any, options?: RequestInit) => 
    apiClient<T>(url, { 
      ...options, 
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    }),
};