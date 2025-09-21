export const TRUSTED_SOURCES = (process.env.TRUSTED_SOURCES || [
    "https://www.bnm.gov.my/rss",
    "https://www.sc.com.my/resources/media-releases",
    "https://www.bursamalaysia.com/market_information/announcements/company_announcement",
    "https://www.imf.org/en/News",
    "https://www.worldbank.org/en/news",
    "https://www.reuters.com/world/asia-pacific/"
  ]).slice(0,8);
  