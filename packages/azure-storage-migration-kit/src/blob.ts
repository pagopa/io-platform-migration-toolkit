import * as SB from "@azure/storage-blob";
import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as B from "fp-ts/boolean";
import * as O from "fp-ts/Option";
import * as BU from "./utils/blob";

type BlobClientType = SB.BlobClient | SB.BlockBlobClient;

export class StorageBlobClientWithFallback<T extends BlobClientType> {
  primaryBlobClient: T;
  fallbackBlobClient?: T;

  constructor(primaryBlobClient: T, fallbackBlobClient?: T) {
    this.primaryBlobClient = primaryBlobClient;
    this.fallbackBlobClient = fallbackBlobClient;
  }

  exists = (): Promise<boolean> =>
    pipe(
      BU.exists(this.primaryBlobClient),
      TE.chain((exists) =>
        pipe(
          exists,
          B.fold(
            () =>
              pipe(
                this.fallbackBlobClient,
                O.fromNullable,
                O.map((fc) => BU.exists(fc)),
                O.getOrElse(() => TE.of(exists))
              ),
            () => TE.of(exists)
          )
        )
      ),
      TE.mapLeft((err) => {
        throw err;
      }),
      TE.toUnion
    )();

  generateSasUrl = (options: SB.BlobGenerateSasUrlOptions): Promise<string> =>
    pipe(
      BU.exists(this.primaryBlobClient),
      TE.chain(
        flow(
          O.fromPredicate((exists) => exists),
          O.map(() => BU.generateSasUrl(this.primaryBlobClient, options)),
          O.getOrElse(() =>
            pipe(
              this.fallbackBlobClient,
              O.fromNullable,
              O.map((fc) => BU.generateSasUrl(fc, options)),
              O.getOrElse(() =>
                BU.generateSasUrl(this.primaryBlobClient, options)
              )
            )
          )
        )
      ),
      TE.mapLeft((err) => {
        throw err;
      }),
      TE.toUnion
    )();

  deleteIfExists = (
    options?: SB.BlobDeleteOptions
  ): Promise<SB.BlobDeleteIfExistsResponse> =>
    pipe(
      TE.tryCatch(
        () => this.primaryBlobClient.deleteIfExists(options),
        E.toError
      ),
      TE.chain((primaryDelete) =>
        pipe(
          this.fallbackBlobClient,
          O.fromNullable,
          O.map((fc) =>
            TE.tryCatch(() => fc.deleteIfExists(options), E.toError)
          ),
          O.getOrElse(() => TE.of(primaryDelete))
        )
      ),
      TE.mapLeft((err) => {
        throw err;
      }),
      TE.toUnion
    )();

  downloadToBuffer = (
    offset?: number,
    count?: number,
    options?: SB.BlobDownloadToBufferOptions
  ): Promise<Buffer> =>
    pipe(
      BU.exists(this.primaryBlobClient),
      TE.chain(
        flow(
          O.fromPredicate((exists) => exists),
          O.map(() =>
            BU.downloadToBuffer(this.primaryBlobClient, offset, count, options)
          ),
          O.getOrElse(() =>
            pipe(
              this.fallbackBlobClient,
              O.fromNullable,
              O.map((fc) =>
                TE.tryCatch(
                  () => fc.downloadToBuffer(offset, count, options),
                  E.toError
                )
              ),
              O.getOrElse(() =>
                BU.downloadToBuffer(
                  this.primaryBlobClient,
                  offset,
                  count,
                  options
                )
              )
            )
          )
        )
      ),
      TE.mapLeft((err) => {
        throw err;
      }),
      TE.toUnion
    )();
}

export class BlobClientWithFallback extends StorageBlobClientWithFallback<SB.BlobClient> {
  constructor(
    primaryBlobClient: SB.BlobClient,
    fallbackBlobClient?: SB.BlobClient
  ) {
    super(primaryBlobClient, fallbackBlobClient);
  }
}

export class BlockBlobClientWithFallback extends StorageBlobClientWithFallback<SB.BlockBlobClient> {
  constructor(
    primaryBlobClient: SB.BlockBlobClient,
    fallbackBlobClient?: SB.BlockBlobClient
  ) {
    super(primaryBlobClient, fallbackBlobClient);
  }

  upload = (
    body: SB.HttpRequestBody,
    contentLength: number,
    options?: SB.BlockBlobUploadOptions
  ): Promise<SB.BlockBlobUploadResponse> =>
    this.primaryBlobClient.upload(body, contentLength, options);
}
