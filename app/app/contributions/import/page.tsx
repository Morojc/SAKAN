'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Download,
  Loader2,
} from 'lucide-react';
import { 
  validateContributionImportData, 
  importHistoricalContributions,
  type ContributionImportRow,
  type ContributionImportPreview 
} from '@/app/actions/contributions';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function HistoricalImportPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [amount, setAmount] = useState('');
  const [parsedData, setParsedData] = useState<ContributionImportRow[]>([]);
  const [preview, setPreview] = useState<ContributionImportPreview[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const progress = (step / 4) * 100;

  // Download template
  const handleDownloadTemplate = () => {
    const template = [
      {
        'APPT': '1',
        'Report': '',
        'janv-25': 'X',
        'févr-25': 'X',
        'mars-25': '',
        'avr-25': 'X',
        'mai-25': '',
        'juin-25': 'X',
        'juil-25': 'X',
        'août-25': '',
        'sept-25': 'X',
        'oct-25': 'X',
        'nov-25': '',
        'déc-25': 'X',
      },
      {
        'APPT': '2',
        'Report': '02 Mois',
        'janv-25': 'X',
        'févr-25': 'X',
        'mars-25': 'X',
        'avr-25': 'X',
        'mai-25': 'X',
        'juin-25': 'X',
        'juil-25': 'X',
        'août-25': 'X',
        'sept-25': 'X',
        'oct-25': 'X',
        'nov-25': '',
        'déc-25': '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contributions');
    XLSX.writeFile(wb, `contribution_template_${year}.xlsx`);
    toast.success('Template downloaded!');
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.match(/\.(xlsx|xls|csv)$/)) {
      toast.error('Please upload an Excel or CSV file');
      return;
    }

    setFile(uploadedFile);
    toast.success('File uploaded successfully');
  };

  // Parse Excel file
  const parseFile = () => {
    if (!file) {
      toast.error('Please upload a file first');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

        // Parse into ContributionImportRow format
        const parsed: ContributionImportRow[] = jsonData.map((row) => {
          const apartmentNumber = row['APPT']?.toString();
          const report = row['Report'];
          const months: { [key: string]: 'paid' | 'unpaid' } = {};

          // Extract months
          Object.keys(row).forEach((key) => {
            if (key !== 'APPT' && key !== 'Report') {
              const value = row[key];
              // Check if it's a month column (format: 'janv-25')
              if (key.includes('-')) {
                months[key] = value === 'X' || value === 'x' ? 'paid' : 'unpaid';
              }
            }
          });

          return {
            apartmentNumber,
            report,
            months,
          };
        });

        setParsedData(parsed);
        setStep(2);
      } catch (error) {
        console.error('Parse error:', error);
        toast.error('Failed to parse file. Please check the format.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Validate and preview
  const handleValidate = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid contribution amount');
      return;
    }

    setImporting(true);

    // TODO: Get residence ID from session
    const residenceId = 1;

    const result = await validateContributionImportData(
      residenceId,
      year,
      parseFloat(amount),
      parsedData
    );

    setImporting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setPreview(result.data || []);
    setStep(3);
  };

  // Execute import
  const handleImport = async () => {
    setImporting(true);

    // TODO: Get residence ID from session
    const residenceId = 1;

    const result = await importHistoricalContributions(
      residenceId,
      year,
      parseFloat(amount),
      parsedData
    );

    setImporting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setImportResult(result);
    setStep(4);
    toast.success('Import completed successfully!');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Import Historical Contributions</h1>
          <p className="text-muted-foreground mt-1">
            Step {step} of 4: {
              step === 1 ? 'Upload File' :
              step === 2 ? 'Configure Parameters' :
              step === 3 ? 'Preview Data' :
              'Import Complete'
            }
          </p>
        </div>
      </div>

      {/* Progress */}
      <Progress value={progress} className="h-2" />

      {/* Step 1: Upload File */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Upload Contribution Data
            </CardTitle>
            <CardDescription>
              Upload an Excel or CSV file with your contribution records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Download Template */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Download className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900">Need a template?</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Download our Excel template to see the expected format
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                    className="mt-3"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <Label htmlFor="file-upload">Select File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="mt-2"
              />
              {file && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  {file.name}
                </div>
              )}
            </div>

            {/* File Format Instructions */}
            <div className="border rounded-lg p-4">
              <p className="font-medium mb-2">Expected File Format:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Column "APPT": Apartment numbers (e.g., 1, 2, 3...)</li>
                <li>• Column "Report": Outstanding months (optional)</li>
                <li>• Month columns: janv-25, févr-25, mars-25, etc.</li>
                <li>• Mark paid months with "X", leave unpaid empty</li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Button onClick={parseFile} disabled={!file}>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Configure Parameters */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Configure Import Parameters</CardTitle>
            <CardDescription>
              Set the year and contribution amount for this import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  min="2020"
                  max={new Date().getFullYear() + 1}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="amount">Monthly Contribution Amount (MAD)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g., 150"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="bg-gray-50 border rounded-lg p-4">
              <p className="font-medium mb-2">Import Summary:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• File: {file?.name}</li>
                <li>• Apartments found: {parsedData.length}</li>
                <li>• Year: {year}</li>
                <li>• Amount per month: {amount ? `${amount} MAD` : 'Not set'}</li>
              </ul>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleValidate} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    Preview Data
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Import Data</CardTitle>
            <CardDescription>
              Review the data before importing. Unmatched apartments will be skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">Total Apartments</p>
                <p className="text-2xl font-bold text-blue-900">{preview.length}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">Matched</p>
                <p className="text-2xl font-bold text-green-900">
                  {preview.filter((p) => p.matched).length}
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">Unmatched</p>
                <p className="text-2xl font-bold text-red-900">
                  {preview.filter((p) => !p.matched).length}
                </p>
              </div>
            </div>

            {/* Preview Table */}
            <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">Appt</th>
                    <th className="px-4 py-3 text-left">Resident</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Unpaid</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((item, index) => (
                    <tr key={index} className={item.matched ? '' : 'bg-red-50'}>
                      <td className="px-4 py-3">{item.apartmentNumber}</td>
                      <td className="px-4 py-3">{item.residentName || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {item.matched ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{item.paidMonths}</td>
                      <td className="px-4 py-3 text-right">{item.unpaidMonths}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.totalAmount.toFixed(2)} MAD
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Warnings */}
            {preview.some((p) => !p.matched) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">Warning: Unmatched Apartments</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Some apartments could not be matched to residents. These will be skipped during import.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing || preview.filter((p) => p.matched).length === 0}>
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Confirm Import
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Complete */}
      {step === 4 && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              Import Complete!
            </CardTitle>
            <CardDescription>
              Your historical contribution data has been successfully imported
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-green-700">Fees Imported</p>
                  <p className="text-3xl font-bold text-green-900">{importResult.feesImported}</p>
                </div>
                <div>
                  <p className="text-sm text-green-700">Payments Imported</p>
                  <p className="text-3xl font-bold text-green-900">{importResult.paymentsImported}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button size="lg" onClick={() => router.push('/app/contributions')}>
                View Contribution Status
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

