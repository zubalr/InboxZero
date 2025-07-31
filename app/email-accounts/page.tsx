'use client';

import { EmailAccountManager } from '@/app/components/common/EmailAccountManager';
import { EmailSyncManager } from '@/app/components/common/EmailSyncManager';
import { AuthGuard } from '@/app/components/auth/AuthGuard';
import { useState } from 'react';

export default function EmailAccountsPage() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'sync'>('accounts');

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                Email Management
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Connect and manage your Gmail and Outlook accounts for seamless
                email management with real-time synchronization.
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="mb-6">
              <nav className="flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('accounts')}
                  className={`${
                    activeTab === 'accounts'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                >
                  Account Management
                </button>
                <button
                  onClick={() => setActiveTab('sync')}
                  className={`${
                    activeTab === 'sync'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                >
                  Synchronization
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'accounts' && <EmailAccountManager />}
            {activeTab === 'sync' && <EmailSyncManager />}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
