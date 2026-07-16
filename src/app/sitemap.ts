import type { MetadataRoute } from 'next'
import { getAbsoluteSiteUrl } from '@/lib/server/publicSiteUrl'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: getAbsoluteSiteUrl('/'),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: getAbsoluteSiteUrl('/about'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]
}
