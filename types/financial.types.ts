// ============================================================================
// FINANCIAL MANAGEMENT TYPES
// ============================================================================

// Enums
export type PaymentType = 'contribution' | 'fee' | 'fine' | 'deposit' | 'refund';
export type ContributionStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'cancelled';
export type FeeType = 'one_time' | 'fine' | 'special' | 'deposit' | 'utility';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'check' | 'card' | 'mobile_money';
export type PaymentStatus = 'pending' | 'verified' | 'rejected' | 'cancelled';
export type ExpenseStatus = 'draft' | 'approved' | 'paid' | 'cancelled';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';
export type PeriodType = 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

// ============================================================================
// CONTRIBUTION PLAN TYPES
// ============================================================================

export interface ContributionPlan {
  id: number;
  residence_id: number;
  plan_name: string;
  description?: string;
  amount_per_period: number;
  period_type: PeriodType;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  applies_to_all_apartments: boolean;
  auto_generate: boolean;
  generation_day: number;
  due_day: number;
  late_fee_enabled: boolean;
  late_fee_amount: number;
  late_fee_days_after: number;
  reminder_enabled: boolean;
  reminder_days_before: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateContributionPlanDTO {
  residence_id: number;
  plan_name: string;
  description?: string;
  amount_per_period: number;
  period_type: PeriodType;
  start_date: string;
  end_date?: string;
  applies_to_all_apartments?: boolean;
  auto_generate?: boolean;
  generation_day?: number;
  due_day?: number;
  late_fee_enabled?: boolean;
  late_fee_amount?: number;
  late_fee_days_after?: number;
  reminder_enabled?: boolean;
  reminder_days_before?: number;
}

export interface UpdateContributionPlanDTO extends Partial<CreateContributionPlanDTO> {
  is_active?: boolean;
}

export interface ContributionPlanApartment {
  id: number;
  contribution_plan_id: number;
  apartment_number: string;
  custom_amount: number;
  notes?: string;
  created_at: string;
}

// ============================================================================
// CONTRIBUTION TYPES
// ============================================================================

export interface Contribution {
  id: number;
  residence_id: number;
  profile_residence_id: number;
  contribution_plan_id?: number;
  apartment_number: string;
  period_start: string;
  period_end: string;
  amount_due: number;
  amount_paid: number;
  late_fee_applied: number;
  status: ContributionStatus;
  due_date: string;
  paid_date?: string;
  is_historical: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  resident_name?: string;
  resident_id?: string;
}

export interface CreateContributionDTO {
  residence_id: number;
  profile_residence_id: number;
  contribution_plan_id?: number;
  apartment_number: string;
  period_start: string;
  period_end: string;
  amount_due: number;
  due_date: string;
  is_historical?: boolean;
  notes?: string;
}

export interface UpdateContributionDTO {
  amount_due?: number;
  amount_paid?: number;
  status?: ContributionStatus;
  due_date?: string;
  notes?: string;
}

export interface ContributionStatusMatrix {
  apartment_number: string;
  resident_name: string;
  resident_id: string;
  months: Record<string, ContributionStatus | null>;
  outstanding_months: number;
  total_due: number;
  total_paid: number;
}

export interface ContributionFilters {
  residence_id: number;
  apartment_number?: string;
  status?: ContributionStatus;
  year?: number;
  month?: number;
  is_historical?: boolean;
}

// ============================================================================
// FEE TYPES
// ============================================================================

export interface Fee {
  id: number;
  residence_id: number;
  profile_residence_id?: number;
  user_id: string;
  apartment_number?: string;
  title: string;
  description?: string;
  fee_type: FeeType;
  amount: number;
  due_date: string;
  status: 'unpaid' | 'paid' | 'cancelled';
  paid_date?: string;
  reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  resident_name?: string;
}

export interface CreateFeeDTO {
  residence_id: number;
  user_id: string;
  profile_residence_id?: number;
  apartment_number?: string;
  title: string;
  description?: string;
  fee_type?: FeeType;
  amount: number;
  due_date: string;
  reason?: string;
}

export interface UpdateFeeDTO extends Partial<CreateFeeDTO> {
  status?: 'unpaid' | 'paid' | 'cancelled';
  paid_date?: string;
}

export interface BulkFeeDTO {
  residence_id: number;
  apartment_numbers: string[];
  title: string;
  description?: string;
  fee_type?: FeeType;
  amount: number;
  due_date: string;
  reason?: string;
}

export interface FeeFilters {
  residence_id: number;
  apartment_number?: string;
  user_id?: string;
  status?: 'unpaid' | 'paid' | 'cancelled';
  fee_type?: FeeType;
}

// ============================================================================
// PAYMENT TYPES
// ============================================================================

export interface Payment {
  id: number;
  residence_id: number;
  user_id: string;
  profile_residence_id?: number;
  apartment_number?: string;
  payment_type: PaymentType;
  contribution_id?: number;
  fee_id?: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  proof_url?: string;
  reference_number?: string;
  bank_reference?: string;
  verified_by?: string;
  verified_at?: string;
  rejection_reason?: string;
  notes?: string;
  paid_at: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  resident_name?: string;
  verifier_name?: string;
}

export interface SubmitPaymentDTO {
  residence_id: number;
  user_id: string;
  profile_residence_id?: number;
  apartment_number?: string;
  payment_type: PaymentType;
  contribution_id?: number;
  fee_id?: number;
  amount: number;
  method: PaymentMethod;
  proof_url?: string;
  reference_number?: string;
  bank_reference?: string;
  notes?: string;
}

export interface BulkPaymentDTO {
  residence_id: number;
  payments: SubmitPaymentDTO[];
}

export interface VerifyPaymentDTO {
  verified_by: string;
}

export interface RejectPaymentDTO {
  rejected_by: string;
  rejection_reason: string;
}

export interface PaymentFilters {
  residence_id: number;
  user_id?: string;
  apartment_number?: string;
  payment_type?: PaymentType;
  status?: PaymentStatus;
  method?: PaymentMethod;
  start_date?: string;
  end_date?: string;
}

// ============================================================================
// EXPENSE TYPES
// ============================================================================

export interface ExpenseCategory {
  id: number;
  residence_id: number;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateExpenseCategoryDTO {
  residence_id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  display_order?: number;
}

export interface UpdateExpenseCategoryDTO extends Partial<CreateExpenseCategoryDTO> {
  is_active?: boolean;
}

export interface Expense {
  id: number;
  residence_id: number;
  category_id?: number;
  title: string;
  description: string;
  amount: number;
  expense_date: string;
  vendor_name?: string;
  vendor_contact?: string;
  invoice_number?: string;
  payment_method?: string;
  payment_reference?: string;
  attachment_url?: string;
  receipt_url?: string;
  status: ExpenseStatus;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  category_name?: string;
  category_color?: string;
  approver_name?: string;
  creator_name?: string;
}

export interface CreateExpenseDTO {
  residence_id: number;
  category_id?: number;
  title: string;
  description: string;
  amount: number;
  expense_date: string;
  vendor_name?: string;
  vendor_contact?: string;
  invoice_number?: string;
  payment_method?: string;
  payment_reference?: string;
  attachment_url?: string;
  receipt_url?: string;
  notes?: string;
}

export interface UpdateExpenseDTO extends Partial<CreateExpenseDTO> {
  status?: ExpenseStatus;
}

export interface ApproveExpenseDTO {
  approved_by: string;
}

export interface RejectExpenseDTO {
  rejected_by: string;
  rejection_reason: string;
}

export interface ExpensePaymentDTO {
  payment_method: string;
  payment_reference?: string;
  receipt_url?: string;
}

export interface ExpenseFilters {
  residence_id: number;
  category_id?: number;
  status?: ExpenseStatus;
  start_date?: string;
  end_date?: string;
  created_by?: string;
}

// ============================================================================
// REPORTING TYPES
// ============================================================================

export interface BalanceSnapshot {
  id: number;
  residence_id: number;
  snapshot_date: string;
  cash_balance: number;
  bank_balance: number;
  total_balance: number;
  period_start: string;
  period_end: string;
  total_contributions_collected: number;
  total_fees_collected: number;
  total_expenses: number;
  net_change: number;
  outstanding_contributions: number;
  outstanding_fees: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionHistory {
  id: number;
  residence_id: number;
  transaction_type: TransactionType;
  transaction_date: string;
  reference_id?: number;
  reference_table?: string;
  amount: number;
  balance_before?: number;
  balance_after?: number;
  account_type?: 'cash' | 'bank' | 'both';
  method?: string;
  description: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface MonthlyReport {
  residence_id: number;
  year: number;
  month: number;
  opening_balance: number;
  closing_balance: number;
  total_income: number;
  total_expenses: number;
  net_change: number;
  contributions_collected: number;
  fees_collected: number;
  outstanding_contributions: number;
  outstanding_fees: number;
  expense_breakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

export interface AnnualReport {
  residence_id: number;
  year: number;
  opening_balance: number;
  closing_balance: number;
  total_income: number;
  total_expenses: number;
  net_change: number;
  monthly_breakdown: MonthlyReport[];
  expense_by_category: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

export interface CashFlowReport {
  residence_id: number;
  start_date: string;
  end_date: string;
  opening_balance: number;
  closing_balance: number;
  cash_inflows: Array<{
    date: string;
    description: string;
    amount: number;
    type: string;
  }>;
  cash_outflows: Array<{
    date: string;
    description: string;
    amount: number;
    type: string;
  }>;
  net_cash_flow: number;
}

export interface ContributionAnalytics {
  residence_id: number;
  year: number;
  total_apartments: number;
  total_contributions_due: number;
  total_contributions_paid: number;
  collection_rate: number;
  average_payment_time: number;
  on_time_payments: number;
  late_payments: number;
  monthly_trends: Array<{
    month: number;
    due: number;
    paid: number;
    rate: number;
  }>;
}

export interface ExpenseAnalytics {
  residence_id: number;
  year: number;
  total_expenses: number;
  by_category: Array<{
    category: string;
    amount: number;
    percentage: number;
    count: number;
  }>;
  by_month: Array<{
    month: number;
    amount: number;
  }>;
  top_vendors: Array<{
    vendor: string;
    amount: number;
    count: number;
  }>;
}

export interface PaymentTrends {
  residence_id: number;
  months: number;
  trends: Array<{
    month: string;
    contributions: number;
    fees: number;
    total: number;
  }>;
  payment_methods: Array<{
    method: PaymentMethod;
    count: number;
    amount: number;
    percentage: number;
  }>;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

