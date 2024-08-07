import * as SB from "@azure/storage-blob";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type ContainerClientWithFallBackType = {
  readonly primary: SB.ContainerClient;
  readonly secondary?: SB.ContainerClient;

  readonly getBlobClient: (blobName: string) => SB.BlobClient;
  readonly getBlockBlobClient: (blobName: string) => SB.BlockBlobClient;
  readonly uploadBlockBlob: (
    blobName: string,
    body: SB.HttpRequestBody,
    contentLength: number,
    options?: SB.BlockBlobUploadOptions
  ) => Promise<{
    blockBlobClient: SB.BlockBlobClient;
    response: SB.BlockBlobUploadResponse;
  }>;
};

export type FallbackTracker = (containerName: string, blobName: string) => void;
