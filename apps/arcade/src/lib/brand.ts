/**
 * Brand configuration module.
 *
 * Provides a safe rollback toggle for the brand name.
 *
 * To revert to the previous brand name set:
 *   NEXT_PUBLIC_BRAND_NAME=Reach
 * in your environment before restarting the application.
 *
 * Default: "ReadyLayer"
 */
export const BRAND_NAME: string =
  process.env.NEXT_PUBLIC_BRAND_NAME ?? "ReadyLayer";
