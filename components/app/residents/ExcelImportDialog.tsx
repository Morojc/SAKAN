'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { bulkCreateResidents } from '@/app/app/residents/actions';
import { ResidentWithFees } from './ResidentsContent';
import toast from 'react-hot-toast';
// @ts-ignore - xlsx types may not be perfect
import * as XLSX from 'xlsx';

interface ExcelImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (residents: ResidentWithFees[]) => void;
  currentUserResidenceId?: number | null;
}

interface ParsedResident {
  full_name: string;
  email: string;
  phone_number?: string;
  apartment_number: string;
  role?: 'resident' | 'guard';
}

/**
 * Excel Import Dialog Component
 * Allows syndics to import residents from an Excel file
 */
export default function ExcelImportDialog({
  open,
  onClose,
  onSuccess,
  currentUserResidenceId,
}: ExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedResident[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [_errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ valid: ParsedResident[]; invalid: { row: number; data: any; error: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog closes
  const handleClose = () => {
    if (!importing) {
      setFile(null);
      setParsedData([]);
      setPreview(null);
      setErrors([]);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Please select a valid Excel file (.xlsx, .xls) or CSV file');
      return;
    }

    setFile(selectedFile);
    parseExcelFile(selectedFile);
  };

  // Parse Excel file
  const parseExcelFile = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          toast.error('Failed to read file');
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

        if (jsonData.length < 2) {
          toast.error('Excel file must have at least a header row and one data row');
          return;
        }

        // Get headers (first row)
        const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
        
        // Find column indices
        const nameIndex = findColumnIndex(headers, ['name', 'full name', 'full_name', 'resident name']);
        const emailIndex = findColumnIndex(headers, ['email', 'e-mail', 'email address']);
        const phoneIndex = findColumnIndex(headers, ['phone', 'phone number', 'phone_number', 'mobile', 'tel']);
        const apartmentIndex = findColumnIndex(headers, ['apartment', 'apartment number', 'apartment_number', 'unit', 'unit number']);
        const roleIndex = findColumnIndex(headers, ['role', 'type', 'resident type']);

        if (nameIndex === -1 || emailIndex === -1 || apartmentIndex === -1) {
          toast.error('Excel file must contain columns: Name, Email, and Apartment Number');
          return;
        }

        // Parse data rows
        const parsed: ParsedResident[] = [];
        const invalidRows: { row: number; data: any; error: string }[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const name = String(row[nameIndex] || '').trim();
          const email = String(row[emailIndex] || '').trim();
          const phone = phoneIndex >= 0 ? String(row[phoneIndex] || '').trim() : '';
          const apartment = String(row[apartmentIndex] || '').trim();
          const roleValue = roleIndex >= 0 ? String(row[roleIndex] || '').trim().toLowerCase() : 'resident';
          const role = roleValue === 'guard' ? 'guard' : 'resident';

          // Validate row
          const validationError = validateRow(name, email, apartment, i + 1);
          if (validationError) {
            invalidRows.push({
              row: i + 1,
              data: { name, email, phone, apartment, role },
              error: validationError,
            });
            continue;
          }

          parsed.push({
            full_name: name,
            email: email.toLowerCase(),
            phone_number: phone || undefined,
            apartment_number: apartment,
            role,
          });
        }

        if (parsed.length === 0 && invalidRows.length > 0) {
          toast.error('No valid rows found in Excel file');
          return;
        }

        setParsedData(parsed);
        setPreview({ valid: parsed, invalid: invalidRows });
        setErrors(invalidRows.map(r => `Row ${r.row}: ${r.error}`));

        toast.success(`Parsed ${parsed.length} valid resident(s)${invalidRows.length > 0 ? `, ${invalidRows.length} invalid row(s)` : ''}`);
      } catch (error: any) {
        console.error('[ExcelImportDialog] Error parsing file:', error);
        toast.error('Failed to parse Excel file: ' + (error.message || 'Unknown error'));
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read file');
    };

    if (file.type === 'text/csv') {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  // Find column index by possible header names
  const findColumnIndex = (headers: string[], possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.includes(name) || name.includes(h));
      if (index !== -1) return index;
    }
    return -1;
  };

  // Validate a row
  const validateRow = (name: string, email: string, apartment: string, _rowNum: number): string | null => {
    if (!name || name.length < 2) {
      return 'Name is required and must be at least 2 characters';
    }

    if (!email) {
      return 'Email is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Invalid email format';
    }

    if (!apartment) {
      return 'Apartment number is required';
    }

    return null;
  };

  // Download template
  const downloadTemplate = () => {
    const templateData = [
      ['Full Name', 'Email', 'Phone Number', 'Apartment Number', 'Role'],
      ['John Doe', 'john.doe@example.com', '+212612345678', '101', 'resident'],
      ['Jane Smith', 'jane.smith@example.com', '+212612345679', '102', 'resident'],
      ['Guard Name', 'guard@example.com', '+212612345680', '', 'guard'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Residents');

    // Style header row
    // const headerStyle = {
    //   font: { bold: true, color: { rgb: 'FFFFFF' } },
    //   fill: { fgColor: { rgb: '4472C4' } },
    // };

    XLSX.writeFile(wb, 'residents_import_template.xlsx');
    toast.success('Template downloaded!');
  };

  // Handle import
  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast.error('No valid residents to import');
      return;
    }

    if (!currentUserResidenceId) {
      toast.error('Residence ID is required');
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      // Prepare data for bulk create
      const residentsToImport = parsedData.map(r => ({
        full_name: r.full_name,
        email: r.email,
        phone_number: r.phone_number,
        apartment_number: r.apartment_number,
        residence_id: currentUserResidenceId,
        role: r.role || 'resident',
      }));

      const result = await bulkCreateResidents(residentsToImport);

      if (result.success && result.results) {
        const successCount = result.results.success.length;
        const failedCount = result.results.failed.length;

        if (successCount > 0) {
          // Transform successful residents to ResidentWithFees format
          const importedResidents: ResidentWithFees[] = result.results.success.map((r: any) => ({
            id: r.id,
            full_name: r.full_name,
            apartment_number: r.apartment_number,
            phone_number: r.phone_number,
            role: r.role,
            created_at: r.created_at || new Date().toISOString(),
            residence_id: currentUserResidenceId,
            email: r.email || parsedData.find(p => p.full_name === r.full_name)?.email || null,
            fees: [],
            outstandingFees: 0,
            feeCount: 0,
            unpaidFeeCount: 0,
            residences: null,
          }));

          toast.success(`Successfully imported ${successCount} resident(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}`);
          onSuccess(importedResidents);
          handleClose();
        } else {
          toast.error('Failed to import any residents');
          if (result.results.failed.length > 0) {
            setErrors(result.results.failed.map(f => `${f.data.full_name}: ${f.error}`));
          }
        }
      } else {
        toast.error(result.error || 'Failed to import residents');
      }
    } catch (error: any) {
      console.error('[ExcelImportDialog] Error importing:', error);
      toast.error('Failed to import residents: ' + (error.message || 'Unknown error'));
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Residents from Excel
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx, .xls) or CSV file to bulk import residents. Download the template for the correct format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div>
              <p className="font-medium text-sm">Need a template?</p>
              <p className="text-xs text-muted-foreground">Download our Excel template with example data</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Excel File</label>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                disabled={importing}
                className="hidden"
                id="excel-file-input"
              />
              <label
                htmlFor="excel-file-input"
                className="flex-1 cursor-pointer"
              >
                <div className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary transition-colors">
                  <Upload className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {file ? file.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Excel (.xlsx, .xls) or CSV files only
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Preview</h4>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {preview.valid.length} valid
                  </span>
                  {preview.invalid.length > 0 && (
                    <span className="text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {preview.invalid.length} invalid
                    </span>
                  )}
                </div>
              </div>

              {preview.valid.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Apartment</th>
                        <th className="px-3 py-2 text-left">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.valid.slice(0, 10).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{r.full_name}</td>
                          <td className="px-3 py-2">{r.email}</td>
                          <td className="px-3 py-2">{r.apartment_number}</td>
                          <td className="px-3 py-2">{r.role || 'resident'}</td>
                        </tr>
                      ))}
                      {preview.valid.length > 10 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-center text-muted-foreground text-xs">
                            ... and {preview.valid.length - 10} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.invalid.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="max-h-32 overflow-y-auto">
                      <p className="font-medium mb-2">Invalid rows:</p>
                      <ul className="text-xs space-y-1">
                        {preview.invalid.slice(0, 5).map((item, i) => (
                          <li key={i}>
                            Row {item.row}: {item.error}
                          </li>
                        ))}
                        {preview.invalid.length > 5 && (
                          <li>... and {preview.invalid.length - 5} more errors</li>
                        )}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importing residents...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={importing}>
            {importing ? 'Importing...' : 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={importing || parsedData.length === 0}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Import {parsedData.length} Resident(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

