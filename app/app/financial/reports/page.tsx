'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import type { MonthlyReport, AnnualReport } from '@/types/financial.types';
import { format } from 'date-fns';
import { useI18n } from '@/lib/i18n/client';

export default function FinancialReportsPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'monthly' | 'annual'>('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [residenceId, setResidenceId] = useState(1); // TODO: Get from session
  const [report, setReport] = useState<MonthlyReport | AnnualReport | null>(null);

  useEffect(() => {
    // In a real app, we would fetch the user's residence ID first
    // For now, we'll assume residenceId 1 or fetch it if needed
    loadReport();
  }, [reportType, year, month]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        residenceId: residenceId.toString(),
        type: reportType,
        year: year.toString(),
      });
      if (reportType === 'monthly') {
        params.append('month', month.toString());
      }

      const response = await fetch(`/api/financial/reports?${params}`);
      const result = await response.json();

      if (result.success) {
        setReport(result.data);
      } else {
        // Don't show error on first load if it's just missing data
        console.error(result.error);
      }
    } catch (error: any) {
      console.error('Error loading report:', error);
      toast.error(t('financial.reports.failedToLoadReport'));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleExport = () => {
    toast.success(t('financial.reports.exportComingSoon'));
  };

  if (loading && !report) {
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
          <h1 className="text-3xl font-bold">{t('financial.reports.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('financial.reports.description')}
          </p>
        </div>
        {report && (
          <Button onClick={handleExport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            {t('financial.reports.export')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="reportType">{t('financial.reports.reportType')}</Label>
              <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t('financial.reports.monthly')}</SelectItem>
                  <SelectItem value="annual">{t('financial.reports.annual')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year">{t('financial.reports.year')}</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="mt-2"
                min="2020"
                max={new Date().getFullYear()}
              />
            </div>
            {reportType === 'monthly' && (
              <div>
                <Label htmlFor="month">{t('financial.reports.month')}</Label>
                <Select value={month.toString()} onValueChange={(value) => setMonth(parseInt(value))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {format(new Date(year, m - 1, 1), 'MMMM')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button onClick={loadReport} className="w-full">
                <FileText className="w-4 h-4 mr-2" />
                {t('financial.reports.generateReport')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Report */}
      {report && reportType === 'monthly' && 'month' in report && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Opening Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(report.opening_balance)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(report.total_income)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(report.total_expenses)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Closing Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(report.closing_balance)}</div>
                <div className="flex items-center gap-1 mt-1">
                  {report.net_change >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span
                    className={`text-sm ${
                      report.net_change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(report.net_change)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('financial.reports.incomeBreakdown')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>{t('financial.reports.contributionsCollected')}</span>
                  <span className="font-medium">{formatCurrency(report.contributions_collected)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('financial.reports.feesCollected')}</span>
                  <span className="font-medium">{formatCurrency(report.fees_collected)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">{t('financial.reports.totalIncome')}</span>
                  <span className="font-bold">{formatCurrency(report.total_income)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('financial.reports.outstanding')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>{t('financial.reports.outstandingContributions')}</span>
                  <span className="font-medium text-yellow-600">
                    {formatCurrency(report.outstanding_contributions)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('financial.reports.outstandingFees')}</span>
                  <span className="font-medium text-yellow-600">
                    {formatCurrency(report.outstanding_fees)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">{t('financial.reports.totalOutstanding')}</span>
                  <span className="font-bold text-yellow-600">
                    {formatCurrency(report.outstanding_contributions + report.outstanding_fees)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Expense Breakdown */}
          {report.expense_breakdown && report.expense_breakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('financial.reports.expenseBreakdown')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.expense_breakdown.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{item.category}</span>
                          <span>{item.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="ml-4 font-semibold">{formatCurrency(item.amount)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Annual Report */}
      {report && reportType === 'annual' && 'monthly_breakdown' in report && (
        <div className="space-y-4">
          {/* Annual Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Opening Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(report.opening_balance)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(report.total_income)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(report.total_expenses)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Closing Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(report.closing_balance)}</div>
                <div className="flex items-center gap-1 mt-1">
                  {report.net_change >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span
                    className={`text-sm ${
                      report.net_change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(report.net_change)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>{t('financial.reports.monthlyBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">{t('financial.reports.month')}</th>
                      <th className="text-right p-2">{t('financial.reports.totalIncome')}</th>
                      <th className="text-right p-2">{t('financial.reports.totalExpenses')}</th>
                      <th className="text-right p-2">{t('financial.reports.netChange')}</th>
                      <th className="text-right p-2">{t('financial.reports.balance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthly_breakdown.map((month, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{format(new Date(year, month.month - 1, 1), 'MMMM')}</td>
                        <td className="text-right p-2 text-green-600">
                          {formatCurrency(month.total_income)}
                        </td>
                        <td className="text-right p-2 text-red-600">
                          {formatCurrency(month.total_expenses)}
                        </td>
                        <td className="text-right p-2">
                          {month.net_change >= 0 ? (
                            <span className="text-green-600">{formatCurrency(month.net_change)}</span>
                          ) : (
                            <span className="text-red-600">{formatCurrency(month.net_change)}</span>
                          )}
                        </td>
                        <td className="text-right p-2 font-medium">
                          {formatCurrency(month.closing_balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Expense by Category */}
          {report.expense_by_category && report.expense_by_category.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('financial.reports.annualExpenseBreakdown')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.expense_by_category.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{item.category}</span>
                          <span>{item.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="ml-4 font-semibold">{formatCurrency(item.amount)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
