import { Router, type RequestHandler } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { z } from "zod";
import { pool } from "../config/database.js";
import { requireAuth } from "../middleware/require-auth.js";

export const documentUploadRouter = Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 100_000;
const allowedTypes = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
} as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0, parts: 1 },
});

const uploadSingleFile: RequestHandler = (request, response, next) => {
  upload.single("file")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      response.status(tooLarge ? 413 : 400).json({
        error: {
          code: tooLarge ? "FILE_TOO_LARGE" : "INVALID_UPLOAD",
          message: tooLarge ? "The maximum file size is 10 MB" : "Upload exactly one file using the 'file' field",
        },
      });
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
};

const validateProjectAccess: RequestHandler = async (request, response, next) => {
  const parsedId = z.uuid().safeParse(request.params.projectId);
  if (!parsedId.success) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid project ID" } });
    return;
  }

  const result = await pool.query(
    "SELECT id FROM projects WHERE id = $1 AND owner_id = $2 AND status = 'ACTIVE'",
    [parsedId.data, request.authenticatedUserId],
  );
  if (result.rowCount === 0) {
    response.status(404).json({ error: { code: "PROJECT_NOT_FOUND", message: "Active project not found" } });
    return;
  }
  next();
};

function validateFile(file: Express.Multer.File): { extension: keyof typeof allowedTypes; mimeType: string } | null {
  const extension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
  if (!(extension in allowedTypes)) return null;
  const expectedMime = allowedTypes[extension as keyof typeof allowedTypes];
  if (file.mimetype !== expectedMime) return null;

  if (extension === ".pdf" && !file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) return null;
  if (extension === ".docx" && !file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return null;
  if (extension === ".txt" && file.buffer.includes(0)) return null;

  return { extension: extension as keyof typeof allowedTypes, mimeType: expectedMime };
}

function normalizeExtractedText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[\t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

documentUploadRouter.post(
  "/projects/:projectId/requirements/preview",
  requireAuth,
  validateProjectAccess,
  uploadSingleFile,
  async (request, response) => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ error: { code: "FILE_REQUIRED", message: "Choose a PDF, DOCX, or TXT file in the 'file' field" } });
      return;
    }

    const validated = validateFile(file);
    if (!validated) {
      response.status(415).json({
        error: { code: "UNSUPPORTED_FILE", message: "Only valid PDF, DOCX, and TXT files are accepted" },
      });
      return;
    }

    let extractedText = "";
    try {
      if (validated.extension === ".pdf") {
        const parsed = await pdfParse(file.buffer);
        extractedText = parsed.text;
      } else if (validated.extension === ".docx") {
        const parsed = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = parsed.value;
      } else {
        extractedText = new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
      }
    } catch {
      response.status(422).json({
        error: { code: "DOCUMENT_EXTRACTION_FAILED", message: "The file could not be read. Check that it is a valid, unencrypted document encoded as UTF-8 for TXT files." },
      });
      return;
    }

    extractedText = normalizeExtractedText(extractedText);
    if (!extractedText) {
      response.status(422).json({ error: { code: "EMPTY_DOCUMENT", message: "No readable text was found in this document" } });
      return;
    }
    if (extractedText.length > MAX_EXTRACTED_CHARACTERS) {
      response.status(413).json({
        error: { code: "DOCUMENT_TEXT_TOO_LARGE", message: "The extracted text exceeds 100,000 characters. Split the document into smaller files and upload again." },
      });
      return;
    }

    response.status(200).json({
      data: {
        projectId: request.params.projectId,
        fileName: file.originalname,
        mimeType: validated.mimeType,
        sizeBytes: file.size,
        characterCount: extractedText.length,
        extractedText,
      },
    });
  },
);
