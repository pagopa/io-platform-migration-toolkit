import { BlobService } from "azure-storage";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type BlobServiceWithFallBack = {
  readonly primary: BlobService;
  readonly secondary?: BlobService;
};

export type StorageError = Error & {
  readonly code?: string;
};

// BLOB STORAGE FUNCTIONS AND TYPES

// Code used by blobService when a blob is not found
export const GenericCode = "GenericCode";
export const BlobNotFoundCode = "BlobNotFound";

export type FallbackTracker = (containerName: string, blobName: string) => void;
