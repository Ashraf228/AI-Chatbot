export type ReportFrequency = 'weekly' | 'monthly';

export type TopQuestion = {
  question: string;
  count: number;
};

export type TopPage = {
  pageUrl: string;
  impressions: number;
  openings: number;
};

export type ReportMetrics = {
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
  topQuestions: TopQuestion[];
  mostActivePages: TopPage[];
  unansweredQuestions: number;
  dropOffRate: number;
};

export type ReportRecommendation = {
  title: string;
  detail: string;
};

export type ReportPayload = {
  frequency: ReportFrequency;
  siteId: string;
  siteName: string;
  periodLabel: string;
  recipientEmail: string;
  metrics: ReportMetrics;
  recommendations: ReportRecommendation[];
};

type SiteResponse = {
  name?: string;
  companyName?: string;
};

type SummaryResponse = {
  widgetImpressions?: number;
  widgetOpenings?: number;
  startedChats?: number;
  sentMessages?: number;
  aiAnswerRate?: number;
  fallbackAnswers?: number;
  leads?: number;
  leadRate?: number;
  averageConversationDurationSeconds?: number;
  estimatedSupportRelief?: number;
  topQuestions?: TopQuestion[];
  mostActivePages?: Array<{
    pageUrl: string;
    count?: number;
    impressions?: number;
    openings?: number;
  }>;
};

type OptimizationResponse = {
  unansweredQuestions?: TopQuestion[];
  dropOffSessions?: number;
  recommendations?: string[];
};

export class ReportAggregatorService {
  async aggregate(params: {
    frequency: ReportFrequency;
    siteId: string;
    recipientEmail: string;
  }): Promise<ReportPayload> {
    const apiBase = (process.env.REPORTER_API_BASE_URL || process.env.BACKEND_BASE_URL || "").replace(/\/$/, "");
    const adminKey = process.env.ADMIN_KEY || "";

    if (!apiBase) {
      throw new Error("REPORTER_API_BASE_URL or BACKEND_BASE_URL missing");
    }

    if (!adminKey) {
      throw new Error("ADMIN_KEY missing for reporter");
    }

    const [site, summary, optimization] = await Promise.all([
      this.fetchJson<SiteResponse>(
        `${apiBase}/admin/widget/sites/${params.siteId}`,
        adminKey,
      ),
      this.fetchJson<SummaryResponse>(
        `${apiBase}/admin/widget/events/summary?siteId=${encodeURIComponent(params.siteId)}`,
        adminKey,
      ),
      this.fetchJson<OptimizationResponse>(
        `${apiBase}/admin/widget/optimization?siteId=${encodeURIComponent(params.siteId)}`,
        adminKey,
      ),
    ]);

    const metrics: ReportMetrics = {
      widgetImpressions: Number(summary.widgetImpressions || 0),
      widgetOpenings: Number(summary.widgetOpenings || 0),
      startedChats: Number(summary.startedChats || 0),
      sentMessages: Number(summary.sentMessages || 0),
      aiAnswerRate: Number(summary.aiAnswerRate || 0),
      fallbackAnswers: Number(summary.fallbackAnswers || 0),
      leads: Number(summary.leads || 0),
      leadRate: Number(summary.leadRate || 0),
      averageConversationDurationSeconds: Number(summary.averageConversationDurationSeconds || 0),
      estimatedSupportRelief: Number(summary.estimatedSupportRelief || 0),
      topQuestions: Array.isArray(summary.topQuestions) ? summary.topQuestions : [],
      mostActivePages: Array.isArray(summary.mostActivePages)
        ? summary.mostActivePages.map((item) => ({
            pageUrl: item.pageUrl,
            impressions: Number(item.count || item.impressions || 0),
            openings: Number(item.count || item.openings || 0),
          }))
        : [],
      unansweredQuestions: Array.isArray(optimization.unansweredQuestions)
        ? optimization.unansweredQuestions.length
        : 0,
      dropOffRate:
        Number(summary.startedChats || 0) > 0
          ? Number(optimization.dropOffSessions || 0) / Number(summary.startedChats || 1)
          : 0,
    };

    return {
      frequency: params.frequency,
      siteId: params.siteId,
      siteName: site.companyName || site.name || params.siteId,
      periodLabel: params.frequency === 'weekly' ? 'Woche' : 'Monat',
      recipientEmail: params.recipientEmail,
      metrics,
      recommendations:
        Array.isArray(optimization.recommendations) && optimization.recommendations.length > 0
          ? optimization.recommendations.map((item: string) => ({
              title: 'Empfehlung',
              detail: item,
            }))
          : this.buildRecommendations(metrics),
    };
  }

  private async fetchJson<T>(url: string, adminKey: string): Promise<T> {
    const res = await fetch(url, {
      headers: {
        "X-ADMIN-KEY": adminKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Reporter request failed: ${res.status} ${url}`);
    }

    return (await res.json()) as T;
  }

  private buildRecommendations(metrics: ReportMetrics): ReportRecommendation[] {
    const recommendations: ReportRecommendation[] = [];

    if (metrics.unansweredQuestions > 0) {
      recommendations.push({
        title: 'Unbeantwortete Fragen prüfen',
        detail: 'Erweitere die Wissensbasis für Fragen, die derzeit ohne gute Antwort bleiben.',
      });
    }

    if (metrics.dropOffRate > 0.4) {
      recommendations.push({
        title: 'Abbruchstellen reduzieren',
        detail: 'Prüfe Begrüßung, Antwortlänge und Lead-Zeitpunkt, um mehr Besucher im Flow zu halten.',
      });
    }

    if (metrics.leadRate < 0.03) {
      recommendations.push({
        title: 'Lead-Funnel verbessern',
        detail: 'Teste klarere Call-to-Actions und einen einfacheren Lead-Formular-Trigger.',
      });
    }

    if (metrics.fallbackAnswers > 0) {
      recommendations.push({
        title: 'Fallback-Antworten senken',
        detail: 'Analysiere Fallback-Fälle und ergänze fehlende Regeln oder Trainingsdaten.',
      });
    }

    if (metrics.aiAnswerRate < 0.9) {
      recommendations.push({
        title: 'Antwortquote verbessern',
        detail: 'Prüfe Chat-Fehler, Timeouts und Retrieval-Lücken, um mehr Anfragen sauber zu beantworten.',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        title: 'Stabile Entwicklung',
        detail: 'Aktuell sind keine kritischen Optimierungsauffälligkeiten im Report vorhanden.',
      });
    }

    return recommendations;
  }
}
