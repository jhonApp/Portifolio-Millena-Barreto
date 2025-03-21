import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    {
      url:'http://millenabarreto.com.br/'
    }
  ]
}