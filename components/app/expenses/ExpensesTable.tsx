'use client';

import { useState, useMemo } from 'react';
import { MoreVertical, Edit, Trash2, Eye, Paperclip, ArrowUpDown, ArrowUp, ArrowDown, Download, Receipt } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Expense } from './ExpensesContent';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ExpensesTableProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  loading?: boolean;
  canManage?: boolean;
}

type SortField = 'date' | 'amount' | 'category' | null;
type SortDirection = 'asc' | 'desc';

/**
 * Get category badge color
 */
const getCategoryBadgeColor = (category: string) => {
  const colors: Record<string, string> = {
    Electricity: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Cleaning: 'bg-blue-100 text-blue-800 border-blue-300',
    Maintenance: 'bg-orange-100 text-orange-800 border-orange-300',
    Security: 'bg-purple-100 text-purple-800 border-purple-300',
    Insurance: 'bg-green-100 text-green-800 border-green-300',
    Water: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    Internet: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    'Trash Collection': 'bg-gray-100 text-gray-800 border-gray-300',
    Gardening: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Plumbing: 'bg-teal-100 text-teal-800 border-teal-300',
    Electrical: 'bg-amber-100 text-amber-800 border-amber-300',
    Elevator: 'bg-pink-100 text-pink-800 border-pink-300',
    Other: 'bg-slate-100 text-slate-800 border-slate-300',
  };
  return colors[category] || colors.Other;
};

/**
 * Expenses Table Component
 * Modern table design with enhanced UX using shadcn/ui components
 */
export default function ExpensesTable({
  expenses,
  onEdit,
  onDelete,
  loading,
  canManage,
}: ExpensesTableProps) {
  console.log('[ExpensesTable] Rendering with', expenses.length, 'expenses');

  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // Handle sorting
  const handleSort = (field: SortField) => {
    console.log('[ExpensesTable] Sorting by', field, 'Current:', sortField, sortDirection);
    if (sortField === field) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      console.log('[ExpensesTable] Toggled sort direction to', newDirection);
    } else {
      setSortField(field);
      setSortDirection('desc');
      console.log('[ExpensesTable] Changed sort field to', field);
    }
  };

  // Sorted expenses
  const sortedExpenses = useMemo(() => {
    if (!sortField) {
      console.log('[ExpensesTable] No sort applied, returning original order');
      return expenses;
    }

    console.log('[ExpensesTable] Sorting expenses by', sortField, sortDirection);

    const sorted = [...expenses].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          comparison = new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime();
          break;
        case 'amount':
          comparison = Number(a.amount) - Number(b.amount);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    console.log('[ExpensesTable] Sorted', sorted.length, 'expenses');
    return sorted;
  }, [expenses, sortField, sortDirection]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1.5 text-muted-foreground opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1.5 text-primary" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1.5 text-primary" />
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg p-4 shadow animate-pulse">
            <div className="h-6 bg-muted rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
        <Receipt className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No expenses recorded</h3>
        <p className="text-gray-500">Add your first expense to start tracking.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200">
                <TableHead className="w-[120px]">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center font-semibold hover:text-primary transition-colors"
                    aria-label="Sort by date"
                  >
                    Date
                    {getSortIcon('date')}
                  </button>
                </TableHead>
                <TableHead className="min-w-[200px]">Description</TableHead>
                <TableHead className="w-[140px]">
                  <button
                    onClick={() => handleSort('category')}
                    className="flex items-center font-semibold hover:text-primary transition-colors"
                    aria-label="Sort by category"
                  >
                    Category
                    {getSortIcon('category')}
                  </button>
                </TableHead>
                <TableHead className="w-[120px] text-right">
                  <button
                    onClick={() => handleSort('amount')}
                    className="flex items-center justify-end ml-auto font-semibold hover:text-primary transition-colors"
                    aria-label="Sort by amount"
                  >
                    Amount
                    {getSortIcon('amount')}
                  </button>
                </TableHead>
                <TableHead className="w-[100px] text-center">Attachment</TableHead>
                <TableHead className="w-[140px]">Created By</TableHead>
                {canManage && <TableHead className="w-[80px] text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedExpenses.map((expense) => (
                <TableRow key={expense.id} className="border-gray-100 hover:bg-gray-50/50">
                  <TableCell className="font-medium">
                    {formatDate(expense.expense_date)}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px] truncate" title={expense.description}>
                      {expense.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getCategoryBadgeColor(expense.category)}
                    >
                      {expense.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(expense.amount))}
                  </TableCell>
                  <TableCell className="text-center">
                    {expense.attachment_url ? (
                      <a
                        href={expense.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center text-primary hover:text-primary/80 transition-colors"
                        aria-label="View attachment"
                      >
                        <Paperclip className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {expense.creator_name || 'Unknown'}
                    </span>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedExpense(expense);
                              setViewDialogOpen(true);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onEdit(expense)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(expense)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* View Details Dialog */}
      {selectedExpense && (
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Expense Details</DialogTitle>
              <DialogDescription>
                View complete expense information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="text-base font-semibold">{formatDate(selectedExpense.expense_date)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Amount</p>
                  <p className="text-base font-semibold">{formatCurrency(Number(selectedExpense.amount))}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                  <Badge
                    variant="outline"
                    className={getCategoryBadgeColor(selectedExpense.category)}
                  >
                    {selectedExpense.category}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created By</p>
                  <p className="text-base">{selectedExpense.creator_name || 'Unknown'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                <p className="text-base">{selectedExpense.description}</p>
              </div>
              {selectedExpense.attachment_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Attachment</p>
                  <a
                    href={selectedExpense.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    Download Attachment
                  </a>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

