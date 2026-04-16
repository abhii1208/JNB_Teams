const NEWS_TOPICS = {
  finance: {
    label: 'latest finance news',
    endpoint: 'top-headlines',
    rssQuery: 'finance OR stock market when:1d',
    params: {
      category: 'business',
      country: process.env.NEWS_API_COUNTRY || 'us',
      language: process.env.NEWS_API_LANGUAGE || 'en',
      pageSize: '6',
    },
  },
  today: {
    label: "today's updates",
    endpoint: 'top-headlines',
    rssQuery: 'latest updates when:1d',
    params: {
      country: process.env.NEWS_API_COUNTRY || 'us',
      language: process.env.NEWS_API_LANGUAGE || 'en',
      pageSize: '6',
    },
  },
};

const DEFAULT_REFRESH_MS = 30 * 60 * 1000;
const digestCache = new Map();

function getRefreshMs() {
  const parsed = Number(process.env.NEWS_DIGEST_REFRESH_MS || DEFAULT_REFRESH_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REFRESH_MS;
}

function getNewsApiConfig() {
  const apiKey = process.env.NEWS_API_KEY || '';
  const baseUrl = process.env.NEWS_API_BASE_URL || 'https://newsapi.org/v2';
  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ''),
  };
}

function formatPublishedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function normalizeArticles(rawArticles = []) {
  return rawArticles
    .filter((article) => article && article.title)
    .slice(0, 6)
    .map((article) => ({
      title: String(article.title || '').trim(),
      description: String(article.description || '').trim(),
      source: String(article?.source?.name || 'Unknown source').trim(),
      publishedAt: article.publishedAt || null,
      url: article.url || null,
    }));
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value) {
  return decodeXml(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTagValue(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match ? stripHtml(match[1]) : '';
}

function normalizeRssArticles(xmlText = '') {
  const items = Array.from(xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi));
  return items.slice(0, 6).map((match) => {
    const block = match[1];
    return {
      title: getTagValue(block, 'title'),
      description: getTagValue(block, 'description'),
      source: getTagValue(block, 'source') || 'Google News',
      publishedAt: getTagValue(block, 'pubDate') || null,
      url: getTagValue(block, 'link') || null,
    };
  }).filter((article) => article.title);
}

function getGoogleNewsRssUrl(topicKey) {
  const topic = NEWS_TOPICS[topicKey];
  const language = process.env.NEWS_RSS_LANGUAGE || 'en-US';
  const geo = process.env.NEWS_RSS_REGION || 'US';
  const ceid = `${geo}:${language.split('-')[0] || 'en'}`;
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', topic?.rssQuery || 'latest news when:1d');
  url.searchParams.set('hl', language);
  url.searchParams.set('gl', geo);
  url.searchParams.set('ceid', ceid);
  return url.toString();
}

function buildSummary(topicKey, articles, fetchedAt) {
  const topic = NEWS_TOPICS[topicKey];
  const updatedLabel = formatPublishedAt(fetchedAt);

  if (!articles.length) {
    return `I checked ${topic?.label || 'the latest news'}, but there are no fresh headlines available right now.`;
  }

  const intro = topicKey === 'finance'
    ? `Here is a quick summary of the latest finance news${updatedLabel ? ` as of ${updatedLabel}` : ''}.`
    : `Here are today's headline updates${updatedLabel ? ` as of ${updatedLabel}` : ''}.`;

  const lines = articles.slice(0, 4).map((article, index) => {
    const detail = article.description ? ` ${article.description}` : '';
    return `${index + 1}. ${article.title} (${article.source}).${detail}`;
  });

  return [intro, ...lines].join(' ');
}

async function fetchNewsArticles(topicKey) {
  const topic = NEWS_TOPICS[topicKey];
  if (!topic) {
    const error = new Error(`Unsupported news topic: ${topicKey}`);
    error.status = 400;
    throw error;
  }

  const config = getNewsApiConfig();
  if (!config.apiKey) {
    const error = new Error('NEWS_API_KEY is not configured');
    error.code = 'missing_api_key';
    throw error;
  }

  const url = new URL(`${config.baseUrl}/${topic.endpoint}`);
  Object.entries(topic.params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      'X-Api-Key': config.apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`News API request failed with status ${response.status}: ${body}`);
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  return normalizeArticles(payload.articles);
}

async function fetchGoogleNewsRssArticles(topicKey) {
  const response = await fetch(getGoogleNewsRssUrl(topicKey), {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Google News RSS request failed with status ${response.status}: ${body}`);
    error.status = response.status;
    throw error;
  }

  const xml = await response.text();
  return normalizeRssArticles(xml);
}

async function refreshNewsDigest(topicKey, options = {}) {
  const now = Date.now();
  const cached = digestCache.get(topicKey);
  const refreshMs = getRefreshMs();
  const shouldReuse = !options.force && cached && now - cached.fetchedAt < refreshMs;

  if (shouldReuse) {
    return cached;
  }

  try {
    const articles = await fetchNewsArticles(topicKey);
    const next = {
      topic: topicKey,
      fetchedAt: now,
      summary: buildSummary(topicKey, articles, now),
      articles,
      stale: false,
      source: 'external_api',
    };
    digestCache.set(topicKey, next);
    return next;
  } catch (error) {
    try {
      const articles = await fetchGoogleNewsRssArticles(topicKey);
      const next = {
        topic: topicKey,
        fetchedAt: now,
        summary: buildSummary(topicKey, articles, now),
        articles,
        stale: false,
        source: 'rss_fallback',
      };
      digestCache.set(topicKey, next);
      return next;
    } catch (_rssError) {
      if (cached) {
        return {
          ...cached,
          stale: true,
          summary: `${cached.summary} Note: this digest is from the most recent successful refresh because live news sources are temporarily unavailable.`,
        };
      }
    }

    if (error.code === 'missing_api_key') {
      return {
        topic: topicKey,
        fetchedAt: now,
        summary: 'Live news is temporarily unavailable right now. Add NEWS_API_KEY in the backend environment for the primary news provider, or try again in a moment.',
        articles: [],
        stale: true,
        source: 'configuration',
      };
    }

    throw error;
  }
}

function detectNewsTopic(message) {
  const lower = String(message || '').toLowerCase();

  const asksForFinance = /(finance|financial|market|markets|stock|stocks|business news)/.test(lower);
  const asksForNews = /(news|headline|headlines|digest)/.test(lower);
  const asksForToday = /(today|today's|todays|latest|recent|current)/.test(lower);
  const explicitTodayNews = /\b(today|today's|todays)\s+(news|headlines|digest)\b/.test(lower);
  const explicitLatestNews = /\b(latest|recent|current)\s+(news|headlines|digest)\b/.test(lower);

  if (asksForFinance && asksForNews) return 'finance';
  if (asksForFinance && asksForToday) return 'finance';
  if (asksForToday && asksForNews) return 'today';
  if (explicitTodayNews || explicitLatestNews) return 'today';
  if (lower.includes('show latest finance news')) return 'finance';

  return null;
}

module.exports = {
  detectNewsTopic,
  refreshNewsDigest,
};
