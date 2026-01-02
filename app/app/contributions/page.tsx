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
import { checkContributionDataStatus } from '@/app/actions/contributions';
import { getContributionStatus, type ContributionStatusRow } from '@/app/actions/contribution-status';
import AddContributionDialog from '@/components/app/contributions/AddContributionDialog';
import toast from 'react-hot-toast';

export default function ContributionsPage() {
  const router = useRouter();
  const [dataStatus, setDataStatus] = useState<any>(null);
  const [contributionData, setContributionData] = useState<ContributionStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function loadData() {
      // TODO: Get residence ID from session
      const residenceId = 1;

      // Check data status
      const statusResult = await checkContributionDataStatus(residenceId);

      if (statusResult.error) {
        toast.error(statusResult.error);
        setLoading(false);
        return;
      }

      setDataStatus(statusResult.data);

      // If no data, redirect to setup
      if (!statusResult.data?.hasData) {
        router.push('/app/contributions/setup');
        return;
      }

      // Load contribution status
      const contributionResult = await getContributionStatus(residenceId, selectedYear);

      if (contributionResult.error) {
        toast.error(contributionResult.error);
      } else {
        setContributionData(contributionResult.data || []);
      }

      setLoading(false);
    }

    loadData();
  }, [selectedYear, router, refreshTrigger]);

  // Filter data by search term
  const filteredData = contributionData.filter(
    (row) =>
      row.apartmentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.residentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Prepare apartment list for add dialog
  const apartments = contributionData.map((row) => ({
    number: row.apartmentNumber,
    residentName: row.residentName,
    residentId: row.residentId,
  }));

  const handleContributionAdded = () => {
    setRefreshTrigger(prev => prev + 1);
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
          <h1 className="text-3xl font-bold">Contribution Status</h1>
          <p className="text-muted-foreground mt-1">
            {dataStatus?.setupMode === 'historical'
              ? 'Historical data imported'
              : dataStatus?.setupMode === 'mixed'
              ? 'Historical + Fresh start'
              : 'Fresh start mode'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddDialog(true)}>
            <PlusCircle className="w-4 h-4 mr-2 text-white bg-blue-600" />
            Add Manually
          </Button>
          <Button variant="outline" onClick={() => router.push('/app/contributions/import')}>
            <Upload className="w-4 h-4 mr-2" />
            {dataStatus?.setupMode === 'historical' ? 'Import More' : 'Import Data'}
          </Button>
          <Button variant="outline">
            <FileDown className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => router.push('/app/recurring-rules')}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Search by apartment or resident name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-40">
              <Label htmlFor="year">Year</Label>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Apartments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fully Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filteredData.filter((row) => row.outstandingMonths === 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">With Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {filteredData.filter((row) => row.outstandingMonths > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {filteredData.reduce((sum, row) => sum + row.outstandingMonths, 0)} months
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
                    APPT
                  </th>
                  <th className="border px-4 py-3 text-left font-semibold">Resident</th>
                  <th className="border px-4 py-3 text-center font-semibold">Report</th>
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
                      {row.apartmentNumber}
                    </td>
                    <td className="border px-4 py-3">{row.residentName}</td>
                    <td className="border px-4 py-3 text-center">
                      {row.outstandingMonths > 0 && (
                        <span className="text-red-600 font-medium">
                          {row.outstandingMonths.toString().padStart(2, '0')} Mois
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
                            status === 'unpaid' ? 'bg-red-100' : status === 'paid' ? '' : 'bg-gray-50'
                          }`}
                          title={
                            status === 'paid'
                              ? 'Paid'
                              : status === 'unpaid'
                              ? 'Unpaid - Click to record payment'
                              : 'No fee for this month'
                          }
                        >
                          {status === 'paid' && <span className="font-bold">X</span>}
                          {status === 'unpaid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                // TODO: Open payment dialog
                                toast('Payment recording coming soon!');
                              }}
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

      {/* Add Contribution Dialog */}
      <AddContributionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={handleContributionAdded}
        residenceId={1} // TODO: Get from session
        apartments={apartments}
      />
    </div>
  );
}

