import React from 'react'
import { useGetApiHealth } from '../gen/api'

/**
 * Health Check Component
 * Demonstrates basic API integration using SWR with fetch API
 */
export const HealthCheck: React.FC = () => {
  const { data, error, isLoading } = useGetApiHealth()

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return (
      <div className="p-4 border rounded-lg bg-red-50 border-red-200">
        <h3 className="text-red-800 font-semibold mb-2">API Connection Failed</h3>
        <p className="text-red-600 text-sm">
          Unable to connect to the API. Please make sure the server is running.
        </p>
        <p className="text-red-500 text-xs mt-1">Error: {errorMessage}</p>
        <div className="text-xs text-red-400 mt-2">
          💡 Using fetch API instead of axios for better Electron compatibility
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg bg-green-100 border-green-300">
      <h3 className="text-green-900 font-semibold mb-2">🟢 API Status</h3>
      <div className="text-sm text-green-800">
        <p>
          <strong>Status:</strong> {data?.status}
        </p>
        <p>
          <strong>Message:</strong> {data?.message}
        </p>
        <p>
          <strong>Timestamp:</strong>{' '}
          {data?.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}
        </p>
      </div>
      <div className="text-xs text-green-700 mt-2">✨ Powered by fetch API + SWR</div>
    </div>
  )
}

export default HealthCheck
