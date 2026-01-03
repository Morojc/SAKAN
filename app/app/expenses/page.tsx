'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, Search, CheckCircle, XCircle, Eye, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';
import { useRouter } from 'next/navigation';
import type { Expense, ExpenseCategory } from '@/types/financial.types';
import { format } from 'date-fns';
import CreateExpenseDialog from '@/components/app/expenses/CreateExpenseDialog';

export default function ExpensesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [residenceId, setResidenceId] = useState(1); // TODO: Get from session

  useEffect(() => {
    loadData();
  }, [statusFilter, categoryFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load expenses
      let expensesUrl = `/api/expenses?residenceId=${residenceId}`;
      if (statusFilter !== 'all') {
        expensesUrl += `&status=${statusFilter}`;
      }
      if (categoryFilter !== 'all') {
        expensesUrl += `&categoryId=${categoryFilter}`;
      }

      const [expensesRes, categoriesRes] = await Promise.all([
        fetch(expensesUrl),
        fetch(`/api/expenses/categories?residenceId=${residenceId}`),
      ]);

      const expensesResult = await expensesRes.json();
      const categoriesResult = await categoriesRes.json();

      if (expensesResult.success) {
        setExpenses(expensesResult.data || []);
      }
      if (categoriesResult.success) {
        setCategories(categoriesResult.data || []);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error(t('expenses.failedToLoadExpenses'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      const response = await fetch(`/api/expenses/${id}/approve`, {
        method: 'PUT',
      });

      const result = await response.json();

      if (result.success) {
        toast.success(t('expenses.expenseApprovedSuccess'));
        loadData();
      } else {
        toast.error(result.error || t('expenses.failedToApproveExpense'));
      }
    } catch (error: any) {
      console.error('Error approving expense:', error);
      toast.error(t('expenses.failedToApproveExpense'));
    }
  };

  const handleMarkAsPaid = async (id: number) => {
    const paymentMethod = prompt(t('expenses.paymentMethodPrompt'));
    if (!paymentMethod) return;

    try {
      const response = await fetch(`/api/expenses/${id}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: paymentMethod }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(t('expenses.expenseMarkedAsPaid'));
        loadData();
      } else {
        toast.error(result.error || t('expenses.failedToMarkAsPaid'));
      }
    } catch (error: any) {
      console.error('Error marking as paid:', error);
      toast.error(t('expenses.failedToMarkAsPaid'));
    }
  };

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('expenses.paid')}
          </Badge>
        );
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800">{t('expenses.approved')}</Badge>;
      case 'draft':
        return <Badge className="bg-gray-100 text-gray-800">{t('expenses.draft')}</Badge>;
      case 'cancelled':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            {t('expenses.cancelled')}
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('expenses.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('expenses.manageDescription')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/app/expenses/categories')}
          >
            <Settings className="w-4 h-4 mr-2" />
            {t('expenses.categories')}
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('expenses.addExpense')}
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('expenses.totalExpenses')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expenses.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('expenses.pendingApproval')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {expenses.filter((e) => e.status === 'draft').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('expenses.paidThisMonth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {
                expenses.filter(
                  (e) =>
                    e.status === 'paid' &&
                    new Date(e.expense_date).getMonth() === new Date().getMonth()
                ).length
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('expenses.totalAmount')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="search">{t('common.search')}</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="text"
                  placeholder={t('expenses.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="category">{t('expenses.expenseCategory')}</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('expenses.allCategories')}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label htmlFor="status">{t('expenses.status')}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('expenses.allStatuses')}</SelectItem>
                  <SelectItem value="draft">{t('expenses.draft')}</SelectItem>
                  <SelectItem value="approved">{t('expenses.approved')}</SelectItem>
                  <SelectItem value="paid">{t('expenses.paid')}</SelectItem>
                  <SelectItem value="cancelled">{t('expenses.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('expenses.title')} ({filteredExpenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('expenses.date')}</TableHead>
                  <TableHead>{t('expenses.title')}</TableHead>
                  <TableHead>{t('expenses.expenseCategory')}</TableHead>
                  <TableHead>{t('expenses.vendor')}</TableHead>
                  <TableHead>{t('expenses.expenseAmount')}</TableHead>
                  <TableHead>{t('expenses.status')}</TableHead>
                  <TableHead>{t('expenses.attachment')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      {t('expenses.noExpensesFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {format(new Date(expense.expense_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          {expense.title}
                          <p className="text-xs text-muted-foreground mt-1">
                            {expense.description.substring(0, 50)}...
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {expense.category_name && (
                          <Badge
                            style={{
                              backgroundColor: expense.category_color + '20',
                              color: expense.category_color,
                            }}
                          >
                            {expense.category_name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{expense.vendor_name || '-'}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(expense.status)}</TableCell>
                      <TableCell>
                        {expense.attachment_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(expense.attachment_url, '_blank')}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {expense.status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(expense.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {t('expenses.approve')}
                          </Button>
                        )}
                        {expense.status === 'approved' && (
                          <Button
                            size="sm"
                            onClick={() => handleMarkAsPaid(expense.id)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {t('expenses.markAsPaid')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Expense Dialog */}
      <CreateExpenseDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          loadData();
          setShowCreateDialog(false);
        }}
        residenceId={residenceId}
        categories={categories}
      />
    </div>
  );
}
