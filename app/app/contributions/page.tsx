'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Upload,
  Download,
  Loader2,
  Search,
  FileDown,
  Settings,
  Plus,
  PlusCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';
import type { ContributionStatusMatrix } from '@/types/financial.types';

export default function ContributionsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [statusMatrix, setStatusMatrix] = useState<ContributionStatusMatrix[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [residenceId, setResidenceId] = useState<number | null>(null);

  useEffect(() => {
    loadUserResidence();
  }, []);

  useEffect(() => {
    if (residenceId) {
      loadContributionStatus();
    }
  }, [selectedYear, residenceId]);

  const loadUserResidence = async () => {
    try {
      const response = await fetch('/api/user/residence');
      const result = await response.json();

      if (result.success && result.data?.residence_id) {
        setResidenceId(result.data.residence_id);
      } else {
        toast.error('Could not load your residence. Please contact support.');
      }
    } catch (error: any) {
      console.error('Error loading residence:', error);
      toast.error('Failed to load residence information');
    }
  };

  const loadContributionStatus = async () => {
    if (!residenceId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/contributions/status?residenceId=${residenceId}&year=${selectedYear}`);
      
      if (!response.ok) {
        throw new Error('Failed to load contribution status');
      }

      const result = await response.json();
      
      if (result.success) {
        setStatusMatrix(result.data || []);
      } else {
        toast.error(result.error || 'Failed to load contribution status');
      }
    } catch (error: any) {
      console.error('Error loading contribution status:', error);
      toast.error(error.message || 'Failed to load contribution status');
    } finally {
      setLoading(false);
    }
  };

  // Filter data by search term
  const filteredData = statusMatrix.filter(
    (row) =>
      row.apartment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.resident_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateContributions = async () => {
    if (!residenceId) {
      toast.error('Residence ID not loaded. Please refresh the page.');
      return;
    }

    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const periodStart = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

    try {
      const response = await fetch('/api/contributions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residence_id: residenceId,
          period_start: periodStart,
          period_end: periodEnd,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message || 'Contributions generated successfully');
        loadContributionStatus();
      } else {
        toast.error(result.error || 'Failed to generate contributions');
      }
    } catch (error: any) {
      console.error('Error generating contributions:', error);
      toast.error('Failed to generate contributions');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const monthNames = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const yearShort = selectedYear.toString().slice(-2);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('contributions.contributionStatus')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('contributions.viewAndManageContributions')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleGenerateContributions}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Generate This Month
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/app/contributions/plans')}
          >
            <Settings className="w-4 h-4 mr-2" />
            {t('contributions.settings')}
          </Button>
          <Button variant="outline">
            <FileDown className="w-4 h-4 mr-2" />
            {t('contributions.export')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="search">{t('contributions.search')}</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="text"
                  placeholder={t('contributions.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-40">
              <Label htmlFor="year">{t('contributions.year')}</Label>
              <select
                id="year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('contributions.totalApartments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('contributions.fullyPaid')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filteredData.filter((row) => row.outstanding_months === 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('contributions.withOutstanding')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {filteredData.filter((row) => row.outstanding_months > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('contributions.totalOutstanding')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {filteredData.reduce((sum, row) => sum + row.outstanding_months, 0)} {t('contributions.months')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contribution Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>SITUATION DES COTISATIONS - {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-4 py-3 text-left font-semibold sticky left-0 bg-gray-50 z-10">
                    {t('contributions.apartment')}
                  </th>
                  <th className="border px-4 py-3 text-left font-semibold">{t('contributions.resident')}</th>
                  <th className="border px-4 py-3 text-center font-semibold">{t('contributions.report')}</th>
                  {monthNames.map((month) => (
                    <th key={month} className="border px-2 py-3 text-center font-semibold">
                      {month}-{yearShort}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border px-4 py-3 font-medium sticky left-0 bg-white z-10">
                      {row.apartment_number}
                    </td>
                    <td className="border px-4 py-3">{row.resident_name}</td>
                    <td className="border px-4 py-3 text-center">
                      {row.outstanding_months > 0 && (
                        <span className="text-red-600 font-medium">
                          {row.outstanding_months.toString().padStart(2, '0')} Mois
                        </span>
                      )}
                    </td>
                    {monthNames.map((month) => {
                      const monthKey = `${month}-${yearShort}`;
                      const status = row.months[monthKey];
                      return (
                        <td
                          key={monthKey}
                          className={`border px-2 py-3 text-center cursor-pointer hover:bg-gray-100 ${
                            status === 'pending' || status === 'overdue' 
                              ? 'bg-red-100' 
                              : status === 'paid' 
                              ? 'bg-green-50' 
                              : status === 'partial'
                              ? 'bg-yellow-50'
                              : 'bg-gray-50'
                          }`}
                          title={
                            status === 'paid'
                              ? 'Paid'
                              : status === 'pending'
                              ? 'Unpaid - Click to record payment'
                              : status === 'partial'
                              ? 'Partially paid'
                              : status === 'overdue'
                              ? 'Overdue'
                              : 'No contribution for this month'
                          }
                          onClick={() => {
                            if (status === 'pending' || status === 'partial' || status === 'overdue') {
                              router.push(`/app/payments/submit?apartment=${row.apartment_number}&month=${monthKey}`);
                            }
                          }}
                        >
                          {status === 'paid' && <span className="font-bold text-green-700">✓</span>}
                          {status === 'partial' && <span className="font-bold text-yellow-700">½</span>}
                          {(status === 'pending' || status === 'overdue') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No data found. Try adjusting your search or filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
