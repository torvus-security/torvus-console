import Link from 'next/link';
import { AccessDeniedNotice } from '../../components/AccessDeniedNotice';
import { callReleasesApi } from './api-client';

type StaffSummary = {
  user_id: string;
  email: string;
  display_name: string | null;
};

type ReleaseRequestSummary = {
  id: string;
  title: string;
  description: string | null;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  created_at: string;
  last_decision_at: string | null;
  approve_count: number;
  reject_count: number;
  requested_by_user: StaffSummary | null;
};

type ReleasesResponse = {
  viewer: {
    user_id: string;
    email: string;
    display_name: string | null;
    roles: string[];
  };
  requests: ReleaseRequestSummary[];
};

function formatUtc(timestamp: string) {
  return new Date(timestamp).toISOString();
}

function StatusBadge({ status }: { status: ReleaseRequestSummary['status'] }) {
  const className = `tag ${status}`;
  return <span className={className}>{status}</span>;
}

export default async function ReleasesPage() {
  const { status, data } = await callReleasesApi<ReleasesResponse>('/api/releases');

  if (status === 401 || status === 403 || !data) {
    return <AccessDeniedNotice />;
  }

  const { requests } = data;

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Release requests</h1>
        <Link
          href="/releases/new"
          className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400"
        >
          New release
        </Link>
      </div>

      <div className="panel" aria-labelledby="release-requests-heading">
        <div className="panel__header">
          <h2 id="release-requests-heading">Recent requests</h2>
          <span className="tag subtle">Latest 100</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Approvals</th>
                <th scope="col">Rejects</th>
                <th scope="col">Requested by</th>
                <th scope="col">Created at</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No release requests yet. Start by creating one.
                  </td>
                </tr>
              )}
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Link
                      href={`/releases/${request.id}`}
                      className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
                    >
                      {request.title}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge status={request.status} />
                  </td>
                  <td>{request.approve_count}</td>
                  <td>{request.reject_count}</td>
                  <td>{request.requested_by_user?.email ?? 'Unknown'}</td>
                  <td>{formatUtc(request.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
