"""
Graph Generator Service

Creates publication-quality charts from analytics data and returns them
as in-memory BytesIO buffers (PNG images at 300 DPI) ready to embed into
ReportLab PDFs.

All public methods accept the data dictionaries returned by
AnalyticsCalculator and return a BytesIO object.
"""
import io
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend — required for server use

import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.ticker as mticker
from matplotlib.patches import FancyBboxPatch
import numpy as np


# ====================================================================== #
#  BRAND COLOURS                                                          #
# ====================================================================== #

class BrandColors:
    """AB Maps brand palette."""
    PRIMARY = '#1E3A5F'       # Dark navy blue
    SECONDARY = '#2E86C1'     # Bright blue
    ACCENT = '#27AE60'        # Green (yes / positive)
    DANGER = '#E74C3C'        # Red (alerts / negative)
    WARNING = '#F39C12'       # Orange / amber
    NEUTRAL = '#95A5A6'       # Grey
    LIGHT_BG = '#F8F9FA'      # Very light grey background
    TEXT = '#2C3E50'          # Dark text
    MUTED_TEXT = '#7F8C8D'    # Muted text
    GRID = '#ECF0F1'          # Grid lines

    # Status colours aligned with Address.STATUS_CHOICES
    JA = '#27AE60'            # Green
    NEI = '#E74C3C'           # Red
    IKKE_HJEMME = '#F39C12'   # Amber
    FOLG_OPP = '#3498DB'      # Blue

    # Sequential palette for multiple employees
    EMPLOYEE_PALETTE = [
        '#2E86C1', '#27AE60', '#E74C3C', '#F39C12', '#8E44AD',
        '#1ABC9C', '#D35400', '#2C3E50', '#16A085', '#C0392B',
        '#7D3C98', '#2980B9', '#F1C40F', '#E67E22', '#1F618D',
    ]


# ====================================================================== #
#  SHARED STYLE HELPERS                                                   #
# ====================================================================== #

def _apply_base_style(fig, ax, title: str, subtitle: str = ''):
    """Apply consistent base styling to every chart."""
    # Background
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    # Title
    ax.set_title(
        title,
        fontsize=14,
        fontweight='bold',
        color=BrandColors.TEXT,
        pad=20 if subtitle else 12,
        loc='left',
    )
    if subtitle:
        ax.text(
            0.0, 1.02, subtitle,
            transform=ax.transAxes,
            fontsize=9,
            color=BrandColors.MUTED_TEXT,
            va='bottom',
        )

    # Grid
    ax.grid(True, axis='y', color=BrandColors.GRID, linewidth=0.8, alpha=0.7)
    ax.set_axisbelow(True)

    # Spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color(BrandColors.GRID)
    ax.spines['bottom'].set_color(BrandColors.GRID)

    # Tick label colours
    ax.tick_params(colors=BrandColors.MUTED_TEXT, labelsize=9)


def _to_buffer(fig) -> io.BytesIO:
    """Render a matplotlib Figure to a 300-DPI PNG BytesIO buffer."""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=300, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    buf.seek(0)
    return buf


def _parse_dates(date_strings: List[str]) -> List[datetime]:
    """Convert ISO date strings to datetime objects."""
    return [datetime.fromisoformat(d) for d in date_strings]


def _short_name(name: str, max_len: int = 12) -> str:
    """Truncate long names for chart labels."""
    if len(name) <= max_len:
        return name
    return name[:max_len - 1] + '…'


# ====================================================================== #
#  GRAPH GENERATOR CLASS                                                  #
# ====================================================================== #

class GraphGenerator:
    """
    Stateless service that turns analytics data dicts into chart images.

    Every public method returns a BytesIO buffer containing a 300 DPI PNG.
    """

    # ------------------------------------------------------------------ #
    #  1. DAILY DOORS KNOCKED — Line Graph                                #
    # ------------------------------------------------------------------ #

    def daily_doors_line(
        self,
        daily_breakdown: List[Dict[str, Any]],
        threshold_doors: Optional[int] = None,
        figsize: Tuple[float, float] = (10, 4.5),
    ) -> io.BytesIO:
        """
        Line graph showing total doors knocked per day with an optional
        threshold red-line.
        """
        if not daily_breakdown:
            return self._empty_chart('No daily door data available', figsize)

        dates = _parse_dates([d['date'] for d in daily_breakdown])
        doors = [d['total_doors'] for d in daily_breakdown]

        fig, ax = plt.subplots(figsize=figsize)
        _apply_base_style(fig, ax, 'Daily Doors Knocked', 'Total doors visited each day')

        # Main line
        ax.plot(dates, doors, color=BrandColors.SECONDARY, linewidth=2.5,
                marker='o', markersize=5, markerfacecolor='white',
                markeredgewidth=2, markeredgecolor=BrandColors.SECONDARY,
                zorder=3)

        # Fill under
        ax.fill_between(dates, doors, alpha=0.08, color=BrandColors.SECONDARY)

        # Value labels
        for d, v in zip(dates, doors):
            ax.annotate(str(v), (d, v), textcoords='offset points',
                        xytext=(0, 10), ha='center', fontsize=8,
                        color=BrandColors.TEXT, fontweight='bold')

        # Threshold line
        if threshold_doors:
            ax.axhline(y=threshold_doors, color=BrandColors.DANGER,
                        linewidth=1.5, linestyle='--', alpha=0.7, zorder=2)
            ax.text(dates[-1], threshold_doors, f'  Min: {threshold_doors}',
                    va='bottom', fontsize=8, color=BrandColors.DANGER,
                    fontweight='bold')

        ax.xaxis.set_major_formatter(mdates.DateFormatter('%d %b'))
        ax.xaxis.set_major_locator(mdates.AutoDateLocator())
        fig.autofmt_xdate(rotation=30)
        ax.set_ylabel('Doors', fontsize=10, color=BrandColors.TEXT)
        ax.set_ylim(bottom=0)

        return _to_buffer(fig)

    # ------------------------------------------------------------------ #
    #  2. DAILY YES-RATE — Line Graph                                     #
    # ------------------------------------------------------------------ #

    def daily_yes_rate_line(
        self,
        daily_breakdown: List[Dict[str, Any]],
        threshold_pct: Optional[float] = None,
        figsize: Tuple[float, float] = (10, 4.5),
    ) -> io.BytesIO:
        """
        Line graph showing daily yes-rate percentage with an optional
        threshold red-line.
        """
        if not daily_breakdown:
            return self._empty_chart('No daily yes-rate data available', figsize)

        dates = _parse_dates([d['date'] for d in daily_breakdown])
        rates = [d['yes_rate'] for d in daily_breakdown]

        fig, ax = plt.subplots(figsize=figsize)
        _apply_base_style(fig, ax, 'Daily Yes-Rate Development', 'Percentage of "Ja" responses per day')

        # Colour each segment green/red based on threshold
        if threshold_pct is not None:
            for i in range(len(dates) - 1):
                color = BrandColors.ACCENT if rates[i] >= threshold_pct else BrandColors.DANGER
                ax.plot(dates[i:i+2], rates[i:i+2], color=color, linewidth=2.5, zorder=3)
            # Markers
            colors = [BrandColors.ACCENT if r >= (threshold_pct or 0) else BrandColors.DANGER for r in rates]
            for d, r, c in zip(dates, rates, colors):
                ax.plot(d, r, 'o', color=c, markersize=6, markerfacecolor='white',
                        markeredgewidth=2, markeredgecolor=c, zorder=4)
        else:
            ax.plot(dates, rates, color=BrandColors.ACCENT, linewidth=2.5,
                    marker='o', markersize=5, markerfacecolor='white',
                    markeredgewidth=2, markeredgecolor=BrandColors.ACCENT, zorder=3)

        # Value labels
        for d, r in zip(dates, rates):
            ax.annotate(f'{r:.1f}%', (d, r), textcoords='offset points',
                        xytext=(0, 10), ha='center', fontsize=8,
                        color=BrandColors.TEXT, fontweight='bold')

        # Threshold line
        if threshold_pct is not None:
            ax.axhline(y=threshold_pct, color=BrandColors.DANGER,
                        linewidth=1.5, linestyle='--', alpha=0.7, zorder=2)
            ax.text(dates[-1], threshold_pct, f'  Min: {threshold_pct:.0f}%',
                    va='bottom', fontsize=8, color=BrandColors.DANGER,
                    fontweight='bold')

        ax.xaxis.set_major_formatter(mdates.DateFormatter('%d %b'))
        ax.xaxis.set_major_locator(mdates.AutoDateLocator())
        fig.autofmt_xdate(rotation=30)
        ax.set_ylabel('Yes-Rate %', fontsize=10, color=BrandColors.TEXT)
        ax.set_ylim(0, 105)
        ax.yaxis.set_major_formatter(mticker.PercentFormatter(100))

        return _to_buffer(fig)

    # ------------------------------------------------------------------ #
    #  3. EMPLOYEE DOORS COMPARISON — Horizontal Bar Chart                #
    # ------------------------------------------------------------------ #

    def employee_doors_bar(
        self,
        employees: List[Dict[str, Any]],
        threshold_doors: Optional[int] = None,
        figsize: Tuple[float, float] = (10, None),
        max_employees: int = 20,
    ) -> io.BytesIO:
        """
        Horizontal bar chart comparing total doors per employee.
        Bars below the threshold are coloured red.
        Shows top + bottom employees if there are more than max_employees.
        """
        if not employees:
            return self._empty_chart('No employee data available', figsize=(10, 3))

        # Sort by total doors descending
        sorted_emps = sorted(employees, key=lambda e: e['total_doors'])

        # Limit the number of employees shown to prevent oversized charts
        if len(sorted_emps) > max_employees:
            # Show bottom 10 and top 10 to highlight both ends
            half = max_employees // 2
            sorted_emps = sorted_emps[:half] + sorted_emps[-half:]

        names = [_short_name(e['employee_name']) for e in sorted_emps]
        doors = [e['total_doors'] for e in sorted_emps]

        # Dynamic height (capped)
        height = max(3, min(len(names) * 0.55 + 1.5, 12))
        fig, ax = plt.subplots(figsize=(figsize[0], height))
        _apply_base_style(fig, ax, 'Doors Knocked per Employee', 'Total doors in the reporting period')
        ax.grid(True, axis='x', color=BrandColors.GRID, linewidth=0.8, alpha=0.7)
        ax.grid(False, axis='y')

        # Bar colours
        if threshold_doors:
            colors = [BrandColors.DANGER if d < threshold_doors else BrandColors.SECONDARY for d in doors]
        else:
            colors = [BrandColors.SECONDARY] * len(doors)

        bars = ax.barh(names, doors, color=colors, height=0.6, edgecolor='white', linewidth=0.5)

        # Value labels
        for bar, val in zip(bars, doors):
            ax.text(bar.get_width() + max(doors) * 0.02, bar.get_y() + bar.get_height() / 2,
                    str(val), va='center', fontsize=9, color=BrandColors.TEXT, fontweight='bold')

        # Threshold vertical line
        if threshold_doors:
            ax.axvline(x=threshold_doors, color=BrandColors.DANGER,
                        linewidth=1.5, linestyle='--', alpha=0.7)
            ax.text(threshold_doors, len(names) - 0.5, f' Min: {threshold_doors}',
                    va='bottom', fontsize=8, color=BrandColors.DANGER, fontweight='bold')

        ax.set_xlabel('Total Doors', fontsize=10, color=BrandColors.TEXT)
        ax.set_xlim(left=0)

        return _to_buffer(fig)

    # ------------------------------------------------------------------ #
    #  4. EMPLOYEE YES-RATE COMPARISON — Horizontal Bar Chart             #
    # ------------------------------------------------------------------ #

    def employee_yes_rate_bar(
        self,
        employees: List[Dict[str, Any]],
        threshold_pct: Optional[float] = None,
        figsize: Tuple[float, float] = (10, None),
        max_employees: int = 20,
    ) -> io.BytesIO:
        """
        Horizontal bar chart comparing yes-rate per employee.
        Shows top + bottom employees if there are more than max_employees.
        """
        if not employees:
            return self._empty_chart('No employee data available', figsize=(10, 3))

        sorted_emps = sorted(employees, key=lambda e: e['yes_rate'])

        # Limit the number of employees shown to prevent oversized charts
        if len(sorted_emps) > max_employees:
            half = max_employees // 2
            sorted_emps = sorted_emps[:half] + sorted_emps[-half:]

        names = [_short_name(e['employee_name']) for e in sorted_emps]
        rates = [e['yes_rate'] for e in sorted_emps]

        height = max(3, min(len(names) * 0.55 + 1.5, 12))
        fig, ax = plt.subplots(figsize=(figsize[0], height))
        _apply_base_style(fig, ax, 'Yes-Rate per Employee', 'Percentage of "Ja" responses')
        ax.grid(True, axis='x', color=BrandColors.GRID, linewidth=0.8, alpha=0.7)
        ax.grid(False, axis='y')

        if threshold_pct is not None:
            colors = [BrandColors.DANGER if r < threshold_pct else BrandColors.ACCENT for r in rates]
        else:
            colors = [BrandColors.ACCENT] * len(rates)

        bars = ax.barh(names, rates, color=colors, height=0.6, edgecolor='white', linewidth=0.5)

        for bar, val in zip(bars, rates):
            ax.text(bar.get_width() + 1.5, bar.get_y() + bar.get_height() / 2,
                    f'{val:.1f}%', va='center', fontsize=9, color=BrandColors.TEXT, fontweight='bold')

        if threshold_pct is not None:
            ax.axvline(x=threshold_pct, color=BrandColors.DANGER,
                        linewidth=1.5, linestyle='--', alpha=0.7)
            ax.text(threshold_pct, len(names) - 0.5, f' Min: {threshold_pct:.0f}%',
                    va='bottom', fontsize=8, color=BrandColors.DANGER, fontweight='bold')

        ax.set_xlabel('Yes-Rate %', fontsize=10, color=BrandColors.TEXT)
        ax.set_xlim(0, 105)
        ax.xaxis.set_major_formatter(mticker.PercentFormatter(100))

        return _to_buffer(fig)

    # ------------------------------------------------------------------ #
    #  5. STATUS BREAKDOWN — Pie / Donut Chart                            #
    # ------------------------------------------------------------------ #

    def status_breakdown_pie(
        self,
        summary: Dict[str, Any],
        figsize: Tuple[float, float] = (7, 5),
    ) -> io.BytesIO:
        """
        Donut chart showing the overall status distribution.
        """
        labels_map = {
            'ja': ('Ja (Yes)', BrandColors.JA),
            'nei': ('Nei (No)', BrandColors.NEI),
            'ikke_hjemme': ('Ikke Hjemme', BrandColors.IKKE_HJEMME),
            'folg_opp': ('Følg Opp', BrandColors.FOLG_OPP),
        }

        status_counts = summary.get('status_counts', {})
        total = sum(status_counts.values())
        if total == 0:
            return self._empty_chart('No status data available', figsize)

        labels = []
        sizes = []
        colors = []
        for key, (label, color) in labels_map.items():
            count = status_counts.get(key, 0)
            if count > 0:
                labels.append(label)
                sizes.append(count)
                colors.append(color)

        fig, ax = plt.subplots(figsize=figsize)
        fig.patch.set_facecolor('white')

        wedges, texts, autotexts = ax.pie(
            sizes,
            labels=None,
            colors=colors,
            autopct=lambda p: f'{p:.1f}%' if p > 3 else '',
            startangle=90,
            pctdistance=0.78,
            wedgeprops=dict(width=0.45, edgecolor='white', linewidth=2),
        )

        for t in autotexts:
            t.set_fontsize(10)
            t.set_fontweight('bold')
            t.set_color('white')

        # Center text
        ax.text(0, 0, f'{total:,}', ha='center', va='center',
                fontsize=22, fontweight='bold', color=BrandColors.TEXT)
        ax.text(0, -0.12, 'Total Doors', ha='center', va='center',
                fontsize=9, color=BrandColors.MUTED_TEXT)

        # Legend
        legend_labels = [f'{l}  ({s:,} — {s/total*100:.1f}%)' for l, s in zip(labels, sizes)]
        ax.legend(wedges, legend_labels, loc='center left',
                  bbox_to_anchor=(1.0, 0.5), fontsize=9,
                  frameon=False, handlelength=1.2, handleheight=1.2)

        ax.set_title('Overall Status Breakdown', fontsize=14,
                      fontweight='bold', color=BrandColors.TEXT, pad=16, loc='left')

        return _to_buffer(fig)

    # ------------------------------------------------------------------ #
    #  6. CAMPAIGN COMPARISON — Grouped Bar Chart                         #
    # ------------------------------------------------------------------ #

    def campaign_comparison_bar(
        self,
        campaigns: List[Dict[str, Any]],
        figsize: Tuple[float, float] = (10, 5),
    ) -> io.BytesIO:
        """
        Grouped bar chart comparing campaigns by status distribution.
        """
        if not campaigns:
            return self._empty_chart('No campaign data available', figsize)

        names = [_short_name(c['campaign_name'], 15) for c in campaigns]
        ja_vals = [c['ja'] for c in campaigns]
        nei_vals = [c['nei'] for c in campaigns]
        ih_vals = [c['ikke_hjemme'] for c in campaigns]
        fo_vals = [c['folg_opp'] for c in campaigns]

        x = np.arange(len(names))
        bar_width = 0.2

        fig, ax = plt.subplots(figsize=figsize)
        _apply_base_style(fig, ax, 'Campaign Status Comparison', 'Door outcomes by campaign')

        ax.bar(x - 1.5 * bar_width, ja_vals, bar_width, label='Ja', color=BrandColors.JA, edgecolor='white')
        ax.bar(x - 0.5 * bar_width, nei_vals, bar_width, label='Nei', color=BrandColors.NEI, edgecolor='white')
        ax.bar(x + 0.5 * bar_width, ih_vals, bar_width, label='Ikke Hjemme', color=BrandColors.IKKE_HJEMME, edgecolor='white')
        ax.bar(x + 1.5 * bar_width, fo_vals, bar_width, label='Følg Opp', color=BrandColors.FOLG_OPP, edgecolor='white')

        ax.set_xticks(x)
        ax.set_xticklabels(names, rotation=30, ha='right')
        ax.set_ylabel('Count', fontsize=10, color=BrandColors.TEXT)
        ax.legend(loc='upper right', fontsize=9, frameon=False)
        ax.set_ylim(bottom=0)

        return _to_buffer(fig)

    # ------------------------------------------------------------------ #
    #  7. HOURLY PERFORMANCE — Bar Chart                                  #
    # ------------------------------------------------------------------ #

    def hourly_performance_bar(
        self,
        hourly_breakdown: List[Dict[str, Any]],
        figsize: Tuple[float, float] = (10, 4),
    ) -> io.BytesIO:
        """
        Bar chart showing doors knocked by hour of day with yes-rate overlay.
        """
        if not hourly_breakdown:
            return self._empty_chart('No hourly data available', figsize)

        hours = [h['hour'] for h in hourly_breakdown]
        doors = [h['total_doors'] for h in hourly_breakdown]
        rates = [h['yes_rate'] for h in hourly_breakdown]

        fig, ax1 = plt.subplots(figsize=figsize)
        _apply_base_style(fig, ax1, 'Activity by Hour of Day', 'Peak hours analysis')

        # Bars: doors
        bars = ax1.bar(hours, doors, color=BrandColors.SECONDARY, alpha=0.7,
                        edgecolor='white', linewidth=0.5, label='Doors')
        ax1.set_xlabel('Hour', fontsize=10, color=BrandColors.TEXT)
        ax1.set_ylabel('Doors Knocked', fontsize=10, color=BrandColors.TEXT)
        ax1.set_ylim(bottom=0)
        ax1.set_xticks(hours)
        ax1.set_xticklabels([f'{h:02d}:00' for h in hours], rotation=45, fontsize=8)

        # Line overlay: yes-rate
        ax2 = ax1.twinx()
        ax2.plot(hours, rates, color=BrandColors.ACCENT, linewidth=2.5,
                 marker='o', markersize=5, markerfacecolor='white',
                 markeredgewidth=2, markeredgecolor=BrandColors.ACCENT,
                 label='Yes-Rate', zorder=5)
        ax2.set_ylabel('Yes-Rate %', fontsize=10, color=BrandColors.ACCENT)
        ax2.set_ylim(0, 105)
        ax2.yaxis.set_major_formatter(mticker.PercentFormatter(100))
        ax2.spines['top'].set_visible(False)
        ax2.spines['right'].set_color(BrandColors.ACCENT)
        ax2.tick_params(axis='y', colors=BrandColors.ACCENT, labelsize=9)

        # Combined legend
        lines1, labels1 = ax1.get_legend_handles_labels()
        lines2, labels2 = ax2.get_legend_handles_labels()
        ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper right',
                   fontsize=9, frameon=False)

        return _to_buffer(fig)

    # ------------------------------------------------------------------ #
    #  8. INDIVIDUAL EMPLOYEE TREND — Alert History Graph                  #
    # ------------------------------------------------------------------ #

    def employee_alert_trend(
        self,
        employee_name: str,
        daily_details: List[Dict[str, Any]],
        doors_threshold: Optional[int] = None,
        yes_rate_threshold: Optional[float] = None,
        figsize: Tuple[float, float] = (10, 5),
    ) -> io.BytesIO:
        """
        Dual-axis trend chart for a single employee who triggered an alert.
        Shows doors knocked (bars) and yes-rate (line) with thresholds.
        """
        if not daily_details:
            return self._empty_chart(f'No trend data for {employee_name}', figsize)

        dates = _parse_dates([d['date'] for d in daily_details])
        doors = [d['doors'] for d in daily_details]
        rates = [d['yes_rate'] for d in daily_details]

        fig, ax1 = plt.subplots(figsize=figsize)
        _apply_base_style(fig, ax1, f'Performance Trend — {employee_name}',
                          'Recent daily activity and quality')

        # Bars: doors
        bar_colors = []
        for d in daily_details:
            if d['doors'] == 0:
                bar_colors.append(BrandColors.NEUTRAL)
            elif d.get('below_doors_threshold'):
                bar_colors.append(BrandColors.DANGER)
            else:
                bar_colors.append(BrandColors.SECONDARY)

        ax1.bar(dates, doors, color=bar_colors, alpha=0.8, width=0.6,
                edgecolor='white', linewidth=0.5, label='Doors')
        ax1.set_ylabel('Doors Knocked', fontsize=10, color=BrandColors.TEXT)
        ax1.set_ylim(bottom=0)

        # Doors threshold
        if doors_threshold:
            ax1.axhline(y=doors_threshold, color=BrandColors.DANGER,
                         linewidth=1.5, linestyle='--', alpha=0.6)
            ax1.text(dates[0], doors_threshold, f' Min doors: {doors_threshold}',
                     va='bottom', fontsize=8, color=BrandColors.DANGER, fontweight='bold')

        # Line overlay: yes-rate
        ax2 = ax1.twinx()
        line_colors = [BrandColors.DANGER if d.get('below_yes_rate_threshold') else BrandColors.ACCENT
                       for d in daily_details]
        # Plot line in segments to show colour changes
        for i in range(len(dates) - 1):
            c = BrandColors.DANGER if daily_details[i].get('below_yes_rate_threshold') else BrandColors.ACCENT
            ax2.plot(dates[i:i+2], rates[i:i+2], color=c, linewidth=2.5, zorder=5)

        # Markers
        for d, r, det in zip(dates, rates, daily_details):
            c = BrandColors.DANGER if det.get('below_yes_rate_threshold') else BrandColors.ACCENT
            ax2.plot(d, r, 'o', color=c, markersize=6, markerfacecolor='white',
                     markeredgewidth=2, markeredgecolor=c, zorder=6)

        ax2.set_ylabel('Yes-Rate %', fontsize=10, color=BrandColors.ACCENT)
        ax2.set_ylim(0, 105)
        ax2.yaxis.set_major_formatter(mticker.PercentFormatter(100))
        ax2.spines['top'].set_visible(False)
        ax2.spines['right'].set_color(BrandColors.ACCENT)
        ax2.tick_params(axis='y', colors=BrandColors.ACCENT, labelsize=9)

        # Yes-rate threshold
        if yes_rate_threshold is not None:
            ax2.axhline(y=yes_rate_threshold, color=BrandColors.WARNING,
                         linewidth=1.5, linestyle=':', alpha=0.7)
            ax2.text(dates[-1], yes_rate_threshold, f' Min rate: {yes_rate_threshold:.0f}%',
                     va='bottom', fontsize=8, color=BrandColors.WARNING, fontweight='bold')

        ax1.xaxis.set_major_formatter(mdates.DateFormatter('%d %b'))
        fig.autofmt_xdate(rotation=30)

        # Combined legend
        from matplotlib.patches import Patch
        from matplotlib.lines import Line2D
        legend_elements = [
            Patch(facecolor=BrandColors.SECONDARY, label='Doors (OK)'),
            Patch(facecolor=BrandColors.DANGER, label='Doors (Below threshold)'),
            Line2D([0], [0], color=BrandColors.ACCENT, linewidth=2, label='Yes-Rate (OK)'),
            Line2D([0], [0], color=BrandColors.DANGER, linewidth=2, label='Yes-Rate (Below threshold)'),
        ]
        ax1.legend(handles=legend_elements, loc='upper left', fontsize=8, frameon=False)

        return _to_buffer(fig)

    # ------------------------------------------------------------------ #
    #  9. PERIOD COMPARISON — KPI Cards Style Chart                       #
    # ------------------------------------------------------------------ #

    def period_comparison_kpi(
        self,
        comparisons: Dict[str, Any],
        figsize: Tuple[float, float] = (10, 2.5),
    ) -> io.BytesIO:
        """
        Visual KPI comparison cards: current vs previous period.
        Arrows + color-coded changes.
        """
        if not comparisons:
            return self._empty_chart('No comparison data', figsize)

        metrics = [
            ('Total Doors', 'total_doors', '', False),
            ('Yes-Rate', 'yes_rate', '%', True),
            ('No-Rate', 'no_rate', '%', False),      # lower is better
            ('Contact Rate', 'contact_rate', '%', True),
            ('Doors/Day', 'doors_per_day', '', True),
        ]

        fig, axes = plt.subplots(1, len(metrics), figsize=figsize)
        fig.patch.set_facecolor('white')

        for ax, (title, key, suffix, higher_is_better) in zip(axes, metrics):
            data = comparisons.get(key, {})
            current = data.get('current', 0)
            change_pct = data.get('change_pct', 0)

            ax.set_xlim(0, 1)
            ax.set_ylim(0, 1)
            ax.axis('off')

            # Title
            ax.text(0.5, 0.9, title, ha='center', va='top',
                    fontsize=9, color=BrandColors.MUTED_TEXT, fontweight='normal')

            # Current value
            val_str = f'{current}{suffix}' if isinstance(current, (int, float)) and not isinstance(current, bool) else str(current)
            ax.text(0.5, 0.55, val_str, ha='center', va='center',
                    fontsize=18, color=BrandColors.TEXT, fontweight='bold')

            # Change indicator
            if change_pct > 0:
                arrow = '▲'
                if higher_is_better:
                    color = BrandColors.ACCENT
                else:
                    color = BrandColors.DANGER
            elif change_pct < 0:
                arrow = '▼'
                if higher_is_better:
                    color = BrandColors.DANGER
                else:
                    color = BrandColors.ACCENT
            else:
                arrow = '●'
                color = BrandColors.NEUTRAL

            ax.text(0.5, 0.2, f'{arrow} {abs(change_pct):.1f}%',
                    ha='center', va='center', fontsize=10,
                    color=color, fontweight='bold')

        fig.suptitle('Period-over-Period Comparison', fontsize=12,
                     fontweight='bold', color=BrandColors.TEXT, y=1.05)

        return _to_buffer(fig)

    # ------------------------------------------------------------------ #
    #  10. EMPLOYEE CONSISTENCY — Scatter / Bubble Chart                  #
    # ------------------------------------------------------------------ #

    def employee_scatter(
        self,
        employees: List[Dict[str, Any]],
        doors_threshold: Optional[int] = None,
        yes_rate_threshold: Optional[float] = None,
        figsize: Tuple[float, float] = (9, 5),
    ) -> io.BytesIO:
        """
        Scatter plot: X = total doors, Y = yes-rate.
        Quadrant lines drawn at thresholds.
        """
        if not employees:
            return self._empty_chart('No employee data', figsize)

        fig, ax = plt.subplots(figsize=figsize)
        _apply_base_style(fig, ax, 'Employee Performance Map',
                          'Doors knocked vs Yes-rate (size = consistency)')

        doors = [e['total_doors'] for e in employees]
        rates = [e['yes_rate'] for e in employees]
        consistency = [max(e.get('consistency_score', 50), 15) for e in employees]  # min size 15

        # Normalize bubble size
        max_c = max(consistency) if consistency else 1
        sizes = [(c / max_c) * 300 + 50 for c in consistency]

        ax.scatter(doors, rates, s=sizes, c=BrandColors.SECONDARY,
                   alpha=0.65, edgecolors='white', linewidths=1.5, zorder=3)

        # Labels
        for e, d, r in zip(employees, doors, rates):
            ax.annotate(_short_name(e['employee_name'], 10), (d, r),
                        textcoords='offset points', xytext=(5, 5),
                        fontsize=8, color=BrandColors.TEXT)

        # Threshold quadrant lines
        if doors_threshold:
            ax.axvline(x=doors_threshold, color=BrandColors.DANGER,
                        linewidth=1, linestyle='--', alpha=0.5)
        if yes_rate_threshold is not None:
            ax.axhline(y=yes_rate_threshold, color=BrandColors.DANGER,
                        linewidth=1, linestyle='--', alpha=0.5)

        # Quadrant labels
        if doors_threshold and yes_rate_threshold is not None:
            max_d = max(doors) * 1.15 if doors else 100
            ax.text(max_d * 0.95, 100, '★ Star', ha='right', va='top',
                    fontsize=9, color=BrandColors.ACCENT, fontweight='bold', alpha=0.7)
            ax.text(doors_threshold * 0.3, 100, 'Quality\n(Low volume)', ha='center', va='top',
                    fontsize=8, color=BrandColors.WARNING, alpha=0.7)
            ax.text(max_d * 0.95, yes_rate_threshold * 0.3, 'Volume\n(Low quality)', ha='right', va='center',
                    fontsize=8, color=BrandColors.WARNING, alpha=0.7)
            ax.text(doors_threshold * 0.3, yes_rate_threshold * 0.3, '⚠ Needs\nAttention', ha='center', va='center',
                    fontsize=9, color=BrandColors.DANGER, fontweight='bold', alpha=0.7)

        ax.set_xlabel('Total Doors Knocked', fontsize=10, color=BrandColors.TEXT)
        ax.set_ylabel('Yes-Rate %', fontsize=10, color=BrandColors.TEXT)
        ax.set_ylim(0, 105)
        ax.yaxis.set_major_formatter(mticker.PercentFormatter(100))
        ax.set_xlim(left=0)

        return _to_buffer(fig)

    # ------------------------------------------------------------------ #
    #  EMPTY / PLACEHOLDER CHART                                          #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _empty_chart(message: str, figsize: Tuple[float, float] = (10, 3)) -> io.BytesIO:
        """Return a placeholder image when there is no data."""
        fig, ax = plt.subplots(figsize=figsize)
        fig.patch.set_facecolor('white')
        ax.set_facecolor('white')
        ax.text(0.5, 0.5, message,
                ha='center', va='center',
                fontsize=14, color=BrandColors.MUTED_TEXT,
                fontstyle='italic')
        ax.axis('off')
        return _to_buffer(fig)
