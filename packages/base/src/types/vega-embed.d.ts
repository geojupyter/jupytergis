declare module 'vega-embed' {
  interface EmbedOptions {
    actions?: boolean | { export?: boolean; source?: boolean; compiled?: boolean; editor?: boolean };
    mode?: 'vega' | 'vega-lite';
    theme?: 'excel' | 'ggplot2' | 'quartz' | 'vox' | 'dark';
    renderer?: 'canvas' | 'svg';
    width?: number;
    height?: number;
    padding?: number | { left?: number; right?: number; top?: number; bottom?: number };
    scaleFactor?: number;
    config?: Record<string, any>;
    editorUrl?: string;
    sourceHeader?: string;
    sourceFooter?: string;
    hover?: boolean;
    i18n?: Record<string, any>;
    downloadFileName?: string;
    formatLocale?: Record<string, any>;
    timeFormatLocale?: Record<string, any>;
    expressionFunctions?: Record<string, any>;
    ast?: boolean;
    expr?: any;
    viewClass?: any;
  }

  interface Result {
    view: any;
    spec: any;
    vgSpec: any;
    finalize: () => void;
  }

  function embed(
    el: HTMLElement | string,
    spec: Record<string, any> | string,
    opts?: EmbedOptions,
  ): Promise<Result>;

  export default embed;
}
