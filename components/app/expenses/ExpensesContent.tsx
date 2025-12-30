'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Receipt, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExpensesTable from './ExpensesTable';
import ExpensesSummaryCards from './ExpensesSummaryCards';
import AddExpenseDialog from './AddExpenseDialog';
import EditExpenseDialog from './EditExpenseDialog';
import DeleteExpenseDialog from './DeleteExpenseDialog';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { deleteExpense } from '@/app/app/expenses/actions';

/**
 * Expense data structure
 */
export interface Expense {
  id: number;
  residence_id: number;
  description: string;
  category: string;
  amount: number;
  attachment_url: string | null;
  expense_date: string; // ISO date string
  created_by: string | null;
  created_at: string;
  creator_name?: string;
  residence_name?: string;
}

interface ExpensesContentProps {
  initialExpenses: Expense[];
  currentUserId?: string;
  currentUserRole?: string;
  currentUserResidenceId?: number | null;
  residenceName?: string;
}

/**
 * Expense categories
 */
const EXPENSE_CATEGORIES = [
  'Electricity',
  'Cleaning',
  'Maintenance',
  'Security',
  'Insurance',
  'Water',
  'Internet',
  'Trash Collection',
  'Gardening',
  'Plumbing',
  'Electrical',
  'Elevator',
  'Other',
];

/**
 * Expenses Content Component
 * Manages state for expenses, filters, and UI interactions
 */
export default function ExpensesContent({ 
  initialExpenses, 
  currentUserRole,
  currentUserResidenceId,
  residenceName,
}: ExpensesContentProps) {
  console.log('[ExpensesContent] Component mounted with', initialExpenses.length, 'expenses');

  const router = useRouter();

  // State management
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedExpenseForEdit, setSelectedExpenseForEdit] = useState<Expense | null>(null);
  const [selectedExpenseForDelete, setSelectedExpenseForDelete] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync local state with server data when it refreshes
  useEffect(() => {
    console.log('[ExpensesContent] Syncing state with server data:', {
      initialExpensesCount: initialExpenses.length,
      currentExpensesCount: expenses.length,
    });
    setExpenses(initialExpenses);
  }, [initialExpenses, expenses.length]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('[ExpensesContent] State updated:', {
      expensesCount: expenses.length,
      searchQuery,
      categoryFilter,
      startDateFilter,
      endDateFilter,
    });
  }, [expenses, searchQuery, categoryFilter, startDateFilter, endDateFilter]);

  // Filter expenses based on search, category, and date range
  const filteredExpenses = useMemo(() => {
    console.log('[ExpensesContent] Filtering expenses...');
    let filtered = [...expenses];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (expense) =>
          expense.description.toLowerCase().includes(query) ||
          expense.category.toLowerCase().includes(query) ||
          expense.creator_name?.toLowerCase().includes(query) ||
          expense.amount.toString().includes(query)
      );
      console.log('[ExpensesContent] After search filter:', filtered.length, 'expenses');
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((expense) => expense.category === categoryFilter);
      console.log('[ExpensesContent] After category filter:', filtered.length, 'expenses');
    }

    // Date range filter
    if (startDateFilter) {
      filtered = filtered.filter(
        (expense) => expense.expense_date >= startDateFilter
      );
      console.log('[ExpensesContent] After start date filter:', filtered.length, 'expenses');
    }

    if (endDateFilter) {
      filtered = filtered.filter(
        (expense) => expense.expense_date <= endDateFilter
      );
      console.log('[ExpensesContent] After end date filter:', filtered.length, 'expenses');
    }

    console.log('[ExpensesContent] Final filtered count:', filtered.length);
    return filtered;
  }, [expenses, searchQuery, categoryFilter, startDateFilter, endDateFilter]);

  /**
   * Handle expense added
   */
  const handleExpenseAdded = async (expense: Expense) => {
    console.log('[ExpensesContent] Expense added:', expense);
    setExpenses((prev) => [expense, ...prev]);
    router.refresh(); // Refresh server data
    toast.success('Expense added successfully');
  };

  /**
   * Handle expense updated
   */
  const handleExpenseUpdated = async (updatedExpense: Expense) => {
    console.log('[ExpensesContent] Expense updated:', updatedExpense);
    setExpenses((prev) =>
      prev.map((e) => (e.id === updatedExpense.id ? updatedExpense : e))
    );
    router.refresh(); // Refresh server data
    toast.success('Expense updated successfully');
  };

  /**
   * Handle expense deleted
   */
  const handleExpenseDeleted = async (expenseId: number) => {
    console.log('[ExpensesContent] Deleting expense:', expenseId);
    setLoading(true);

    try {
      const result = await deleteExpense(expenseId);
      if (result.success) {
        setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
        router.refresh(); // Refresh server data
        toast.success('Expense deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete expense');
      }
    } catch (error: any) {
      console.error('[ExpensesContent] Error deleting expense:', error);
      toast.error(error.message || 'Failed to delete expense');
    } finally {
      setLoading(false);
    }
  };

  // Check if user can manage expenses (syndic only)
  const canManageExpenses = currentUserRole === 'syndic';

  return (
    <div className="space-y-8 relative pb-20 px-1">
      {/* Summary Cards */}
      <ExpensesSummaryCards expenses={filteredExpenses} />

      {/* Header Section with Search, Filters, and Add Button */}
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto flex-1">
          {/* Search Input */}
          <div className="relative flex-1 w-full sm:max-w-md group">
            <Receipt className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
            <Input
              placeholder="Search by description, category..."
              value={searchQuery}
              onChange={(e) => {
                console.log('[ExpensesContent] Search query changed:', e.target.value);
                setSearchQuery(e.target.value);
              }}
              className="pl-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-300 rounded-xl transition-all duration-200 h-11"
              aria-label="Search expenses"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Category Filter */}
            <Select
              value={categoryFilter}
              onValueChange={(value: string) => {
                console.log('[ExpensesContent] Category filter changed:', value);
                setCategoryFilter(value);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl bg-white border-gray-200" aria-label="Filter by category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {EXPENSE_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range Filters */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={startDateFilter}
                onChange={(e) => {
                  console.log('[ExpensesContent] Start date changed:', e.target.value);
                  setStartDateFilter(e.target.value);
                }}
                className="w-full sm:w-[150px] h-11 rounded-xl bg-white border-gray-200"
                placeholder="Start date"
                aria-label="Start date filter"
              />
              <span className="text-gray-400">to</span>
              <Input
                type="date"
                value={endDateFilter}
                onChange={(e) => {
                  console.log('[ExpensesContent] End date changed:', e.target.value);
                  setEndDateFilter(e.target.value);
                }}
                className="w-full sm:w-[150px] h-11 rounded-xl bg-white border-gray-200"
                placeholder="End date"
                aria-label="End date filter"
              />
              {(startDateFilter || endDateFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartDateFilter('');
                    setEndDateFilter('');
                  }}
                  className="h-11"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Add Expense Button - Desktop */}
        {canManageExpenses && (
          <Button
            onClick={() => {
              console.log('[ExpensesContent] Add expense button clicked');
              setShowAddDialog(true);
            }}
            className="hidden lg:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all hover:scale-105 h-11 rounded-xl px-6"
            aria-label="Add new expense"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        )}
      </div>

      {/* Expenses Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <ExpensesTable
          expenses={filteredExpenses}
          onEdit={(expense) => {
            console.log('[ExpensesContent] Edit expense clicked:', expense);
            setSelectedExpenseForEdit(expense);
          }}
          onDelete={(expense) => {
            console.log('[ExpensesContent] Delete expense clicked:', expense);
            setSelectedExpenseForDelete(expense);
          }}
          loading={loading}
          canManage={canManageExpenses}
        />
      </motion.div>

      {/* Floating Action Button for Add Expense - Mobile */}
      {canManageExpenses && (
        <Button
          onClick={() => {
            console.log('[ExpensesContent] Add expense button clicked (mobile)');
            setShowAddDialog(true);
          }}
          size="lg"
          className="lg:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-200 z-[100] bg-blue-600 hover:bg-blue-700 text-white border-0"
          aria-label="Add new expense"
        >
          <Plus className="h-6 w-6 text-white" />
          <span className="sr-only">Add Expense</span>
        </Button>
      )}

      {/* Add Expense Dialog */}
      {canManageExpenses && (
        <AddExpenseDialog
          open={showAddDialog}
          onClose={() => {
            console.log('[ExpensesContent] Add dialog closed');
            setShowAddDialog(false);
          }}
          onSuccess={handleExpenseAdded}
          currentUserResidenceId={currentUserResidenceId}
          residenceName={residenceName}
        />
      )}

      {/* Edit Expense Dialog */}
      {canManageExpenses && selectedExpenseForEdit && (
        <EditExpenseDialog
          open={!!selectedExpenseForEdit}
          expense={selectedExpenseForEdit}
          onClose={() => {
            console.log('[ExpensesContent] Edit dialog closed');
            setSelectedExpenseForEdit(null);
          }}
          onSuccess={handleExpenseUpdated}
        />
      )}

      {/* Delete Expense Dialog */}
      {canManageExpenses && selectedExpenseForDelete && (
        <DeleteExpenseDialog
          open={!!selectedExpenseForDelete}
          expense={selectedExpenseForDelete}
          onClose={() => {
            console.log('[ExpensesContent] Delete dialog closed');
            setSelectedExpenseForDelete(null);
          }}
          onConfirm={() => {
            if (selectedExpenseForDelete) {
              handleExpenseDeleted(selectedExpenseForDelete.id);
              setSelectedExpenseForDelete(null);
            }
          }}
        />
      )}
    </div>
  );
}

