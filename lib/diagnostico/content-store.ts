import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { ContentError, assertContentComplete, type ContentSet, type ContentTemplate } from "./diagnosis-composer";

type Db = SupabaseClient<Database>;

export { ContentError, assertContentComplete };
export type { ContentSet, ContentTemplate };

/** The templates of the published content version (the one new orders are generated with). */
export async function loadPublishedContent(db: Db): Promise<ContentSet> {
  const { data: version, error } = await db
    .from("content_versions")
    .select("id")
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`loadPublishedContent failed: ${error.message}`);
  if (!version) throw new ContentError(["content_version:published"]);

  const { data: templates, error: templatesError } = await db
    .from("content_templates")
    .select("kind, style, secondary_style, block, position, body")
    .eq("version_id", version.id);
  if (templatesError) throw new Error(`loadPublishedContent failed: ${templatesError.message}`);
  return { versionId: version.id, templates: (templates ?? []) as ContentTemplate[] };
}
