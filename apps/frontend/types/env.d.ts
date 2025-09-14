// This file infers types for the cloudflare:workers environment from your Alchemy Worker.
// @see https://alchemy.run/concepts/bindings/#type-safe-bindings

/// <reference types="@cloudflare/workers-types" />

import type { frontend } from "../alchemy.run.ts";

export type CloudflareEnv = typeof frontend.Env;

declare global {
  type Env = CloudflareEnv;
  
  interface ImportMeta {
    main?: boolean;
  }
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
