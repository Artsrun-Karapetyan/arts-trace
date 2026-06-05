declare module "html2canvas" {
  export type Options = {
    backgroundColor?: string | null;
    logging?: boolean;
    useCORS?: boolean;
    allowTaint?: boolean;
    ignoreElements?: (element: Element) => boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    scrollX?: number;
    scrollY?: number;
    onclone?: (documentClone: Document, element: HTMLElement) => void;
  };

  export default function html2canvas(
    element: HTMLElement,
    options?: Partial<Options>,
  ): Promise<HTMLCanvasElement>;
}
