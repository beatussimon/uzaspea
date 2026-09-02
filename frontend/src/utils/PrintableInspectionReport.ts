import { InspectionRequest, fmtDate, fmtMoney } from '../types/inspection';
import { API_BASE_URL } from '../api';

export const printInspectionReport = (request: InspectionRequest) => {
  if (!request) return;

  const isPaid = request.payments?.some(p => p.stage === 'balance' && p.status === 'approved');
  if (!isPaid) {
    alert('Payment Required: Please pay the 70% final balance to unlock and print the official inspection certificate and report.');
    return;
  }

  const report = request.report;
  const bill = request.bill;
  const checkin = request.checkin;
  const assignment = request.assignment;

  const getImageUrl = (path: string | null | undefined) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const relative = path.startsWith('/') ? path : `/${path}`;
    return `${base}${relative}`;
  };

  const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://sokonimax.com'}/verify/${request.inspection_id}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(verifyUrl)}`;

  const responses = report?.responses || [];
  const criticalCount = responses.filter(r => r.severity === 'critical' && r.flagged).length;
  const majorCount = responses.filter(r => r.severity === 'major' && r.flagged).length;
  const advisoryCount = responses.filter(r => r.severity === 'advisory' && r.flagged).length;

  const verdict = report?.verdict?.toUpperCase() || 'PASS';
  const grade = report?.grade?.toUpperCase() || 'A';
  const score = report?.quality_score ? `${parseFloat(report.quality_score)}%` : '100%';

  const isPass = verdict === 'PASS';
  const isConditional = verdict === 'CONDITIONAL';

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>SokoniMax Official Inspection Certificate - ${request.inspection_id}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 14mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #111;
            background: #fff;
            margin: 0;
            padding: 0;
            font-size: 11.5px;
            line-height: 1.4;
          }
          .report-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 8px;
          }

          /* Header */
          .header-table {
            width: 100%;
            border-collapse: collapse;
            border-bottom: 2px solid #111;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .header-table td {
            vertical-align: middle;
          }
          .logo {
            height: 38px;
            max-width: 130px;
            width: auto;
            object-fit: contain;
          }
          .brand-title {
            font-size: 16px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0;
            color: #111;
          }
          .brand-subtitle {
            font-size: 10px;
            color: #4b5563;
            font-weight: 600;
            margin-top: 1px;
          }
          .report-id-box {
            text-align: right;
          }
          .report-id-tag {
            font-size: 12px;
            font-weight: 900;
            font-family: monospace;
            color: #111;
          }
          .report-date {
            font-size: 10px;
            color: #6b7280;
            margin-top: 1px;
          }

          /* 3-Column Info Grid */
          .info-grid {
            display: table;
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
          }
          .info-col {
            display: table-cell;
            width: 33.33%;
            padding: 8px 10px;
            vertical-align: top;
            border-right: 1px solid #e5e7eb;
          }
          .info-col:last-child {
            border-right: none;
          }
          .info-heading {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6b7280;
            margin-bottom: 3px;
          }
          .info-val-primary {
            font-size: 11.5px;
            font-weight: 800;
            color: #111;
          }
          .info-val-secondary {
            font-size: 10.5px;
            color: #374151;
            margin-top: 2px;
          }
          .marketplace-tag {
            display: inline-block;
            margin-top: 3px;
            padding: 1px 5px;
            background: #fef3c7;
            color: #92400e;
            border-radius: 3px;
            font-size: 9.5px;
            font-weight: 700;
          }

          /* Compact Verdict & Grade Banner */
          .verdict-banner {
            display: table;
            width: 100%;
            border: 1.5px solid ${isPass ? '#10b981' : isConditional ? '#f59e0b' : '#ef4444'};
            background: ${isPass ? '#f0fdf4' : isConditional ? '#fffbeb' : '#fef2f2'};
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 12px;
          }
          .grade-col {
            display: table-cell;
            width: 75px;
            vertical-align: middle;
            text-align: center;
            border-right: 1px solid ${isPass ? '#bbf7d0' : isConditional ? '#fde68a' : '#fecaca'};
            padding-right: 10px;
          }
          .grade-letter {
            font-size: 24px;
            font-weight: 900;
            line-height: 1;
            color: ${isPass ? '#047857' : isConditional ? '#b45309' : '#b91c1c'};
          }
          .grade-score {
            font-size: 9.5px;
            font-weight: 800;
            color: #4b5563;
            margin-top: 2px;
          }
          .verdict-details-col {
            display: table-cell;
            vertical-align: middle;
            padding-left: 12px;
          }
          .verdict-title {
            font-size: 12.5px;
            font-weight: 900;
            text-transform: uppercase;
            color: ${isPass ? '#047857' : isConditional ? '#b45309' : '#b91c1c'};
          }
          .verdict-summary {
            font-size: 10.5px;
            color: #374151;
            margin-top: 2px;
          }

          /* Defect Summary Strip */
          .defect-bar {
            display: table;
            width: 100%;
            margin-bottom: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            background: #fff;
          }
          .defect-item {
            display: table-cell;
            width: 33.33%;
            padding: 6px 10px;
            text-align: center;
            border-right: 1px solid #e5e7eb;
          }
          .defect-item:last-child {
            border-right: none;
          }
          .defect-count {
            font-size: 13px;
            font-weight: 900;
          }
          .defect-count.critical { color: #dc2626; }
          .defect-count.major { color: #d97706; }
          .defect-count.advisory { color: #ca8a04; }
          .defect-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            color: #6b7280;
          }

          /* Checklist Table - Primary Focus */
          .section-title {
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #111;
            margin: 12px 0 5px 0;
            padding-bottom: 3px;
            border-bottom: 1.5px solid #e5e7eb;
          }
          .checklist-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }
          .checklist-table th {
            background: #f3f4f6;
            color: #374151;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            text-align: left;
            padding: 5px 7px;
            border: 1px solid #e5e7eb;
          }
          .checklist-table td {
            padding: 5px 7px;
            border: 1px solid #e5e7eb;
            font-size: 10.5px;
            vertical-align: top;
          }
          .badge-pass {
            display: inline-block;
            padding: 1px 5px;
            font-size: 9px;
            font-weight: 800;
            color: #047857;
            background: #d1fae5;
            border-radius: 3px;
            text-transform: uppercase;
          }
          .badge-fail {
            display: inline-block;
            padding: 1px 5px;
            font-size: 9px;
            font-weight: 800;
            color: #b91c1c;
            background: #fee2e2;
            border-radius: 3px;
            text-transform: uppercase;
          }
          .badge-severity {
            display: inline-block;
            padding: 1px 4px;
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            border-radius: 3px;
          }
          .badge-severity.critical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
          .badge-severity.major { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
          .badge-severity.advisory { background: #fefce8; color: #ca8a04; border: 1px solid #fef08a; }

          /* Photo Evidence Thumbnails - Neat and Small */
          .photo-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 12px;
          }
          .photo-card {
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
            background: #f9fafb;
            text-align: center;
            width: 72px;
          }
          .photo-img {
            width: 72px;
            height: 54px;
            object-fit: cover;
            display: block;
          }
          .photo-caption {
            padding: 2px;
            font-size: 8px;
            font-weight: 700;
            color: #374151;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Verification & QR Code Box */
          .verify-box {
            border: 1px solid #e5e7eb;
            background: #f9fafb;
            border-radius: 6px;
            padding: 8px 12px;
            margin-top: 10px;
            margin-bottom: 12px;
            display: table;
            width: 100%;
          }
          .verify-qr-cell {
            display: table-cell;
            width: 60px;
            vertical-align: middle;
            padding-right: 10px;
          }
          .verify-qr-img {
            width: 54px;
            height: 54px;
            display: block;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            background: #fff;
            padding: 2px;
          }
          .verify-info-cell {
            display: table-cell;
            vertical-align: middle;
          }
          .verify-title {
            font-size: 10.5px;
            font-weight: 800;
            color: #059669;
            text-transform: uppercase;
          }
          .verify-sub {
            font-size: 9.5px;
            color: #4b5563;
            margin-top: 2px;
          }

          /* Footer */
          .report-footer {
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1.5px solid #111;
            display: table;
            width: 100%;
          }
          .footer-left {
            display: table-cell;
            vertical-align: top;
            font-size: 9px;
            color: #6b7280;
            width: 70%;
          }
          .footer-right {
            display: table-cell;
            vertical-align: top;
            text-align: right;
            font-size: 9px;
            color: #374151;
            width: 30%;
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          
          <!-- Header -->
          <table class="header-table">
            <tr>
              <td style="width: 130px;">
                <img src="/logo_dark.png" alt="SokoniMax" class="logo" onerror="this.style.display='none'" />
              </td>
              <td style="padding-left: 12px;">
                <h1 class="brand-title">SokoniMax Inspection Certificate</h1>
                <div class="brand-subtitle">Official Physical Verification & Quality Assurance Report</div>
              </td>
              <td class="report-id-box">
                <div class="report-id-tag">${request.inspection_id}</div>
                <div class="report-date">Issued: ${fmtDate(report?.approved_at || request.created_at)}</div>
              </td>
            </tr>
          </table>

          <!-- 3-Column Metadata Grid -->
          <div class="info-grid">
            <div class="info-col">
              <div class="info-heading">Item Under Inspection</div>
              <div class="info-val-primary">${request.item_name}</div>
              <div class="info-val-secondary">${request.category_path || request.category_name || 'General Category'}</div>
              ${request.product_snapshot ? `<div class="marketplace-tag">🛍️ Marketplace Item #${request.product_snapshot.id} (${fmtMoney(request.product_snapshot.price)})</div>` : ''}
              ${request.item_age_years ? `<div class="info-val-secondary">Age: ${request.item_age_years} years</div>` : ''}
              <div class="info-val-secondary">Location: ${request.item_address || 'N/A'}</div>
            </div>

            <div class="info-col">
              <div class="info-heading">Client & Order Details</div>
              <div class="info-val-primary">Client: @${request.client_username || 'Client'}</div>
              <div class="info-val-secondary">Scope: <strong>${request.scope.toUpperCase()}</strong></div>
              <div class="info-val-secondary">Turnaround: <strong>${request.turnaround.toUpperCase()}</strong></div>
              ${bill ? `<div class="info-val-secondary">Inspection Fee: ${fmtMoney(bill.total_amount, bill.currency)}</div>` : ''}
            </div>

            <div class="info-col">
              <div class="info-heading">Inspector & QA Details</div>
              <div class="info-val-primary">${assignment?.inspector_name || 'Certified Inspector'}</div>
              <div class="info-val-secondary">Inspector Level: <span style="text-transform: capitalize;">${assignment?.inspector_level || 'Specialist'}</span></div>
              <div class="info-val-secondary">Approved By: @${report?.approved_by_username || 'qa_team'}</div>
              <div class="info-val-secondary">Status: <strong>${request.status.replace('_', ' ').toUpperCase()}</strong></div>
            </div>
          </div>

          <!-- Compact Verdict Banner -->
          <div class="verdict-banner">
            <div class="grade-col">
              <div class="grade-letter">${grade}</div>
              <div class="grade-score">${score}</div>
            </div>
            <div class="verdict-details-col">
              <div class="verdict-title">${verdict} • QUALITY GRADE ${grade}</div>
              <div class="verdict-summary">${report?.summary || 'The item has undergone thorough inspection across physical and functional checkpoints.'}</div>
            </div>
          </div>

          <!-- Defect Summary Strip -->
          <div class="defect-bar">
            <div class="defect-item">
              <div class="defect-count critical">${criticalCount}</div>
              <div class="defect-label">Critical Defects</div>
            </div>
            <div class="defect-item">
              <div class="defect-count major">${majorCount}</div>
              <div class="defect-label">Major Defects</div>
            </div>
            <div class="defect-item">
              <div class="defect-count advisory">${advisoryCount}</div>
              <div class="defect-label">Advisory Items</div>
            </div>
          </div>

          <!-- Checklist Findings Table - Front & Center -->
          <div class="section-title">Checklist Breakdown & Findings</div>
          <table class="checklist-table">
            <thead>
              <tr>
                <th style="width: 25%;">Section & Checkpoint</th>
                <th style="width: 12%;">Severity</th>
                <th style="width: 13%;">Result</th>
                <th style="width: 50%;">Inspector Findings / Notes</th>
              </tr>
            </thead>
            <tbody>
              ${responses.length === 0 ? `
                <tr><td colspan="4" style="text-align:center; color:#9ca3af; padding: 10px;">No checklist responses recorded.</td></tr>
              ` : responses.map(r => `
                <tr>
                  <td>
                    <strong>${r.item_label}</strong>
                    <div style="font-size: 9px; color: #6b7280;">${r.section || 'General'}</div>
                  </td>
                  <td>
                    <span class="badge-severity ${r.severity}">${r.severity}</span>
                  </td>
                  <td>
                    <span class="${r.flagged ? 'badge-fail' : 'badge-pass'}">
                      ${r.flagged ? '✕ FAIL' : '✓ PASS'}
                    </span>
                  </td>
                  <td>
                    ${r.notes || '<span style="color:#9ca3af;">Satisfactory — No issues observed</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Photo Documentation (Small & Non-Cropped) -->
          ${request.evidence && request.evidence.length > 0 ? `
            <div class="section-title">Photo Documentation (${request.evidence.length} photos)</div>
            <div class="photo-grid">
              ${request.evidence.slice(0, 8).map((ev) => `
                <div class="photo-card">
                  <img src="${getImageUrl(ev.image)}" alt="${ev.caption || 'Evidence'}" class="photo-img" />
                  <div class="photo-caption">${ev.item_label || ev.caption || 'Evidence'}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- QR Verification Box (Takes user to this exact inspection) -->
          <div class="verify-box">
            <div class="verify-qr-cell">
              <img src="${qrCodeUrl}" alt="QR Verification" class="verify-qr-img" />
            </div>
            <div class="verify-info-cell">
              <div class="verify-title">✓ Verified SokoniMax Inspection Certificate</div>
              <div class="verify-sub">
                Scan this QR code with any phone camera to view and verify this official certificate online.
              </div>
              <div class="verify-sub" style="font-size: 8.5px; color: #6b7280; margin-top: 2px;">
                Direct URL: <strong>${verifyUrl}</strong>
                ${checkin?.checkin_at ? ` • On-Site Verified: ${fmtDate(checkin.checkin_at)}` : ''}
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="report-footer">
            <div class="footer-left">
              <div><strong>SokoniMax Verified Quality Assurance</strong></div>
              <div>This document certifies that the item was physically examined by a SokoniMax-certified inspector.</div>
            </div>
            <div class="footer-right">
              <div>Signed by: <strong>@${report?.approved_by_username || 'qa_team'}</strong></div>
              <div style="font-size: 8.5px; color: #6b7280;">SokoniMax QA Authority</div>
            </div>
          </div>

        </div>
        <script>
          // Use multiple strategies to ensure print fires reliably
          function triggerPrint() {
            setTimeout(function() { window.print(); }, 300);
          }
          if (document.readyState === 'complete') {
            triggerPrint();
          } else {
            window.addEventListener('load', triggerPrint);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
  // Fallback: if onload doesn't fire, trigger after a delay
  setTimeout(() => {
    try { printWindow.print(); } catch(e) { /* already printed */ }
  }, 800);
};
