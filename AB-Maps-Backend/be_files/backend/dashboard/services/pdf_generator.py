"""
PDF Generator Service

Assembles a multi-page analytics report using ReportLab.
Each public method returns a BytesIO buffer containing the finished PDF.

Sider:
    1. Oversiktspanel — KPI-kort, periodesammenligning, statusdiagram, terskeldetaljer
    2. Kampanjeoversikt — Tabell per kampanje + gruppert stolpediagram
    3. Ansatt-rangliste — Rangeringstabell + stolpediagrammer
    4. Kritiske varsler — Varselkort med individuelle trendgrafer
    5. Innsikt — Timeanalyse + anbefalinger

The class consumes output from AnalyticsCalculator, ThresholdEvaluator,
and GraphGenerator.
"""
import io
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from reportlab.lib import colors as rl_colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm, inch
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, SimpleDocTemplate, Spacer, Table,
    TableStyle, KeepTogether,
)

from dashboard.services.graph_generator import GraphGenerator, BrandColors


# ====================================================================== #
#  COLOUR HELPERS  (ReportLab colour objects)                             #
# ====================================================================== #

_hex = rl_colors.HexColor

C_PRIMARY    = _hex(BrandColors.PRIMARY)
C_SECONDARY  = _hex(BrandColors.SECONDARY)
C_ACCENT     = _hex(BrandColors.ACCENT)
C_DANGER     = _hex(BrandColors.DANGER)
C_WARNING    = _hex(BrandColors.WARNING)
C_NEUTRAL    = _hex(BrandColors.NEUTRAL)
C_LIGHT_BG   = _hex(BrandColors.LIGHT_BG)
C_TEXT       = _hex(BrandColors.TEXT)
C_MUTED      = _hex(BrandColors.MUTED_TEXT)
C_WHITE      = rl_colors.white
C_GRID       = _hex(BrandColors.GRID)

# Status colours
C_JA          = _hex(BrandColors.JA)
C_NEI         = _hex(BrandColors.NEI)
C_IKKE_HJEMME = _hex(BrandColors.IKKE_HJEMME)
C_FOLG_OPP    = _hex(BrandColors.FOLG_OPP)


# ====================================================================== #
#  CUSTOM STYLES                                                          #
# ====================================================================== #

def _build_styles():
    """Return a dictionary of custom ParagraphStyles."""
    base = getSampleStyleSheet()
    styles = {}

    styles['Title'] = ParagraphStyle(
        'ReportTitle',
        parent=base['Title'],
        fontSize=24,
        leading=28,
        textColor=C_PRIMARY,
        spaceAfter=6,
    )
    styles['Subtitle'] = ParagraphStyle(
        'ReportSubtitle',
        parent=base['Normal'],
        fontSize=11,
        leading=14,
        textColor=C_MUTED,
        spaceAfter=16,
    )
    styles['Heading1'] = ParagraphStyle(
        'H1',
        parent=base['Heading1'],
        fontSize=16,
        leading=20,
        textColor=C_PRIMARY,
        spaceBefore=12,
        spaceAfter=8,
    )
    styles['Heading2'] = ParagraphStyle(
        'H2',
        parent=base['Heading2'],
        fontSize=13,
        leading=16,
        textColor=C_SECONDARY,
        spaceBefore=10,
        spaceAfter=6,
    )
    styles['Body'] = ParagraphStyle(
        'BodyText',
        parent=base['Normal'],
        fontSize=9,
        leading=12,
        textColor=C_TEXT,
        spaceAfter=4,
    )
    styles['Small'] = ParagraphStyle(
        'SmallText',
        parent=base['Normal'],
        fontSize=8,
        leading=10,
        textColor=C_MUTED,
    )
    styles['AlertCritical'] = ParagraphStyle(
        'AlertCritical',
        parent=base['Normal'],
        fontSize=9,
        leading=12,
        textColor=C_DANGER,
        backColor=_hex('#FDEDEC'),
        borderPadding=(4, 6, 4, 6),
        spaceAfter=6,
    )
    styles['AlertWarning'] = ParagraphStyle(
        'AlertWarning',
        parent=base['Normal'],
        fontSize=9,
        leading=12,
        textColor=_hex('#7D6608'),
        backColor=_hex('#FEF9E7'),
        borderPadding=(4, 6, 4, 6),
        spaceAfter=6,
    )
    styles['AlertInfo'] = ParagraphStyle(
        'AlertInfo',
        parent=base['Normal'],
        fontSize=9,
        leading=12,
        textColor=C_SECONDARY,
        backColor=_hex('#EBF5FB'),
        borderPadding=(4, 6, 4, 6),
        spaceAfter=6,
    )
    styles['KpiValue'] = ParagraphStyle(
        'KpiValue',
        parent=base['Normal'],
        fontSize=20,
        leading=24,
        textColor=C_PRIMARY,
        alignment=TA_CENTER,
    )
    styles['KpiLabel'] = ParagraphStyle(
        'KpiLabel',
        parent=base['Normal'],
        fontSize=8,
        leading=10,
        textColor=C_MUTED,
        alignment=TA_CENTER,
    )
    return styles


# ====================================================================== #
#  PDF GENERATOR                                                          #
# ====================================================================== #

class PDFGenerator:
    """
    Builds a complete analytics PDF report.

    Usage:
        gen = PDFGenerator()
        buf = gen.generate_report(analytics_data, alerts, thresholds)
        # buf is a BytesIO containing the PDF
    """

    def __init__(self):
        self.graph = GraphGenerator()
        self.styles = _build_styles()
        self.page_width, self.page_height = A4  # 595.28 x 841.89 points
        self.margin = 1.8 * cm

    # ------------------------------------------------------------------ #
    #  PUBLIC API                                                         #
    # ------------------------------------------------------------------ #

    def generate_report(
        self,
        analytics_data: Dict[str, Any],
        alerts: List[Dict[str, Any]],
        threshold: Optional[Any] = None,
        report_title: str = 'Ukentlig Analyse Rapport',
    ) -> io.BytesIO:
        """
        Generate the full PDF report and return a BytesIO buffer.

        Parameters:
            analytics_data: output of AnalyticsCalculator.calculate_all()
            alerts: output of ThresholdEvaluator.evaluate_all()
            threshold: the resolved AnalyticsThreshold model (for red-line values)
            report_title: title printed on page 1
        """
        buf = io.BytesIO()

        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            topMargin=self.margin,
            bottomMargin=self.margin + 0.5 * cm,  # room for footer
            leftMargin=self.margin,
            rightMargin=self.margin,
            title=report_title,
            author='AB Maps System',
        )

        # Threshold values for graph red-lines
        doors_threshold = getattr(threshold, 'min_doors_per_day', 70) if threshold else 70
        yes_rate_threshold = float(getattr(threshold, 'min_yes_rate_percent', 30.0)) if threshold else 30.0
        no_rate_threshold = float(getattr(threshold, 'max_no_rate_percent', 50.0)) if threshold else 50.0

        # Build story (list of flowables)
        story = []

        # --- Side 1: Oversiktspanel ---
        story.extend(self._page_executive_dashboard(
            analytics_data, threshold, doors_threshold, yes_rate_threshold, report_title,
        ))
        story.append(PageBreak())

        # --- Side 2: Kampanjeoversikt ---
        story.extend(self._page_campaign_breakdown(analytics_data))
        story.append(PageBreak())

        # --- Side 3: Ansatt-rangliste ---
        story.extend(self._page_employee_leaderboard(
            analytics_data, doors_threshold, yes_rate_threshold,
        ))
        story.append(PageBreak())

        # --- Side 4: Kritiske varsler (kun hvis det finnes varsler) ---
        if alerts:
            story.extend(self._page_alerts(
                alerts, doors_threshold, yes_rate_threshold,
            ))
            story.append(PageBreak())

        # --- Side 5: Innsikt og anbefalinger ---
        story.extend(self._page_insights(
            analytics_data, alerts, doors_threshold, yes_rate_threshold,
        ))

        # Build PDF
        doc.build(story, onFirstPage=self._header_footer, onLaterPages=self._header_footer)
        buf.seek(0)
        return buf

    # ------------------------------------------------------------------ #
    #  SIDE 1: OVERSIKTSPANEL                                              #
    # ------------------------------------------------------------------ #

    def _page_executive_dashboard(
        self, data: Dict, threshold: Optional[Any],
        doors_threshold: int, yes_rate_threshold: float,
        report_title: str,
    ) -> list:
        """Bygg flytbare elementer for side 1."""
        story = []
        period = data.get('period', {})
        summary = data.get('summary', {})
        comparisons = data.get('comparisons', {})

        # Tittelboks
        story.append(Paragraph(report_title, self.styles['Title']))
        story.append(Paragraph(
            f"Periode: {period.get('start_date', '')} — {period.get('end_date', '')} "
            f"({period.get('days', 0)} dager)",
            self.styles['Subtitle'],
        ))
        story.append(Spacer(1, 4))

        # Terskeldetaljer for åpenhet
        story.extend(self._threshold_details_box(threshold, doors_threshold, yes_rate_threshold))
        story.append(Spacer(1, 6))

        # KPI-kort tabell
        story.append(self._kpi_table(summary, comparisons))
        story.append(Spacer(1, 10))

        # Periodesammenligning diagram
        if comparisons:
            img = self.graph.period_comparison_kpi(comparisons, figsize=(10, 2.2))
            story.append(self._chart_image(img, width=self.page_width - 2 * self.margin))
            story.append(Spacer(1, 8))

        # Statusfordeling sektordiagram
        if summary.get('total_doors', 0) > 0:
            story.append(Paragraph('Statusfordeling', self.styles['Heading2']))
            img = self.graph.status_breakdown_pie(summary, figsize=(7, 4.5))
            story.append(self._chart_image(img, width=14 * cm))

        return story

    # ------------------------------------------------------------------ #
    #  TERSKELDETALJER                                                     #
    # ------------------------------------------------------------------ #

    def _threshold_details_box(
        self, threshold: Optional[Any],
        doors_threshold: int, yes_rate_threshold: float,
    ) -> list:
        """Bygger en informasjonsboks med terskeldetaljer brukt i rapporten."""
        story = []

        # Hent terskeldetaljer
        if threshold:
            scope = getattr(threshold, 'scope', 'global')
            scope_label = {
                'global': 'Global',
                'manager': 'Leder',
                'campaign': 'Kampanje',
                'employee': 'Ansatt',
            }.get(scope, scope.capitalize())

            min_doors = getattr(threshold, 'min_doors_per_day', doors_threshold)
            min_yes = float(getattr(threshold, 'min_yes_rate_percent', yes_rate_threshold))
            max_no = float(getattr(threshold, 'max_no_rate_percent', 50.0))
            max_not_home = float(getattr(threshold, 'max_not_home_rate_percent', 40.0))
            min_contact = float(getattr(threshold, 'min_contact_rate_percent', 60.0))
            max_consec = getattr(threshold, 'max_consecutive_low_days', 3)
        else:
            scope_label = 'Standard'
            min_doors = doors_threshold
            min_yes = yes_rate_threshold
            max_no = 50.0
            max_not_home = 40.0
            min_contact = 60.0
            max_consec = 3

        # Bygg tabell med terskeldata
        threshold_data = [
            [
                Paragraph('<b>Terskelinnstillinger brukt i denne rapporten</b>', self.styles['Body']),
                Paragraph(f'<b>Omfang: {scope_label}</b>', self.styles['Body']),
            ],
            [
                Paragraph(f'Min. dører/dag: <b>{min_doors}</b>', self.styles['Small']),
                Paragraph(f'Min. ja-rate: <b>{min_yes:.1f}%</b>', self.styles['Small']),
            ],
            [
                Paragraph(f'Maks. nei-rate: <b>{max_no:.1f}%</b>', self.styles['Small']),
                Paragraph(f'Maks. ikke hjemme-rate: <b>{max_not_home:.1f}%</b>', self.styles['Small']),
            ],
            [
                Paragraph(f'Min. kontaktrate: <b>{min_contact:.1f}%</b>', self.styles['Small']),
                Paragraph(f'Maks. sammenhengende svake dager: <b>{max_consec}</b>', self.styles['Small']),
            ],
        ]

        col_w = (self.page_width - 2 * self.margin) / 2
        tbl = Table(threshold_data, colWidths=[col_w, col_w])
        tbl.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), _hex('#EBF5FB')),
            ('SPAN', (0, 0), (0, 0)),  # keep each cell independent
            # All rows
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('BOX', (0, 0), (-1, -1), 0.5, C_PRIMARY),
            ('LINEBELOW', (0, 0), (-1, 0), 0.5, C_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        story.append(tbl)
        return story

    # ------------------------------------------------------------------ #
    #  SIDE 2: KAMPANJEOVERSIKT                                            #
    # ------------------------------------------------------------------ #

    def _page_campaign_breakdown(self, data: Dict) -> list:
        """Bygg flytbare elementer for side 2."""
        story = []
        campaigns = data.get('campaigns', [])

        story.append(Paragraph('Kampanjeoversikt', self.styles['Heading1']))
        story.append(Paragraph(
            'Ytelsesmålinger for hver aktive kampanje i rapporteringsperioden.',
            self.styles['Body'],
        ))
        story.append(Spacer(1, 6))

        if not campaigns:
            story.append(Paragraph('Ingen kampanjedata tilgjengelig for denne perioden.', self.styles['Body']))
            return story

        # Kampanjetabell
        header = ['Kampanje', 'Dører', 'Ja', 'Nei', 'Ikke Hj.', 'Følg Opp', 'Ja %', 'Nei %', 'Kontakt %']
        table_data = [header]
        for c in campaigns:
            table_data.append([
                self._truncate(c['campaign_name'], 18),
                str(c['total_doors']),
                str(c['ja']),
                str(c['nei']),
                str(c['ikke_hjemme']),
                str(c['folg_opp']),
                f"{c['yes_rate']:.1f}%",
                f"{c['no_rate']:.1f}%",
                f"{c['contact_rate']:.1f}%",
            ])

        tbl = Table(table_data, repeatRows=1)
        tbl.setStyle(self._data_table_style(len(table_data)))
        story.append(tbl)
        story.append(Spacer(1, 12))

        # Kampanjesammenligningsdiagram
        if len(campaigns) >= 2:
            story.append(Paragraph('Kampanjesammenligning', self.styles['Heading2']))
            img = self.graph.campaign_comparison_bar(campaigns, figsize=(10, 4.5))
            story.append(self._chart_image(img, width=self.page_width - 2 * self.margin))

        return story

    # ------------------------------------------------------------------ #
    #  SIDE 3: ANSATT-RANGLISTE                                            #
    # ------------------------------------------------------------------ #

    def _page_employee_leaderboard(
        self, data: Dict, doors_threshold: int, yes_rate_threshold: float,
    ) -> list:
        """Bygg flytbare elementer for side 3 (kan gå over flere sider med mange ansatte)."""
        story = []
        employees = data.get('employees', [])

        story.append(Paragraph('Ansatt-rangliste', self.styles['Heading1']))
        story.append(Paragraph(
            'Individuell ytelse rangert etter totalt antall dører banket.',
            self.styles['Body'],
        ))
        story.append(Spacer(1, 6))

        if not employees:
            story.append(Paragraph('Ingen ansattdata tilgjengelig for denne perioden.', self.styles['Body']))
            return story

        # Ranglistabell — vis maks 25 ansatte for å unngå overflow
        header = ['#', 'Ansatt', 'Dører', 'Dører/Dag', 'Ja %', 'Nei %', 'Kontakt %', 'Konsistens']
        table_data = [header]
        sorted_emps = sorted(employees, key=lambda e: e['total_doors'], reverse=True)
        display_emps = sorted_emps[:25]  # Maks 25 for å passe på siden
        for rank, e in enumerate(display_emps, 1):
            worker_type = e.get('worker_type', 'employee')
            name_suffix = ' (L)' if worker_type == 'manager' else ''
            table_data.append([
                str(rank),
                self._truncate(e['employee_name'], 14) + name_suffix,
                str(e['total_doors']),
                str(e['doors_per_day']),
                f"{e['yes_rate']:.1f}%",
                f"{e['no_rate']:.1f}%",
                f"{e['contact_rate']:.1f}%",
                f"{e.get('consistency_score', 0):.0f}%",
            ])

        if len(sorted_emps) > 25:
            table_data.append([
                '…', f'+ {len(sorted_emps) - 25} til', '', '', '', '', '', '',
            ])

        tbl = Table(table_data, repeatRows=1)
        tbl.setStyle(self._data_table_style(len(table_data)))
        story.append(tbl)

        # --- Ny side for diagrammer for å unngå overflow ---
        story.append(PageBreak())

        # Dørsammenligning stolpediagram
        story.append(Paragraph('Dørsammenligning', self.styles['Heading2']))
        img = self.graph.employee_doors_bar(
            employees,
            threshold_doors=doors_threshold * data.get('period', {}).get('days', 7),
        )
        story.append(self._chart_image(img, width=self.page_width - 2 * self.margin))

        return story

    # ------------------------------------------------------------------ #
    #  SIDE 4: KRITISKE VARSLER                                            #
    # ------------------------------------------------------------------ #

    def _page_alerts(
        self, alerts: List[Dict], doors_threshold: int, yes_rate_threshold: float,
    ) -> list:
        """Bygg flytbare elementer for side 4."""
        story = []

        # Tell etter alvorlighetsgrad
        critical = [a for a in alerts if a['severity'] == 'critical']
        warnings = [a for a in alerts if a['severity'] == 'warning']
        infos = [a for a in alerts if a['severity'] == 'info']

        story.append(Paragraph('Ytelsesvarsler', self.styles['Heading1']))
        story.append(Paragraph(
            f"<b>{len(critical)}</b> kritiske · "
            f"<b>{len(warnings)}</b> advarsler · "
            f"<b>{len(infos)}</b> informasjon",
            self.styles['Body'],
        ))
        story.append(Spacer(1, 8))

        # Kritiske varsler først
        if critical:
            story.append(Paragraph('🚨 Kritiske Varsler', self.styles['Heading2']))
            for alert in critical:
                story.append(Paragraph(alert['message'], self.styles['AlertCritical']))

                # Vis trendgraf hvis varselet har daglige detaljer
                if alert.get('daily_details'):
                    emp_name = alert.get('employee_name', 'Ansatt')
                    img = self.graph.employee_alert_trend(
                        emp_name,
                        alert['daily_details'],
                        doors_threshold=doors_threshold,
                        yes_rate_threshold=yes_rate_threshold,
                        figsize=(9, 4),
                    )
                    story.append(self._chart_image(img, width=14 * cm))
                    story.append(Spacer(1, 6))

        # Advarsler
        if warnings:
            story.append(Paragraph('⚠️ Advarsler', self.styles['Heading2']))
            for alert in warnings:
                story.append(Paragraph(alert['message'], self.styles['AlertWarning']))

        # Informasjon
        if infos:
            story.append(Paragraph('ℹ️ Informasjon', self.styles['Heading2']))
            for alert in infos:
                story.append(Paragraph(alert['message'], self.styles['AlertInfo']))

        return story

    # ------------------------------------------------------------------ #
    #  SIDE 5: INNSIKT OG ANBEFALINGER                                     #
    # ------------------------------------------------------------------ #

    def _page_insights(
        self, data: Dict, alerts: List[Dict],
        doors_threshold: int, yes_rate_threshold: float,
    ) -> list:
        """Bygg flytbare elementer for siste side."""
        story = []
        summary = data.get('summary', {})
        daily = data.get('daily_breakdown', [])
        hourly = data.get('hourly_breakdown', [])
        employees = data.get('employees', [])
        top = data.get('top_performers', {})
        comparisons = data.get('comparisons', {})

        story.append(Paragraph('Innsikt og Anbefalinger', self.styles['Heading1']))
        story.append(Spacer(1, 6))

        # Timebasert ytelsesdiagram
        if hourly:
            story.append(Paragraph('Analyse av Topptimer', self.styles['Heading2']))
            story.append(Paragraph(
                'Dører banket og ja-rate per time på dagen. '
                'Identifiserer de mest produktive tidsvinduene.',
                self.styles['Small'],
            ))
            img = self.graph.hourly_performance_bar(hourly, figsize=(10, 3.5))
            chart_width = self.page_width - 2 * self.margin
            story.append(self._chart_image(img, width=chart_width, max_height=9 * cm))
            story.append(Spacer(1, 8))

        # Daglig trend — ny side for å unngå overflow
        if daily:
            story.append(PageBreak())
            story.append(Paragraph('Daglig Aktivitetstrend', self.styles['Heading2']))
            img = self.graph.daily_doors_line(daily, threshold_doors=doors_threshold, figsize=(10, 3.2))
            chart_width = self.page_width - 2 * self.margin
            story.append(self._chart_image(img, width=chart_width, max_height=9 * cm))
            story.append(Spacer(1, 8))

            story.append(Paragraph('Ja-Rate Trend', self.styles['Heading2']))
            img = self.graph.daily_yes_rate_line(daily, threshold_pct=yes_rate_threshold, figsize=(10, 3.2))
            story.append(self._chart_image(img, width=chart_width, max_height=9 * cm))
            story.append(Spacer(1, 8))

        # Automatisk genererte anbefalinger
        story.append(Paragraph('Anbefalinger', self.styles['Heading2']))
        recs = self._generate_recommendations(summary, employees, alerts, comparisons, top)
        for rec in recs:
            story.append(Paragraph(f"• {rec}", self.styles['Body']))

        # Bunntekst
        story.append(Spacer(1, 16))
        story.append(Paragraph(
            f"Rapport generert {datetime.now().strftime('%d. %b %Y kl. %H:%M')} "
            f"av AB Maps Analyse System.",
            self.styles['Small'],
        ))

        return story

    # ------------------------------------------------------------------ #
    #  HJELPERE: KPI TABELL                                                #
    # ------------------------------------------------------------------ #

    def _kpi_table(self, summary: Dict, comparisons: Dict) -> Table:
        """Opprett KPI-kort på toppnivå som en ReportLab-tabell."""
        def _arrow(comp_key):
            c = comparisons.get(comp_key, {})
            pct = c.get('change_pct', 0)
            if pct > 0:
                return f'<font color="{BrandColors.ACCENT}">▲ {abs(pct):.1f}%</font>'
            elif pct < 0:
                return f'<font color="{BrandColors.DANGER}">▼ {abs(pct):.1f}%</font>'
            return f'<font color="{BrandColors.NEUTRAL}">● 0.0%</font>'

        cards = [
            ('Totalt Dører', f"{summary.get('total_doors', 0):,}", _arrow('total_doors')),
            ('Dører / Dag', str(summary.get('doors_per_day', 0)), _arrow('doors_per_day')),
            ('Ja-Rate', f"{summary.get('yes_rate', 0):.1f}%", _arrow('yes_rate')),
            ('Kontakt Rate', f"{summary.get('contact_rate', 0):.1f}%", _arrow('contact_rate')),
            ('Arbeidere', str(summary.get('unique_employees', 0)), ''),
        ]

        header_cells = []
        value_cells = []
        change_cells = []

        for label, value, change in cards:
            header_cells.append(Paragraph(label, self.styles['KpiLabel']))
            value_cells.append(Paragraph(value, self.styles['KpiValue']))
            change_cells.append(Paragraph(change, self.styles['Small']))

        data = [header_cells, value_cells, change_cells]
        col_width = (self.page_width - 2 * self.margin) / len(cards)
        tbl = Table(data, colWidths=[col_width] * len(cards))
        tbl.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (-1, -1), C_LIGHT_BG),
            ('BOX', (0, 0), (-1, -1), 0.5, C_GRID),
            ('LINEBEFORE', (1, 0), (-1, -1), 0.5, C_GRID),
        ]))
        return tbl

    # ------------------------------------------------------------------ #
    #  HJELPERE: DATATABELL STIL                                           #
    # ------------------------------------------------------------------ #

    def _data_table_style(self, num_rows: int) -> TableStyle:
        """Returner en profesjonell tabellstil for datatabeller."""
        style_cmds = [
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
            ('TEXTCOLOR', (0, 0), (-1, 0), C_WHITE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('TOPPADDING', (0, 0), (-1, 0), 6),

            # Data rows
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
            ('TEXTCOLOR', (0, 1), (-1, -1), C_TEXT),

            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, C_GRID),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),  # Name column left-aligned

            # Alternating row colours
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]

        # Zebra striping
        for i in range(1, num_rows):
            if i % 2 == 0:
                style_cmds.append(('BACKGROUND', (0, i), (-1, i), C_LIGHT_BG))

        return TableStyle(style_cmds)

    # ------------------------------------------------------------------ #
    #  HJELPERE: DIAGRAMBILDE INNBYGGING                                   #
    # ------------------------------------------------------------------ #

    def _chart_image(self, buf: io.BytesIO, width: float = None, max_height: float = None) -> Image:
        """
        Konverter en BytesIO PNG-buffer til en ReportLab Image flowable.
        Bredde settes; høyde beregnes for å bevare aspektforhold.
        Hvis høyden overskrider max_height, skaleres bildet ned.
        """
        if width is None:
            width = self.page_width - 2 * self.margin

        # Maximum usable height = page height minus top/bottom margins and
        # some breathing room for headers, footers, and surrounding text.
        if max_height is None:
            max_height = self.page_height - 2 * self.margin - 2 * cm  # ~18 cm usable

        img = ImageReader(buf)
        iw, ih = img.getSize()
        aspect = ih / iw
        height = width * aspect

        # Scale down if the image would overflow the page frame
        if height > max_height:
            height = max_height
            width = height / aspect

        return Image(buf, width=width, height=height)

    # ------------------------------------------------------------------ #
    #  HJELPERE: TOPPTEKST / BUNNTEKST                                     #
    # ------------------------------------------------------------------ #

    def _header_footer(self, canvas, doc):
        """Tegn topptekstlinje og bunntekst med sidetall på hver side."""
        canvas.saveState()

        # Topptekstlinje
        y_header = self.page_height - self.margin + 8
        canvas.setStrokeColor(C_PRIMARY)
        canvas.setLineWidth(1.5)
        canvas.line(self.margin, y_header, self.page_width - self.margin, y_header)

        # Topptekst
        canvas.setFont('Helvetica-Bold', 8)
        canvas.setFillColor(C_PRIMARY)
        canvas.drawString(self.margin, y_header + 4, 'AB Maps Analyse')

        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(C_MUTED)
        canvas.drawRightString(
            self.page_width - self.margin,
            y_header + 4,
            datetime.now().strftime('%d. %b %Y'),
        )

        # Bunntekstlinje
        y_footer = self.margin - 10
        canvas.setStrokeColor(C_GRID)
        canvas.setLineWidth(0.5)
        canvas.line(self.margin, y_footer, self.page_width - self.margin, y_footer)

        # Sidetall
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(C_MUTED)
        canvas.drawCentredString(
            self.page_width / 2,
            y_footer - 10,
            f'Side {canvas.getPageNumber()}',
        )

        # Konfidensialitet
        canvas.drawString(
            self.margin,
            y_footer - 10,
            'Konfidensielt — AB Maps System',
        )

        canvas.restoreState()

    # ------------------------------------------------------------------ #
    #  HJELPERE: ANBEFALINGSMOTOR                                          #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _generate_recommendations(
        summary: Dict,
        employees: List[Dict],
        alerts: List[Dict],
        comparisons: Dict,
        top_performers: Dict,
    ) -> List[str]:
        """Generer automatiske anbefalinger på norsk fra dataene. Navn og tall er uthevet med <b>."""
        recs = []

        # 1. Generell volumtrend
        door_change = comparisons.get('total_doors', {}).get('change_pct', 0)
        if door_change < -10:
            recs.append(
                f"Dørvolumet falt med <b>{abs(door_change):.1f}%</b> sammenlignet med forrige periode. "
                "Vurder å gjennomgå timeplaner eller motivasjonsstrategier."
            )
        elif door_change > 10:
            recs.append(
                f"Dørvolumet er opp <b>{door_change:.1f}%</b> — flott momentum. "
                "Sørg for at kvaliteten (ja-rate) opprettholdes."
            )

        # 2. Ja-rate trend
        yr_change = comparisons.get('yes_rate', {}).get('change_pct', 0)
        if yr_change < -5:
            recs.append(
                f"Ja-raten gikk ned med <b>{abs(yr_change):.1f}%</b>. "
                "Gjennomgå pitch-kvalitet og vurder ekstra coachingøkter."
            )

        # 3. Antall kritiske varsler
        critical_count = len([a for a in alerts if a['severity'] == 'critical'])
        if critical_count > 0:
            recs.append(
                f"Det finnes <b>{critical_count} kritisk(e) varsel(er)</b>. "
                "Umiddelbar ledelsesoppmerksomhet kreves for de markerte ansatte."
            )

        # 4. Beste ytelse — anerkjennelse
        top_yes = top_performers.get('top_yes_rate')
        if top_yes:
            recs.append(
                f"<b>{top_yes['employee_name']}</b> leder på kvalitet med en "
                f"ja-rate på <b>{top_yes['value']:.1f}%</b>. Vurder fagfellelæring."
            )

        top_doors = top_performers.get('top_doors')
        if top_doors:
            recs.append(
                f"<b>{top_doors['employee_name']}</b> leder på volum med "
                f"<b>{top_doors['value']:,}</b> dører banket."
            )

        # 5. Svakeste ytelse — coaching
        bottom_yes = top_performers.get('bottom_yes_rate')
        if bottom_yes and bottom_yes['value'] < 25:
            recs.append(
                f"<b>{bottom_yes['employee_name']}</b> har den laveste ja-raten "
                f"(<b>{bottom_yes['value']:.1f}%</b>). En-til-en coaching anbefales."
            )

        # 6. Kontaktrate
        contact_rate = summary.get('contact_rate', 0)
        if contact_rate < 70:
            recs.append(
                f"Kontaktraten er <b>{contact_rate:.1f}%</b> — en betydelig andel av dørene "
                "er «Ikke Hjemme». Vurder å justere arbeidstider for å forbedre dekningen."
            )

        # 7. Konsistensinnsikt
        if employees:
            low_consistency = [e for e in employees if e.get('consistency_score', 100) < 50]
            if low_consistency:
                bold_names = ', '.join(f"<b>{e['employee_name']}</b>" for e in low_consistency[:3])
                recs.append(
                    f"Inkonsistent daglig produksjon oppdaget for: {bold_names}. "
                    "Stabil daglig ytelse korrelerer med bedre resultater."
                )

        if not recs:
            recs.append("Ytelsen er stabil — ingen umiddelbare tiltak nødvendig. Fortsett det gode arbeidet!")

        return recs

    # ------------------------------------------------------------------ #
    #  VERKTØY                                                             #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _truncate(text: str, max_len: int = 20) -> str:
        if len(text) <= max_len:
            return text
        return text[:max_len - 1] + '…'
