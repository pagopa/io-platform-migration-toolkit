import * as SB from "@azure/storage-blob";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import { BlobClientWithFallback, BlockBlobClientWithFallback } from "./blob";

export class BaseContainerClientWithFallback {
  primaryContainerClient: SB.ContainerClient;
  fallbackContainerClient?: SB.ContainerClient;

  constructor(
    primaryContainerClient: SB.ContainerClient,
    fallbackContainerClient?: SB.ContainerClient
  ) {
    this.primaryContainerClient = primaryContainerClient;
    this.fallbackContainerClient = fallbackContainerClient;
  }

  public getBlobClient = (blobName: string): BlobClientWithFallback =>
    new BlobClientWithFallback(
      this.primaryContainerClient.getBlobClient(blobName),
      pipe(
        this.fallbackContainerClient,
        O.fromNullable,
        O.map((fc) => fc.getBlobClient(blobName)),
        O.toUndefined
      )
    );

  public getBlockBlobClient = (blobName: string): BlockBlobClientWithFallback =>
    new BlockBlobClientWithFallback(
      this.primaryContainerClient.getBlockBlobClient(blobName),
      pipe(
        this.fallbackContainerClient,
        O.fromNullable,
        O.map((fc) => fc.getBlockBlobClient(blobName)),
        O.toUndefined
      )
    );

  public uploadBlockBlob(
    blobName: string,
    body: SB.HttpRequestBody,
    contentLength: number,
    options?: SB.BlockBlobUploadOptions
  ): Promise<{
    blockBlobClient: SB.BlockBlobClient;
    response: SB.BlockBlobUploadResponse;
  }> {
    return this.primaryContainerClient.uploadBlockBlob(
      blobName,
      body,
      contentLength,
      options
    );
  }
}

export class ContainerClientFromConnectionStringWithFallBack extends BaseContainerClientWithFallback {
  constructor(
    primaryConnectionString: string,
    containerName: string,
    fallbackConnectionString?: string,
    options?: SB.StoragePipelineOptions
  ) {
    super(
      new SB.ContainerClient(primaryConnectionString, containerName, options),
      pipe(
        fallbackConnectionString,
        O.fromNullable,
        O.map((conn) => new SB.ContainerClient(conn, containerName, options)),
        O.toUndefined
      )
    );
  }
}