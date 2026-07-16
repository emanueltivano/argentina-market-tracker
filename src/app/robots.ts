import type { MetadataRoute } from 'next'
import {
  getAbsoluteSiteUrl,
  getPublicSiteUrl,
} from '@/lib/server/publicSiteUrl'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    host: getPublicSiteUrl(),
    sitemap: getAbsoluteSiteUrl('/sitemap.xml'),
  }
}
