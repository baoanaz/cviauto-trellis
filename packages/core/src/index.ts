// Root barrel — re-exports the channel and task public APIs so callers
// can `import { ... } from "@mindfoldhq/cviauto-core"`. Sub-path
// imports (`@mindfoldhq/cviauto-core/channel`, `/task`) remain the
// recommended form for tree-shake-friendly consumption.

export * from "./channel/index.js";
export * from "./task/index.js";
