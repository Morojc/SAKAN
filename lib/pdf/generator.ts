/**
 * PDF Generation Utility
 * Generates PDF receipts for cash payments
 * Uses pdf-lib for PDF generation
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ReceiptData {
	paymentId: number;
	residentName: string;
	apartmentNumber: string;
	amount: number;
	paymentDate: Date;
	receiptNumber: string;
	residenceName: string;
	residenceAddress: string;
	syndicName: string;
}

/**
 * Generate a cash payment receipt PDF
 */
export async function generateCashReceiptPDF(data: ReceiptData): Promise<Uint8Array> {
	try {
		console.log('[PDF Generator] Generating receipt for payment:', data.paymentId);

		// Create a new PDF document
		const pdfDoc = await PDFDocument.create();
		const page = pdfDoc.addPage([595, 842]); // A4 size in points
		const { width, height } = page.getSize();

		// Embed fonts
		const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
		const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

		// Define colors
		const primaryColor = rgb(0.2, 0.3, 0.5); // Dark blue
		const textColor = rgb(0.2, 0.2, 0.2); // Dark gray
		const accentColor = rgb(0.4, 0.6, 0.8); // Light blue

		// Header
		let yPosition = height - 80;

		// Title
		page.drawText('REÇU DE PAIEMENT / PAYMENT RECEIPT', {
			x: 50,
			y: yPosition,
			size: 20,
			font: fontBold,
			color: primaryColor,
		});

		yPosition -= 10;
		page.drawLine({
			start: { x: 50, y: yPosition },
			end: { x: width - 50, y: yPosition },
			thickness: 2,
			color: accentColor,
		});

		yPosition -= 40;

		// Receipt number and date
		page.drawText(`Reçu N°: ${data.receiptNumber}`, {
			x: 50,
			y: yPosition,
			size: 11,
			font: fontBold,
			color: textColor,
		});

		page.drawText(
			`Date: ${data.paymentDate.toLocaleDateString('fr-FR', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			})}`,
			{
				x: width - 250,
				y: yPosition,
				size: 11,
				font: font,
				color: textColor,
			}
		);

		yPosition -= 40;

		// Residence information
		page.drawText('RÉSIDENCE / RESIDENCE', {
			x: 50,
			y: yPosition,
			size: 12,
			font: fontBold,
			color: primaryColor,
		});

		yPosition -= 20;
		page.drawText(data.residenceName, {
			x: 50,
			y: yPosition,
			size: 11,
			font: fontBold,
			color: textColor,
		});

		yPosition -= 18;
		page.drawText(data.residenceAddress, {
			x: 50,
			y: yPosition,
			size: 10,
			font: font,
			color: textColor,
		});

		yPosition -= 40;

		// Resident information
		page.drawText('RÉSIDENT / RESIDENT', {
			x: 50,
			y: yPosition,
			size: 12,
			font: fontBold,
			color: primaryColor,
		});

		yPosition -= 20;
		page.drawText(`Nom / Name: ${data.residentName}`, {
			x: 50,
			y: yPosition,
			size: 11,
			font: font,
			color: textColor,
		});

		yPosition -= 18;
		page.drawText(`Appartement / Apartment: ${data.apartmentNumber}`, {
			x: 50,
			y: yPosition,
			size: 11,
			font: font,
			color: textColor,
		});

		yPosition -= 40;

		// Payment details
		page.drawText('DÉTAILS DU PAIEMENT / PAYMENT DETAILS', {
			x: 50,
			y: yPosition,
			size: 12,
			font: fontBold,
			color: primaryColor,
		});

		yPosition -= 25;

		// Amount box
		page.drawRectangle({
			x: 50,
			y: yPosition - 40,
			width: width - 100,
			height: 50,
			borderColor: accentColor,
			borderWidth: 2,
			color: rgb(0.95, 0.97, 1),
		});

		page.drawText('Montant / Amount:', {
			x: 70,
			y: yPosition - 15,
			size: 11,
			font: font,
			color: textColor,
		});

		page.drawText(`${data.amount.toFixed(2)} MAD`, {
			x: width - 200,
			y: yPosition - 15,
			size: 16,
			font: fontBold,
			color: primaryColor,
		});

		yPosition -= 60;
		page.drawText('Méthode / Method: Espèces / Cash', {
			x: 70,
			y: yPosition,
			size: 11,
			font: font,
			color: textColor,
		});

		yPosition -= 60;

		// Syndic signature
		page.drawText('VÉRIFIÉ PAR / VERIFIED BY', {
			x: 50,
			y: yPosition,
			size: 12,
			font: fontBold,
			color: primaryColor,
		});

		yPosition -= 20;
		page.drawText(data.syndicName, {
			x: 50,
			y: yPosition,
			size: 11,
			font: font,
			color: textColor,
		});

		yPosition -= 18;
		page.drawText('Syndic', {
			x: 50,
			y: yPosition,
			size: 10,
			font: font,
			color: textColor,
		});

		// Footer
		yPosition = 80;
		page.drawLine({
			start: { x: 50, y: yPosition },
			end: { x: width - 50, y: yPosition },
			thickness: 1,
			color: rgb(0.8, 0.8, 0.8),
		});

		yPosition -= 15;
		page.drawText('Ce reçu confirme le paiement en espèces. / This receipt confirms cash payment.', {
			x: 50,
			y: yPosition,
			size: 9,
			font: font,
			color: rgb(0.5, 0.5, 0.5),
		});

		// Serialize the PDF to bytes
		const pdfBytes = await pdfDoc.save();
		console.log('[PDF Generator] PDF generated successfully');

		return pdfBytes;
	} catch (error: any) {
		console.error('[PDF Generator] Error generating PDF:', error);
		throw new Error(`Failed to generate PDF: ${error.message}`);
	}
}

/**
 * Download PDF blob as file
 */
export function downloadPDF(pdfBytes: Uint8Array, filename: string) {
	try {
		console.log('[PDF Generator] Triggering download:', filename);

		const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		console.log('[PDF Generator] Download triggered successfully');
	} catch (error: any) {
		console.error('[PDF Generator] Error downloading PDF:', error);
		throw new Error(`Failed to download PDF: ${error.message}`);
	}
}

