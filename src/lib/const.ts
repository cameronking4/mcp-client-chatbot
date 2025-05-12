

export const IS_DEV = process.env.NODE_ENV !== "production";
export const IS_BROWSER = typeof window !== "undefined";

declare const EdgeRuntime: any;
export const IS_EDGE_RUNTIME = typeof EdgeRuntime !== "undefined";