/// <reference types="vite/client" />

import type { TallypineApi } from "../shared/types";

declare global {
  interface Window {
    tallypine: TallypineApi;
  }
}

export {};
