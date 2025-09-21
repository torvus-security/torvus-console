import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';
import { callReleasesApi } from '../api-client';
import { DecisionControls } from './DecisionControls';

type StaffSummary = {
  user_id: string;
  email: string;
  display_name: string | null;
};

type ReleaseApproval = {
  id: number;
  approver_id: string;
  decision: 'approve' | 'reject';
  reason: string | null;
  created_at: string;
  approver: StaffSummary | null;
};

type ReleaseRequestDetail = {
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

type ReleaseDetailResponse = {
  viewer: {
    user_id: string;
    email: string;
    display_name: string | null;
    roles: string[];
    has_security_admin: boolean;
    has_decided: boolean;
  };
  request: ReleaseRequestDetail;
  approvals: ReleaseApproval[];
};

function formatUtc(timestamp: string | null) {
  if (!timestamp) return '—';
  return new Date(timestamp).toISOString();
}

function sentenceCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type ReleaseDetailPageProps = {
  params: { id: string };
};

export default async function ReleaseDetailPage({ params }: ReleaseDetailPageProps) {
  const id = params.id;
  const { status, data } = await callReleasesApi<ReleaseDetailResponse>(`/api/releases/${id}`);

  if (status === 404) {
    notFound();
  }

  if (status === 401 || status === 403 || !data) {
    return <AccessDeniedNotice />;
  }

  const { request, approvals, viewer } = data;
  const canDecide =
    viewer.has_security_admin
    && request.status === 'pending'
    && viewer.user_id !== request.requested_by
    && !viewer.has_decided;

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">
            <Link href="/releases" className="text-emerald-300 hover:text-emerald-200">
              Releases
            </Link>{' '}
            / {request.title}
          </p>
          <h1 className="text-2xl font-semibold text-white">{request.title}</h1>
        </div>
        <span className={`tag ${request.status}`}>{sentenceCase(request.status)}</span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">Request details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-400">Requested by</dt>
              <dd className="text-white">{request.requested_by_user?.email ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Created at</dt>
              <dd className="text-white">{formatUtc(request.created_at)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Last decision</dt>
              <dd className="text-white">{formatUtc(request.last_decision_at)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Approvals</dt>
              <dd className="text-white">{request.approve_count}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Rejections</dt>
              <dd className="text-white">{request.reject_count}</dd>
            </div>
          </dl>
          <div>
            <h3 className="text-sm font-medium text-slate-200">Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">
              {request.description ? request.description : 'No description provided.'}
            </p>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Approvals</h2>
            <span className="text-sm text-slate-400">{approvals.length} recorded</span>
          </div>

          {approvals.length === 0 && <p className="text-sm text-slate-300">No approvals yet.</p>}

          <ul className="space-y-3">
            {approvals.map((approval) => (
              <li key={approval.id} className="rounded-md border border-slate-700/70 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between text-sm text-white">
                  <span>{approval.approver?.email ?? 'Unknown approver'}</span>
                  <span className={approval.decision === 'approve' ? 'text-emerald-300' : 'text-rose-300'}>
                    {sentenceCase(approval.decision)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{formatUtc(approval.created_at)}</p>
                {approval.reason && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{approval.reason}</p>
                )}
              </li>
            ))}
          </ul>

          {canDecide && <DecisionControls requestId={request.id} />}
        </div>
      </div>
    </div>
  );
}
