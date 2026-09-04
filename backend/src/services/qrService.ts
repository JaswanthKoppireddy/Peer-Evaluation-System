/**
 * Boilerplate for QR Code Logic vs Auto-ID logic.
 */
export const generateSubmissionId = (type: 'Portal' | 'PDF'): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  
  if (type === 'PDF') {
    // In a real scenario, this would generate a QR code image buffer or URL
    // linking to the specific PDF path for bulk scanning.
    return `QR-PDF-${timestamp}-${randomStr}`.toUpperCase();
  } else {
    // Auto-ID generation for Direct Portal uploads
    return `PORTAL-${timestamp}-${randomStr}`.toUpperCase();
  }
};
