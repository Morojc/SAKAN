'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Building2, Download, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { generateResidenceQRCode, regenerateResidenceQRCode } from '@/app/actions/qr-code';
import toast from 'react-hot-toast';

interface QRCodeGeneratorProps {
  residenceName: string;
  residenceId: number;
  primaryColor?: string;
}

export default function QRCodeGenerator({
  residenceName,
  residenceId,
  primaryColor = '#1e40af'
}: QRCodeGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadQRCode();
  }, []);

  const loadQRCode = async () => {
    setLoading(true);
    const result = await generateResidenceQRCode();
    
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      setQrCodeUrl(result.data.registrationUrl);
    }
    setLoading(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    const result = await regenerateResidenceQRCode();
    
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      setQrCodeUrl(result.data.registrationUrl);
      toast.success('QR code regenerated successfully!');
    }
    setRegenerating(false);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(qrCodeUrl);
    setCopied(true);
    toast.success('URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsPNG = async () => {
    const element = document.getElementById('qr-code-container');
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 3,
      backgroundColor: '#ffffff'
    });
    
    const link = document.createElement('a');
    link.download = `${residenceName.replace(/\s+/g, '-')}-QR-Code.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('QR code downloaded as PNG!');
  };

  const downloadAsPDF = async () => {
    const element = document.getElementById('qr-code-container');
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 3,
      backgroundColor: '#ffffff'
    });
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = 150;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const x = (pdfWidth - imgWidth) / 2;
    const y = (pdfHeight - imgHeight) / 2;
    
    pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    pdf.save(`${residenceName.replace(/\s+/g, '-')}-QR-Code.pdf`);
    toast.success('QR code downloaded as PDF!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* QR Code Display */}
      <div 
        id="qr-code-container" 
        className="bg-white p-8 rounded-lg shadow-lg max-w-md mx-auto"
        style={{ borderTop: `4px solid ${primaryColor}` }}
      >
        {/* Header */}
        <div className="text-center space-y-3 mb-6">
          <Building2 
            className="w-16 h-16 mx-auto" 
            style={{ color: primaryColor }} 
          />
          
          <div>
            <h2 
              className="text-2xl font-bold"
              style={{ color: primaryColor }}
            >
              {residenceName}
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Residence ID: #{residenceId}
            </p>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
            <QRCodeSVG
              value={qrCodeUrl}
              size={280}
              level="H"
              includeMargin={false}
              fgColor={primaryColor}
              bgColor="#ffffff"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p 
            className="text-xl font-bold"
            style={{ color: primaryColor }}
          >
            📱 SCAN TO REGISTER 📱
          </p>
          <p className="text-gray-600 text-sm">
            New Residents Welcome
          </p>
        </div>
      </div>

      {/* URL Display */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={qrCodeUrl}
            readOnly
            className="flex-1 px-3 py-2 bg-gray-50 border rounded-md text-sm font-mono"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="gap-2"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Share this URL directly or use the QR code
        </p>
      </Card>

      {/* Download Actions */}
      <div className="flex gap-3 justify-center flex-wrap">
        <Button onClick={downloadAsPNG} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Download PNG
        </Button>
        <Button onClick={downloadAsPDF} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Download PDF
        </Button>
        <Button 
          onClick={handleRegenerate} 
          variant="outline" 
          className="gap-2"
          disabled={regenerating}
        >
          <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
          Regenerate
        </Button>
      </div>

      {/* Warning */}
      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Warning:</strong> Regenerating the QR code will invalidate the old one. 
          Share the new code with residents after regeneration.
        </p>
      </Card>
    </div>
  );
}

