import { TokenCredential } from "@azure/core-auth";
import * as SB from "@azure/storage-blob";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import { BaseContainerClientWithFallback } from "./container";
import { FallbackTracker } from "./types";

export class BlobServiceClientWithFallBack {
  primaryBlobServiceClient: SB.BlobServiceClient;
  fallbackBlobServiceClient?: SB.BlobServiceClient;
  fallbackTracker?: FallbackTracker;

  constructor(
    primaryBlobServiceClient: SB.BlobServiceClient,
    fallbackBlobServiceClient?: SB.BlobServiceClient,
    fallbackTracker?: FallbackTracker
  ) {
    this.primaryBlobServiceClient = primaryBlobServiceClient;
    this.fallbackBlobServiceClient = fallbackBlobServiceClient;
    this.fallbackTracker = fallbackTracker;
    this.getContainerClient.bind(this);
  }

  static fromConnectionString = (
    primaryConnectionString: string,
    fallbackConnectionString?: string,
    options?: SB.StoragePipelineOptions,
    fallbackTracker?: FallbackTracker
  ): BlobServiceClientWithFallBack =>
    new BlobServiceClientWithFallBack(
      SB.BlobServiceClient.fromConnectionString(
        primaryConnectionString,
        options
      ),
      pipe(
        fallbackConnectionString,
        O.fromNullable,
        O.map((connStr) =>
          SB.BlobServiceClient.fromConnectionString(connStr, options)
        ),
        O.toUndefined
      ),
      fallbackTracker
    );

  // see https://github.com/Azure/azure-sdk-for-js/blob/e92fbde81c9c30a831fa2f502e47835381007097/sdk/storage/storage-blob/src/BlobServiceClient.ts#L482
  getContainerClient = (containerName: string) =>
    new BaseContainerClientWithFallback(
      this.primaryBlobServiceClient.getContainerClient(containerName),
      pipe(
        this.fallbackBlobServiceClient,
        O.fromNullable,
        O.map((client) => client.getContainerClient(containerName)),
        O.toUndefined
      ),
      this.fallbackTracker
    );
}
export class PasswordLessBlobServiceClientWithFallBack extends BlobServiceClientWithFallBack {
  constructor(
    primaryUrl: string,
    fallbackUrl?: string,
    credential?:
      | SB.StorageSharedKeyCredential
      | SB.AnonymousCredential
      | TokenCredential,
    options?: SB.StoragePipelineOptions,
    fallbackTracker?: FallbackTracker
  ) {
    super(
      new SB.BlobServiceClient(primaryUrl, credential, options),
      pipe(
        fallbackUrl,
        O.fromNullable,
        O.map((url) => new SB.BlobServiceClient(url, credential, options)),
        O.toUndefined
      ),
      fallbackTracker
    );
  }
}
