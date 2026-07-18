import Constants from 'expo-constants'

function getApiBaseUrl(): string {
  const envUrl = Constants.expoConfig?.extra?.apiUrl
  if (envUrl) return envUrl
  return 'http://localhost:8787'
}

export const API_BASE_URL = getApiBaseUrl()
