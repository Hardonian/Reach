'use client';

import { BRAND_NAME } from '@/lib/brand';

export default function ProfilePage() {
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <span>Settings</span>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        <span className="text-white">Profile</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight mb-2">Profile</h1>
      <p className="text-gray-400 max-w-2xl mb-8">
        Manage your {BRAND_NAME} account details and preferences.
      </p>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Personal Information</h2>

        <div className="flex items-center gap-6 mb-6">
          <div className="h-20 w-20 rounded-full bg-accent/30 flex items-center justify-center text-2xl font-bold text-white shrink-0">
            JD
          </div>
          <div>
            <button className="btn-secondary text-sm py-1.5 px-3">Change Avatar</button>
            <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF. Max 2 MB.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">First Name</label>
            <input
              type="text"
              defaultValue="John"
              className="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Last Name</label>
            <input
              type="text"
              defaultValue="Doe"
              className="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <input
              type="email"
              defaultValue="john.doe@acme.corp"
              className="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-1">Organization</label>
            <input
              type="text"
              defaultValue="Acme Corp"
              className="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border flex justify-end">
          <button className="btn-primary text-sm py-2 px-4">Save Changes</button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-500/20">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
        <p className="text-sm text-gray-400 mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button className="text-sm font-medium text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 rounded-lg px-4 py-2 transition-colors">
          Delete Account
        </button>
      </div>
    </>
  );
}
