// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface CustomRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  params?: any;
  data?: any;
  headers?: Record<string, string>;
  responseType?: string;
}

/**
 * Custom HTTP client for Electron renderer process
 * This function will be used by the generated API client
 */
export const customInstance = <T>(config: CustomRequestConfig): Promise<T> => {
  const url = new URL(config.url, API_BASE_URL);
  if (config.params) {
    Object.entries(config.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const requestConfig: RequestInit = {
    method: config.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: config.data ? JSON.stringify(config.data) : undefined,
  };

  return fetch(url.toString(), requestConfig).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }

    return response.text() as any;
  });
};

export default customInstance;
