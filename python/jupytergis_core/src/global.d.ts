import type { IOpenEOTokensProvider } from '@jupytergis/schema';

declare global {
  interface Window {
    openEOTokensProvider: IOpenEOTokensProvider;
  }
}
