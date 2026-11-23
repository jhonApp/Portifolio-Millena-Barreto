import { readDuelLook } from "@/lib/diagnostico/duel-looks";
import { apiError } from "@/lib/diagnostico/errors";
import type { Style } from "@/lib/diagnostico/constants";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = "Imagem não encontrada.";

// Serves the look of a duel alternative. The browser only knows the alternative id: the style is
// read here, on the server, and nothing in the response (headers, body, file name) names it.
export async function GET(
  _request: Request,
  { params }: { params: { alternativeId: string } },
): Promise<Response> {
  const alternativeId = params.alternativeId;
  if (!UUID.test(alternativeId)) return apiError("NOT_FOUND", NOT_FOUND, 404);

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("alternatives")
      .select("style, questions!inner(kind)")
      .eq("id", alternativeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const kind = (data as { questions: { kind: string } | null } | null)?.questions?.kind;
    if (!data || kind !== "duel") return apiError("NOT_FOUND", NOT_FOUND, 404);

    const bytes = await readDuelLook(data.style as Style);
    if (!bytes) {
      // Only the alternative id is logged, never the style or a file name.
      console.error("duel look route: image unavailable for alternative", alternativeId);
      return apiError("NOT_FOUND", NOT_FOUND, 404);
    }
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(bytes.length),
        // A published alternative never changes its style, so the copy can be cached for good.
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: `"${alternativeId}"`,
      },
    });
  } catch (error) {
    console.error(
      "duel look route: unexpected error for alternative",
      alternativeId,
      error instanceof Error ? error.message : "unknown",
    );
    return apiError("INTERNAL_ERROR", "Não foi possível carregar a imagem.", 500);
  }
}
