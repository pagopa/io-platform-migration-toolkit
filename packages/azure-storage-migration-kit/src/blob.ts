import * as SB from "@azure/storage-blob";
import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as B from "fp-ts/boolean";
import * as O from "fp-ts/Option";
import * as BU from "./utils/blob";
import { FallbackTracker } from "./types";
import { consumeFallbackTrackerWithTaskEither } from "./tracking";

type BlobClientType = SB.BlobClient | SB.BlockBlobClient;

export class StorageBlobClientWithFallback<T extends BlobClientType> {
  primaryBlobClient: T;
  fallbackBlobClient?: T;
  fallbackTracker?: FallbackTracker;

  constructor(
    primaryBlobClient: T,
    fallbackBlobClient?: T,
    fallbackTracker?: FallbackTracker
  ) {
    this.primaryBlobClient = primaryBlobClient;
    this.fallbackBlobClient = fallbackBlobClient;
    this.fallbackTracker = fallbackTracker;
    this.exists.bind(this);
    this.deleteIfExists.bind(this);
    this.downloadToBuffer.bind(this);
    this.download.bind(this);
    this.generateSasUrl.bind(this);
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
                O.map((fc) =>
                  pipe(
                    BU.exists(fc),
                    consumeFallbackTrackerWithTaskEither(
                      fc.containerName,
                      fc.name,
                      this.fallbackTracker
                    )
                  )
                ),
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
              O.map((fc) =>
                pipe(
                  BU.generateSasUrl(fc, options),
                  consumeFallbackTrackerWithTaskEither(
                    fc.containerName,
                    fc.name,
                    this.fallbackTracker
                  )
                )
              ),
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
            pipe(
              TE.tryCatch(() => fc.deleteIfExists(options), E.toError),
              consumeFallbackTrackerWithTaskEither(
                fc.containerName,
                fc.name,
                this.fallbackTracker
              ),
              TE.map((fallbackDelete) =>
                pipe(
                  fallbackDelete.succeeded,
                  B.fold(
                    () => primaryDelete,
                    () => fallbackDelete
                  )
                )
              )
            )
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
                pipe(
                  TE.tryCatch(
                    () => fc.downloadToBuffer(offset, count, options),
                    E.toError
                  ),
                  consumeFallbackTrackerWithTaskEither(
                    fc.containerName,
                    fc.name,
                    this.fallbackTracker
                  )
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

  download = (
    offset?: number,
    count?: number,
    options?: SB.BlobDownloadOptions
  ): Promise<SB.BlobDownloadResponseParsed> =>
    pipe(
      BU.exists(this.primaryBlobClient),
      TE.chain(
        flow(
          O.fromPredicate((exists) => exists),
          O.map(() =>
            BU.download(this.primaryBlobClient, offset, count, options)
          ),
          O.getOrElse(() =>
            pipe(
              this.fallbackBlobClient,
              O.fromNullable,
              O.map((fc) =>
                pipe(
                  TE.tryCatch(
                    () => fc.download(offset, count, options),
                    E.toError
                  ),
                  consumeFallbackTrackerWithTaskEither(
                    fc.containerName,
                    fc.name,
                    this.fallbackTracker
                  )
                )
              ),
              O.getOrElse(() =>
                BU.download(this.primaryBlobClient, offset, count, options)
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
    fallbackBlobClient?: SB.BlobClient,
    fallbackTracker?: FallbackTracker
  ) {
    super(primaryBlobClient, fallbackBlobClient, fallbackTracker);
  }
}

export class BlockBlobClientWithFallback extends StorageBlobClientWithFallback<SB.BlockBlobClient> {
  constructor(
    primaryBlobClient: SB.BlockBlobClient,
    fallbackBlobClient?: SB.BlockBlobClient,
    fallbackTracker?: FallbackTracker
  ) {
    super(primaryBlobClient, fallbackBlobClient, fallbackTracker);
    this.upload.bind(this);
  }

  upload = (
    body: SB.HttpRequestBody,
    contentLength: number,
    options?: SB.BlockBlobUploadOptions
  ): Promise<SB.BlockBlobUploadResponse> =>
    this.primaryBlobClient.upload(body, contentLength, options);
}
