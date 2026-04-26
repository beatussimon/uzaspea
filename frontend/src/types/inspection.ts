export interface InspectionCategory {
  id: number;
  name: string;
  slug: string;
  level: 'domain' | 'category' | 'subcategory' | 'item_type';
  parent: number | null;
  description: string;
  base_price: string;
  required_inspector_level: 'junior' | 'senior' | 'specialist';
  is_active: boolean;
  children: InspectionCategory[];
  full_path: string;
}

export interface ChecklistItem {
  id: number;
  label: string;
  item_type: 'pass_fail' | 'scale' | 'measurement' | 'text' | 'media';
  is_mandatory: boolean;
  order: number;
  fail_triggers_flag: boolean;
  unit: string;
  help_text: string;
}

export interface ChecklistTemplate {
  id: number;
  category: number;
  category_name: string;
  version: number;
  is_active: boolean;
  items: ChecklistItem[];
}

export interface InspectorProfile {
  id: number;
  user: number;
  username: string;
  full_name: string;
  level: 'junior' | 'senior' | 'specialist';
  certified_categories: InspectionCategory[];
  is_available: boolean;
  performance_score: string;
  total_inspections: number;
  total_flags: number;
  phone_number: string;
}

export interface InspectionBill {
  id: number;
  base_rate: string;
  scope_multiplier: string;
  turnaround_surcharge: string;
  complexity_surcharge: string;
  travel_surcharge: string;
  inspector_level_surcharge: string;
  reinspection_coverage_fee: string;
  total_amount: string;
  deposit_amount: string;
  remaining_balance: string;
  currency: string;
}

export interface InspectionPayment {
  id: number;
  request: number;
  stage: 'deposit' | 'balance';
  amount: string;
  proof_image: string | null;
  transaction_reference: string;
  status: 'pending' | 'approved' | 'rejected';
  confirmed_by_username: string | null;
  rejection_reason: string;
  created_at: string;
}

export interface InspectionAssignment {
  id: number;
  inspector: number;
  inspector_name: string;
  inspector_level: string;
  sla_deadline: string;
  assigned_at: string;
}

export interface ChecklistResponse {
  id: number;
  checklist_item: number;
  item_label: string;
  item_type: string;
  response_value: string;
  flagged: boolean;
  notes: string;
}

export interface InspectionReport {
  id: number;
  verdict: 'pass' | 'conditional' | 'fail';
  summary: string;
  is_locked: boolean;
  report_hash: string;
  submitted_by_username: string;
  submitted_at: string;
  approved_by_username: string | null;
  approved_at: string | null;
  qa_notes: string;
  responses: ChecklistResponse[];
}

export interface InspectionRequest {
  id: number;
  inspection_id: string;
  client: number;
  client_username: string;
  category: number;
  category_name: string;
  category_path: string;
  item_name: string;
  item_description: string;
  item_address: string;
  item_age_years: number | null;
  is_complex: boolean;
  scope: 'basic' | 'standard' | 'deep';
  turnaround: 'standard' | 'express' | 'instant';
  status: string;
  pre_inspection_notes: string;
  reinspection_coverage: boolean;
  created_at: string;
  bill: InspectionBill | null;
  assignment: InspectionAssignment | null;
  report: InspectionReport | null;
  payments: InspectionPayment[];
}

export interface InspectionNotification {
  id: number;
  notification_type: string;
  message: string;
  related_request: number | null;
  request_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface FraudFlag {
  id: number;
  request: number;
  request_id: string;
  flag_type: string;
  details: string;
  resolved: boolean;
  created_at: string;
}

export const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  bill_sent: 'Bill Sent',
  deposit_paid: 'Deposit Paid',
  pre_inspection: 'Pre-Inspection',
  assigned: 'Inspector Assigned',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  qa_review: 'QA Review',
  published: 'Report Ready',
  cancelled: 'Cancelled',
  blocked: 'Blocked',
  rescheduled: 'Rescheduled',
};

export const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  bill_sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  deposit_paid: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  pre_inspection: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  assigned: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  submitted: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  qa_review: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  blocked: 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  rescheduled: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export const VERDICT_COLORS: Record<string, string> = {
  pass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  conditional: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  fail: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export const fmtMoney = (amount: string | number, currency = 'TZS') =>
  `${currency} ${Number(amount).toLocaleString()}`;
