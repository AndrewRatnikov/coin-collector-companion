import { RequireAuth } from '@/components/auth/require-auth';

export default function DashboardPage() {
  return (
    <RequireAuth>
      <main data-testid="dashboard-page" className="flex flex-1 flex-col p-8">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-600">Your sets will show up here soon.</p>
      </main>
    </RequireAuth>
  );
}
