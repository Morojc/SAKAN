'use client';

import { useMemo } from 'react';
import { Receipt, TrendingUp, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Expense } from './ExpensesContent';

interface ExpensesSummaryCardsProps {
  expenses: Expense[];
}

/**
 * Expenses Summary Cards Component
 * Displays total expenses, average, and category breakdown
 */
export default function ExpensesSummaryCards({ expenses }: ExpensesSummaryCardsProps) {
  console.log('[ExpensesSummaryCards] Rendering with', expenses.length, 'expenses');

  // Calculate summary statistics
  const summary = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const count = expenses.length;
    const average = count > 0 ? total / count : 0;

    // Calculate expenses by category
    const byCategory = expenses.reduce((acc, expense) => {
      const category = expense.category || 'Other';
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += Number(expense.amount);
      return acc;
    }, {} as Record<string, number>);

    // Get top categories
    const topCategories = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category, amount]) => ({ category, amount }));

    return {
      total,
      count,
      average,
      topCategories,
      byCategory,
    };
  }, [expenses]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  console.log('[ExpensesSummaryCards] Summary calculated:', summary);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Total Expenses Card */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.total)}</div>
          <CardDescription className="mt-1">
            {summary.count} expense{summary.count !== 1 ? 's' : ''} recorded
          </CardDescription>
        </CardContent>
      </Card>

      {/* Average Expense Card */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Expense</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.average)}</div>
          <CardDescription className="mt-1">
            Per expense average
          </CardDescription>
        </CardContent>
      </Card>

      {/* Top Categories Card */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Categories</CardTitle>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {summary.topCategories.length > 0 ? (
            <div className="space-y-2">
              {summary.topCategories.map((item, index) => (
                <div key={item.category} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {index + 1}. {item.category}
                  </span>
                  <span className="text-sm font-semibold">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <CardDescription>No expenses to display</CardDescription>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

