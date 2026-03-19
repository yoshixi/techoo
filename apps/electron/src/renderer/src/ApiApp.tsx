import { useState } from 'react'
import type { JSX } from 'react'
import Versions from './components/Versions'
import HealthCheck from './components/HealthCheck'
import TaskManager from './components/TaskManager'
// import TimerManager from './components/TimerManager'

function ApiIntegratedApp(): JSX.Element {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'timers'>('dashboard')

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: '🏠' },
    { id: 'dashboard' as const, label: 'Dashboard', icon: '🏠' },
    { id: 'tasks' as const, label: 'Tasks', icon: '📋' }
    // { id: 'timers' as const, label: 'Timers', icon: '⏱️' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Techoo - Task Management</h1>
            </div>
            <div className="text-sm text-gray-500">Electron + Hono + SWR Integration</div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <HealthCheck />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">System Information</h3>
                  <Versions />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Timers</h3>
              {/* <TimerManager /> */}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && <TaskManager />}

        {activeTab === 'timers' && <div>Timer Manager</div>}
      </main>
    </div>
  )
}

export default ApiIntegratedApp
