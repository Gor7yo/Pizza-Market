/** Mirrors the breakpoint comment in styles/tokens.css. */
export const BREAKPOINTS = { sm: 640, md: 900, lg: 1200 } as const;

export const MEDIA = {
  mdUp: `(min-width: ${BREAKPOINTS.md}px)`,
} as const;
