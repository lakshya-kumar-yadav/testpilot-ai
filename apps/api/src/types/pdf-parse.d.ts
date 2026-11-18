declare module "pdf-parse" {
  import type { Buffer } from "node:buffer";

  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
    text: string;
  }

  function pdfParse(data: Buffer): Promise<PdfParseResult>;

  export default pdfParse;
}
