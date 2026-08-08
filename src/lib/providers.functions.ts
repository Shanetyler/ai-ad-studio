import { createServerFn } from "@tanstack/react-start";
import { providerStatus } from "@/lib/providers/index.server";

/** Public: reports which generation providers are live vs running in demo mode. */
export const getProviderStatus = createServerFn({ method: "GET" }).handler(async () => {
  return providerStatus();
});
