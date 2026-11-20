import { buildExamples } from "@/lib/guide/examples";
import { REDEMPTION_AVAILABLE } from "@/lib/wallet/availability";
import { ExampleTabs } from "./example-tabs";

/**
 * Three small businesses and the promotion each would run.
 *
 * A server component so the facts are worked out where the engine's functions
 * can be called, and so what is true today about spending a balance
 * (REDEMPTION_AVAILABLE) is read from the flag and not remembered. The tabs
 * receive finished sentences.
 */
export function WorkedExamples() {
  return <ExampleTabs examples={buildExamples(REDEMPTION_AVAILABLE)} />;
}
