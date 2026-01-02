'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Calendar, FileSpreadsheet, TrendingUp, Loader2 } from 'lucide-react';
import { checkContributionDataStatus } from '@/app/actions/contributions';
import toast from 'react-hot-toast';

export default function ContributionsSetupPage() {
  const router = useRouter();
  const [dataStatus, setDataStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<'historical' | 'fresh' | null>(null);

  useEffect(() => {
    async function loadStatus() {
      // TODO: Get residence ID from session/profile
      // For now, using placeholder
      const residenceId = 1; // This should come from user session
      
      const result = await checkContributionDataStatus(residenceId);
      
      if (result.error) {
        toast.error(result.error);
        setLoading(false);
        return;
      }
      
      setDataStatus(result.data);
      setLoading(false);
      
      // If data already exists, redirect to contributions view
      if (result.data?.hasData) {
        router.push('/app/contributions');
      }
    }
    
    loadStatus();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      <div>
        <h1 className="text-3xl font-bold">Setup Contribution Management</h1>
        <p className="text-muted-foreground mt-2">
          Choose how you want to manage monthly contributions for your residence
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Historical Import Option */}
        <Card
          className={`border-2 hover:border-blue-500 cursor-pointer transition-all ${
            selectedMode === 'historical' ? 'border-blue-500 bg-blue-50' : ''
          }`}
          onClick={() => setSelectedMode('historical')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                Import Historical Data
              </CardTitle>
              {selectedMode === 'historical' && (
                <div className="w-4 h-4 bg-blue-600 rounded-full" />
              )}
            </div>
            <CardDescription>Perfect if you have existing records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                If you have existing contribution records from Excel, PDF, or manual records,
                import them to get started quickly with full historical data.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900 mb-2">What you can import:</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>✓ Multiple years of contribution data</li>
                  <li>✓ Payment status for each apartment-month</li>
                  <li>✓ Outstanding balances automatically calculated</li>
                  <li>✓ Excel or CSV file formats supported</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fresh Start Option */}
        <Card
          className={`border-2 hover:border-green-500 cursor-pointer transition-all ${
            selectedMode === 'fresh' ? 'border-green-500 bg-green-50' : ''
          }`}
          onClick={() => setSelectedMode('fresh')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                Start Fresh
              </CardTitle>
              {selectedMode === 'fresh' && (
                <div className="w-4 h-4 bg-green-600 rounded-full" />
              )}
            </div>
            <CardDescription>Begin tracking from this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Set up monthly contributions from scratch using our automated system.
                Perfect for new residences or fresh starts.
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-green-900 mb-2">Features included:</p>
                <ul className="text-xs text-green-800 space-y-1">
                  <li>✓ Automatic monthly fee generation</li>
                  <li>✓ Payment reminders via email</li>
                  <li>✓ Real-time payment tracking</li>
                  <li>✓ Detailed contribution reports</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Continue Button */}
      {selectedMode && (
        <div className="flex justify-center pt-4">
          <Button
            size="lg"
            onClick={() => {
              if (selectedMode === 'historical') {
                router.push('/app/contributions/import');
              } else {
                router.push('/app/contributions/setup-fresh');
              }
            }}
            className="gap-2"
          >
            {selectedMode === 'historical' ? (
              <>
                <Upload className="w-4 h-4" />
                Start Import Process
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                Configure Monthly Fees
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

