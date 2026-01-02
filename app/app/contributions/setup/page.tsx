'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Calendar, FileSpreadsheet, TrendingUp, Loader2 } from 'lucide-react';
import { checkContributionDataStatus } from '@/app/actions/contributions';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';

export default function ContributionsSetupPage() {
  const router = useRouter();
  const { t } = useI18n();
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
        <h1 className="text-3xl font-bold">{t('contributions.setupTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('contributions.setupDescription')}
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
                {t('contributions.historicalImport')}
              </CardTitle>
              {selectedMode === 'historical' && (
                <div className="w-4 h-4 bg-blue-600 rounded-full" />
              )}
            </div>
            <CardDescription>{t('contributions.historicalImportDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('contributions.historicalImportInfo')}
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900 mb-2">{t('contributions.historicalImportFeatures')}</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>✓ {t('contributions.historicalFeature1')}</li>
                  <li>✓ {t('contributions.historicalFeature2')}</li>
                  <li>✓ {t('contributions.historicalFeature3')}</li>
                  <li>✓ {t('contributions.historicalFeature4')}</li>
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
                {t('contributions.startFresh')}
              </CardTitle>
              {selectedMode === 'fresh' && (
                <div className="w-4 h-4 bg-green-600 rounded-full" />
              )}
            </div>
            <CardDescription>{t('contributions.startFreshDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('contributions.startFreshInfo')}
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-green-900 mb-2">{t('contributions.startFreshFeatures')}</p>
                <ul className="text-xs text-green-800 space-y-1">
                  <li>✓ {t('contributions.freshFeature1')}</li>
                  <li>✓ {t('contributions.freshFeature2')}</li>
                  <li>✓ {t('contributions.freshFeature3')}</li>
                  <li>✓ {t('contributions.freshFeature4')}</li>
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
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {selectedMode === 'historical' ? (
              <>
                <Upload className="w-4 h-4" />
                {t('contributions.startImportProcess')}
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                {t('contributions.configureMonthlyFees')}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

