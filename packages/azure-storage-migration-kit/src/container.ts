import * as SB from "@azure/storage-blob";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";

export class ContainerClientWithFallBack {
  private primaryContainerClient: SB.ContainerClient;
  private fallbackContainerClient?: SB.ContainerClient;

  constructor(
    primaryConnectionString: string,
    containerName: string,
    fallbackConnectionString?: string,
    options?: SB.StoragePipelineOptions
  ) {
    this.primaryContainerClient = new SB.ContainerClient(
      primaryConnectionString,
      containerName,
      options
    );
    this.fallbackContainerClient = pipe(
      fallbackConnectionString,
      O.fromNullable,
      O.map((conn) => new SB.ContainerClient(conn, containerName, options)),
      O.toUndefined
    );
  }

  public getBlobClient(blobName: string): SB.BlobClient {
    return pipe(
      this.primaryContainerClient.getBlobClient(blobName),
      O.fromNullable,
      O.getOrElse(() =>
        pipe(
          this.fallbackContainerClient,
          O.fromNullable,
          O.map((fc) => fc.getBlobClient(blobName)),
          O.toUndefined,
          (client) => client as SB.BlobClient
        )
      )
    );
  }

  public getBlockBlobClient(blobName: string): SB.BlockBlobClient {
    return pipe(
      this.primaryContainerClient.getBlockBlobClient(blobName),
      O.fromNullable,
      O.getOrElse(() =>
        pipe(
          this.fallbackContainerClient,
          O.fromNullable,
          O.map((fc) => fc.getBlockBlobClient(blobName)),
          O.toUndefined,
          (client) => client as SB.BlockBlobClient
        )
      )
    );
  }

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
