export type ReportPayload = {
  frequency: 'weekly' | 'monthly';
  siteId: string;
  siteName: string;
  periodLabel: string;
  recipientEmail: string;
  metrics: {
    widgetImpressions: number;
    widgetOpenings: number;
    startedChats: number;
    sentMessages: number;
    aiAnswerRate: number;
    fallbackAnswers: number;
    leads: number;
    leadRate: number;
    averageConversationDurationSeconds: number;
    estimatedSupportRelief: number;
    topQuestions: Array<{ question: string; count: number }>;
    mostActivePages: Array<{ pageUrl: string; impressions: number; openings: number }>;
    unansweredQuestions: number;
    dropOffRate: number;
  };
  recommendations: Array<{ title: string; detail: string }>;
};

export class ReportRendererService {
  renderHtml(report: ReportPayload): string {
    const recommendationItems = report.recommendations
      .map(
        (item) =>
          `<li><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(item.detail)}</li>`,
      )
      .join('');
    const topQuestionItems =
      report.metrics.topQuestions.length > 0
        ? report.metrics.topQuestions
            .map(
              (item) =>
                `<li>${escapeHtml(item.question)} <strong>(${item.count})</strong></li>`,
            )
            .join('')
        : '<li>Keine Daten vorhanden.</li>';
    const activePageItems =
      report.metrics.mostActivePages.length > 0
        ? report.metrics.mostActivePages
            .map(
              (item) =>
                `<li>${escapeHtml(item.pageUrl)} - Impressions: ${item.impressions}, Oeffnungen: ${item.openings}</li>`,
            )
            .join('')
        : '<li>Keine Daten vorhanden.</li>';

    return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(report.siteName || report.siteId)} Report</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #1b1f23; line-height: 1.5;">
    <h1>${escapeHtml(report.frequency === 'weekly' ? 'Wochenbericht' : 'Monatsbericht')}</h1>
    <p><strong>Site:</strong> ${escapeHtml(report.siteName || report.siteId)}</p>
    <p><strong>Zeitraum:</strong> ${escapeHtml(report.periodLabel)}</p>
    <h2>Kennzahlen</h2>
    <ul>
      <li>Widget-Impressions: ${report.metrics.widgetImpressions}</li>
      <li>Widget-Oeffnungen: ${report.metrics.widgetOpenings}</li>
      <li>Gestartete Chats: ${report.metrics.startedChats}</li>
      <li>Gesendete Nachrichten: ${report.metrics.sentMessages}</li>
      <li>AI-Antwortquote: ${formatPercent(report.metrics.aiAnswerRate)}</li>
      <li>Fallback-Antworten: ${report.metrics.fallbackAnswers}</li>
      <li>Leads: ${report.metrics.leads}</li>
      <li>Lead-Rate: ${formatPercent(report.metrics.leadRate)}</li>
      <li>Durchschnittliche Gespraechsdauer: ${formatDuration(
        report.metrics.averageConversationDurationSeconds,
      )}</li>
      <li>Geschaetzte Support-Entlastung: ${report.metrics.estimatedSupportRelief}</li>
      <li>Unbeantwortete Fragen: ${report.metrics.unansweredQuestions}</li>
      <li>Abbruchrate: ${formatPercent(report.metrics.dropOffRate)}</li>
    </ul>
    <h2>Top-Fragen</h2>
    <ul>${topQuestionItems}</ul>
    <h2>Aktivste Seiten</h2>
    <ul>${activePageItems}</ul>
    <h2>Empfehlungen</h2>
    <ul>${recommendationItems}</ul>
  </body>
</html>`;
  }

  renderText(report: ReportPayload): string {
    const topQuestions =
      report.metrics.topQuestions.length > 0
        ? report.metrics.topQuestions.map((item) => `- ${item.question} (${item.count})`).join('\n')
        : '- Keine Daten vorhanden.';
    const activePages =
      report.metrics.mostActivePages.length > 0
        ? report.metrics.mostActivePages
            .map((item) => `- ${item.pageUrl} (Impressions: ${item.impressions}, Oeffnungen: ${item.openings})`)
            .join('\n')
        : '- Keine Daten vorhanden.';
    const recommendations =
      report.recommendations.length > 0
        ? report.recommendations.map((item) => `- ${item.title}: ${item.detail}`).join('\n')
        : '- Keine Empfehlungen vorhanden.';

    return [
      `${report.frequency === 'weekly' ? 'Wochenbericht' : 'Monatsbericht'} fuer ${report.siteName || report.siteId}`,
      `Zeitraum: ${report.periodLabel}`,
      '',
      'Kennzahlen:',
      `- Widget-Impressions: ${report.metrics.widgetImpressions}`,
      `- Widget-Oeffnungen: ${report.metrics.widgetOpenings}`,
      `- Gestartete Chats: ${report.metrics.startedChats}`,
      `- Gesendete Nachrichten: ${report.metrics.sentMessages}`,
      `- AI-Antwortquote: ${formatPercent(report.metrics.aiAnswerRate)}`,
      `- Fallback-Antworten: ${report.metrics.fallbackAnswers}`,
      `- Leads: ${report.metrics.leads}`,
      `- Lead-Rate: ${formatPercent(report.metrics.leadRate)}`,
      `- Durchschnittliche Gespraechsdauer: ${formatDuration(report.metrics.averageConversationDurationSeconds)}`,
      `- Geschaetzte Support-Entlastung: ${report.metrics.estimatedSupportRelief}`,
      `- Unbeantwortete Fragen: ${report.metrics.unansweredQuestions}`,
      `- Abbruchrate: ${formatPercent(report.metrics.dropOffRate)}`,
      '',
      'Top-Fragen:',
      topQuestions,
      '',
      'Aktivste Seiten:',
      activePages,
      '',
      'Empfehlungen:',
      recommendations,
    ].join('\n');
  }
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
