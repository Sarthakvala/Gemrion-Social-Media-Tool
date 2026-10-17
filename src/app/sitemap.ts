import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/** Only the public sign-in page is indexable; everything else is behind auth. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: new URL('/login', siteUrl()).toString(), changeFrequency: 'monthly', priority: 1 }];
}
