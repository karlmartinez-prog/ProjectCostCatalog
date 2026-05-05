import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'  // ✅ named default import — patches correctly in Vite

// ── Brand colors (warm beige / gold palette) ─────────
const COLOR = {
    gold: [201, 168, 76],
    goldLight: [245, 238, 213],
    darkText: [26, 25, 23],
    mutedText: [122, 120, 114],
    lightBg: [250, 248, 245],
    white: [255, 255, 255],
    blue: [37, 99, 235],
    purple: [139, 92, 246],
    border: [232, 229, 222],
}

// ── Formatters ────────────────────────────────────────
// PDF-safe currency formatter — jsPDF's built-in helvetica font does not support
// the Philippine Peso sign (₱) or other non-latin currency glyphs, causing them
// to render as ± and & garbage. We format as a plain number and prepend the
// currency code instead (e.g. "PHP 1,234.56").
function fmtCost(amount, currency = 'PHP') {
    const num = new Intl.NumberFormat('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount || 0)
    return `${currency} ${num}`
}

function fmtDate(d) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-PH', {
        month: 'long', day: 'numeric', year: 'numeric',
    })
}

function fmtDateShort(d) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
    })
}

function getDuration(start, end) {
    if (!start || !end) return null
    const days = Math.round((new Date(end) - new Date(start)) / 86400000)
    if (days < 30) return `${days} days`
    if (days < 365) return `${Math.floor(days / 30)} months`
    return `${(days / 365).toFixed(1)} years`
}

function slugify(str) {
    return (str || 'project')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

function today() {
    return new Date().toISOString().slice(0, 10)
}

// ── Qty / Duration label (plain text for PDF/CSV) ─────
function qtyLabelText(item) {
    const u = (item._resolvedUnit || '').toLowerCase()
    const duration = item._duration
    const qty = item.quantity ?? 1
    const isLabor = item.resource_type === 'Labor' || item.resources?.resource_type === 'Labor'

    if (duration === null) return String(qty)

    const unitWord = u.includes('week') ? 'wk'
        : u.includes('month') ? 'mo'
            : 'day'

    const who = isLabor
        ? `${qty} worker${qty !== 1 ? 's' : ''}`
        : `${qty} unit${qty !== 1 ? 's' : ''}`

    return `${who} × ${duration} ${unitWord}${duration !== 1 ? 's' : ''}`
}

// ─────────────────────────────────────────────────────
// PDF EXPORT
// ─────────────────────────────────────────────────────
export async function exportToPDF({
    project,
    displayItems,
    inflationOn,
    projectBaseYear,
    currentYear,
    capexTotal,
    opexTotal,
    otherTotal,
    laborTotal,
    grandTotal,
}) {
    const currency = project.currency || 'PHP'
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const PW = doc.internal.pageSize.getWidth()
    const PH = doc.internal.pageSize.getHeight()
    const ML = 14
    const MR = 14
    const CW = PW - ML - MR

    function fillRect(x, y, w, h, rgb) {
        doc.setFillColor(...rgb)
        doc.rect(x, y, w, h, 'F')
    }

    function drawPageHeader(pageNum, totalPages) {
        fillRect(0, 0, PW, 10, COLOR.gold)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...COLOR.white)
        doc.text(project.name || 'Project', ML, 6.8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(`Page ${pageNum} of ${totalPages}`, PW - MR, 6.8, { align: 'right' })
    }

    function drawPageFooter() {
        fillRect(0, PH - 8, PW, 8, COLOR.lightBg)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...COLOR.mutedText)
        const label = inflationOn
            ? `Inflation-adjusted | ${projectBaseYear} to ${currentYear} | Exported ${today()}`
            : `Exported ${today()}`
        doc.text(label, ML, PH - 3)
        doc.text('PROJECT COST CATALOG', PW - MR, PH - 3, { align: 'right' })
    }

    let curY = 14

    // ── Report title ──────────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...COLOR.gold)
    doc.text('Cost Estimate Report', ML, curY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...COLOR.mutedText)
    doc.text(`Generated ${fmtDate(new Date())}`, ML, curY + 6)
    curY += 14

    // ── Project name block ────────────────────────────
    fillRect(ML, curY, CW, 18, COLOR.goldLight)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...COLOR.darkText)
    doc.text(project.name || '-', ML + 5, curY + 7)
    if (project.description) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...COLOR.mutedText)
        const descLines = doc.splitTextToSize(project.description, CW - 10)
        doc.text(descLines, ML + 5, curY + 13)
        curY += Math.max(18, 18 + (descLines.length - 1) * 4)
    } else {
        curY += 22
    }

    // ── Status / Currency ─────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR.mutedText)
    doc.text(`STATUS: ${(project.status || '').toUpperCase()}`, ML, curY)
    doc.text(`CURRENCY: ${currency}`, ML + 50, curY)
    curY += 8

    // ── Stat strip ────────────────────────────────────
    const stats = [
        { label: inflationOn ? `Adjusted Total (${projectBaseYear} to ${currentYear})` : 'Grand Total', value: fmtCost(grandTotal, currency), highlight: true },
        { label: 'CAPEX', value: fmtCost(capexTotal, currency) },
        { label: 'OPEX', value: fmtCost(opexTotal, currency) },
    ]
    if (laborTotal > 0) stats.push({ label: 'Labor', value: fmtCost(laborTotal, currency) })
    if (inflationOn) stats.push({ label: `Original (${projectBaseYear})`, value: fmtCost(project.total_cost, currency) })

    const statW = CW / stats.length
    stats.forEach((stat, i) => {
        const sx = ML + i * statW
        fillRect(sx, curY, statW - 2, 16, stat.highlight ? COLOR.goldLight : [244, 242, 238])
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(stat.highlight ? 11 : 9.5)
        doc.setTextColor(...COLOR.darkText)
        doc.text(stat.value, sx + (statW - 2) / 2, curY + 7, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...COLOR.mutedText)
        doc.text(stat.label, sx + (statW - 2) / 2, curY + 13, { align: 'center' })
    })
    curY += 22

    // ── Timeline section ──────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.gold)
    doc.text('TIMELINE', ML, curY)
    curY += 4
    doc.setDrawColor(...COLOR.gold)
    doc.setLineWidth(0.4)
    doc.line(ML, curY, ML + CW, curY)
    curY += 4

    const timelineCols = [
        ['Start Date', fmtDate(project.start_date)],
        ['End Date', fmtDate(project.end_date)],
        ['Duration', getDuration(project.start_date, project.end_date) || '-'],
        ['Resources', `${displayItems.length} item${displayItems.length !== 1 ? 's' : ''}`],
    ]
    const tlColW = CW / timelineCols.length
    timelineCols.forEach(([label, value], i) => {
        const tx = ML + i * tlColW
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...COLOR.mutedText)
        doc.text(label, tx, curY + 3)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...COLOR.darkText)
        doc.text(value, tx, curY + 9)
    })
    curY += 16

    // ── Suppliers section ─────────────────────────────
    const uniqueSuppliers = Array.from(
        new Map(
            displayItems
                .filter(i => i.resources?.suppliers)
                .map(i => [i.resources.suppliers.id, i.resources.suppliers])
        ).values()
    )

    if (uniqueSuppliers.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...COLOR.gold)
        doc.text('SUPPLIERS', ML, curY)
        curY += 4
        doc.setDrawColor(...COLOR.gold)
        doc.line(ML, curY, ML + CW, curY)
        curY += 5

        const supColW = CW / Math.min(uniqueSuppliers.length, 4)
        uniqueSuppliers.forEach((s, i) => {
            if (i >= 4) return
            const sx = ML + i * supColW
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8.5)
            doc.setTextColor(...COLOR.darkText)
            doc.text(s.name, sx, curY)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7.5)
            doc.setTextColor(...COLOR.mutedText)
            let lineY = curY + 4.5
            if (s.contact_email) { doc.text(s.contact_email, sx, lineY); lineY += 4 }
            if (s.phone) { doc.text(s.phone, sx, lineY); lineY += 4 }
            if (s.website) { doc.text(s.website.replace(/^https?:\/\//, ''), sx, lineY) }
        })
        curY += 20
    }

    // ── Cost breakdown heading ────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.gold)
    doc.text('COST BREAKDOWN', ML, curY)
    curY += 4
    doc.setDrawColor(...COLOR.gold)
    doc.line(ML, curY, ML + CW, curY)
    curY += 3

    // ── Build table data ──────────────────────────────
    const hasSupplierCol = uniqueSuppliers.length > 0
    const head = [[
        'Resource', 'Category', 'Type',
        hasSupplierCol ? 'Supplier' : null,
        'Qty / Duration', 'Unit Cost',
        inflationOn ? 'Original' : null,
        'Subtotal',
    ].filter(Boolean)]

    const body = displayItems.map(item => {
        const supplier = item.resources?.suppliers
        return [
            item.resources?.name || item.custom_name || 'Custom resource',
            item.resources?.categories?.name || '-',
            item.capex_opex || '-',
            hasSupplierCol ? (supplier?.name || '-') : null,
            qtyLabelText(item),
            fmtCost(item.display_unit_cost, currency),
            inflationOn ? fmtCost(item.unit_cost_snapshot, currency) : null,
            fmtCost(item.display_total, currency),
        ].filter(v => v !== null)
    })

    // Summary footer rows
    const colCount = head[0].length
    const summaryRows = []

    const addSummaryRow = (label, value, style = {}) => {
        summaryRows.push([
            { content: label, colSpan: colCount - 1, styles: { fontStyle: 'italic', fillColor: COLOR.lightBg, ...style } },
            { content: value, styles: { fontStyle: 'italic', fillColor: COLOR.lightBg, halign: 'right', ...style } },
        ])
    }

    if (laborTotal > 0) addSummaryRow('Labor subtotal', fmtCost(laborTotal, currency))
    if (capexTotal > 0) addSummaryRow('CAPEX subtotal', fmtCost(capexTotal, currency))
    if (opexTotal > 0) addSummaryRow('OPEX subtotal', fmtCost(opexTotal, currency))
    if (otherTotal > 0) addSummaryRow('Untagged subtotal', fmtCost(otherTotal, currency))

    const grandLabel = inflationOn
        ? `Adjusted Grand Total (${projectBaseYear} to ${currentYear})`
        : 'Grand Total'
    summaryRows.push([
        { content: grandLabel, colSpan: colCount - 1, styles: { fontStyle: 'bold', fillColor: COLOR.goldLight, textColor: COLOR.darkText } },
        { content: fmtCost(grandTotal, currency), styles: { fontStyle: 'bold', fillColor: COLOR.goldLight, textColor: COLOR.darkText, halign: 'right' } },
    ])
    if (inflationOn) {
        summaryRows.push([
            { content: `Original Total (${projectBaseYear})`, colSpan: colCount - 1, styles: { fontStyle: 'normal', fillColor: COLOR.lightBg, textColor: COLOR.mutedText } },
            { content: fmtCost(project.total_cost, currency), styles: { fontStyle: 'normal', fillColor: COLOR.lightBg, textColor: COLOR.mutedText, halign: 'right' } },
        ])
    }

    // ✅ Key fix: call autoTable(doc, options) — NOT doc.autoTable(options)
    autoTable(doc, {
        startY: curY,
        head,
        body: [...body, ...summaryRows],
        margin: { left: ML, right: MR },
        styles: {
            fontSize: 8,
            cellPadding: 2.5,
            textColor: COLOR.darkText,
            lineColor: COLOR.border,
            lineWidth: 0.1,
        },
        headStyles: {
            fillColor: COLOR.darkText,
            textColor: COLOR.white,
            fontStyle: 'bold',
            fontSize: 8,
        },
        alternateRowStyles: {
            fillColor: [250, 248, 245],
        },
        columnStyles: {
            [colCount - 1]: { halign: 'right', fontStyle: 'bold' },
            [colCount - 2]: { halign: 'right' },
            ...(inflationOn ? { [colCount - 3]: { halign: 'right', textColor: COLOR.mutedText } } : {}),
        },
        didDrawPage: () => {
            const pageNum = doc.internal.getCurrentPageInfo().pageNumber
            const totalPgs = doc.internal.getNumberOfPages()
            drawPageHeader(pageNum, totalPgs)
            drawPageFooter()
        },
    })

    // Fix headers/footers now that total page count is known
    const totalPages = doc.internal.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        drawPageHeader(p, totalPages)
        drawPageFooter()
    }

    doc.save(`${slugify(project.name)}-${today()}.pdf`)
}

// ─────────────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────────────
export function exportToCSV({
    project,
    displayItems,
    inflationOn,
    projectBaseYear,
    currentYear,
    capexTotal,
    opexTotal,
    otherTotal,
    laborTotal,
    grandTotal,
}) {
    const currency = project.currency || 'PHP'
    const rows = []

    rows.push(['PROJECT COST CATALOG EXPORT'])
    rows.push([''])
    rows.push(['Project Name', project.name || ''])
    rows.push(['Status', project.status || ''])
    rows.push(['Currency', currency])
    rows.push(['Start Date', fmtDateShort(project.start_date)])
    rows.push(['End Date', fmtDateShort(project.end_date)])
    rows.push(['Duration', getDuration(project.start_date, project.end_date) || '-'])
    rows.push(['Export Date', fmtDateShort(new Date())])
    if (inflationOn) rows.push(['Inflation Adjustment', `${projectBaseYear} → ${currentYear}`])
    rows.push([''])

    const uniqueSuppliers = Array.from(
        new Map(
            displayItems
                .filter(i => i.resources?.suppliers)
                .map(i => [i.resources.suppliers.id, i.resources.suppliers])
        ).values()
    )

    if (uniqueSuppliers.length > 0) {
        rows.push(['SUPPLIERS'])
        rows.push(['Name', 'Email', 'Phone', 'Website'])
        uniqueSuppliers.forEach(s => {
            rows.push([s.name, s.contact_email || '', s.phone || '', s.website || ''])
        })
        rows.push([''])
    }

    rows.push(['COST BREAKDOWN'])
    const headers = [
        'Resource', 'Category', 'CAPEX/OPEX', 'Supplier', 'Resource Type', 'Qty / Duration',
        inflationOn ? `Unit Cost (Adjusted ${currentYear})` : 'Unit Cost',
        inflationOn ? `Unit Cost (Original ${projectBaseYear})` : null,
        inflationOn ? `Subtotal (Adjusted ${currentYear})` : 'Subtotal',
        inflationOn ? `Subtotal (Original ${projectBaseYear})` : null,
    ].filter(Boolean)
    rows.push(headers)

    displayItems.forEach(item => {
        const supplier = item.resources?.suppliers
        const duration = item._duration
        const originalSubtotal = duration !== null
            ? item.unit_cost_snapshot * (item.quantity ?? 1) * duration
            : item.unit_cost_snapshot * (item.quantity ?? 1)

        const row = [
            item.resources?.name || item.custom_name || 'Custom resource',
            item.resources?.categories?.name || '-',
            item.capex_opex || '-',
            supplier?.name || '-',
            item.resource_type || item.resources?.resource_type || '-',
            qtyLabelText(item),
            item.display_unit_cost,
            inflationOn ? item.unit_cost_snapshot : null,
            item.display_total,
            inflationOn ? originalSubtotal : null,
        ].filter(v => v !== null)
        rows.push(row)
    })

    rows.push([''])
    rows.push(['SUMMARY'])
    if (laborTotal > 0) rows.push(['Labor subtotal', '', '', '', '', '', '', fmtCost(laborTotal, currency)])
    if (capexTotal > 0) rows.push(['CAPEX subtotal', '', '', '', '', '', '', fmtCost(capexTotal, currency)])
    if (opexTotal > 0) rows.push(['OPEX subtotal', '', '', '', '', '', '', fmtCost(opexTotal, currency)])
    if (otherTotal > 0) rows.push(['Untagged subtotal', '', '', '', '', '', '', fmtCost(otherTotal, currency)])

    const grandLabel = inflationOn ? `Adjusted Grand Total (${projectBaseYear} → ${currentYear})` : 'Grand Total'
    rows.push([grandLabel, '', '', '', '', '', '', fmtCost(grandTotal, currency)])
    if (inflationOn) rows.push([`Original Total (${projectBaseYear})`, '', '', '', '', '', '', fmtCost(project.total_cost, currency)])

    const escape = val => {
        const str = val == null ? '' : String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
        }
        return str
    }

    const csv = rows.map(row => row.map(escape).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(project.name)}-${today()}.csv`
    a.click()
    URL.revokeObjectURL(url)
}