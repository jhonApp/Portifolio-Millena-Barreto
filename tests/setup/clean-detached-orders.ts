// RF-09 made an order outlive its customer: deleting a customer now detaches its orders (attempt_id
// becomes NULL) instead of deleting them. The integration tests clean up by deleting their customers,
// so every test file would leave its orders behind, and orders left in APPROVED or PROCESSING would be
// picked up by the generation job of other tests. After each file, remove the orders that have no
// attempt: in the test database they can only be leftovers.
import { createClient } from "@supabase/supabase-js";
import { afterAll } from "vitest";
import { getDatabaseEnv } from "@/lib/diagnostico/env";

afterAll(async () => {
  const env = getDatabaseEnv();
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await db.from("orders").delete().is("attempt_id", null);
});
