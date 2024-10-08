import { ContainerClient } from "@azure/storage-blob";
import { toError } from "fp-ts/lib/Either";
import { constVoid, pipe } from "fp-ts/lib/function";
import * as J from "fp-ts/Json";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";

export const BlobStorageCheckpoint = t.intersection([
  t.type({
    alreadyVisitedContainers: t.array(t.string),
    lastContainerName: t.string,
  }),
  t.partial({
    continuationToken: t.string,
  }),
]);
export type BlobStorageCheckpoint = t.TypeOf<typeof BlobStorageCheckpoint>;

export const getCheckpoint = (
  containerClient: ContainerClient,
  blobName: string,
) =>
  pipe(
    containerClient.getBlobClient(blobName),
    (blobClient) => TE.tryCatch(() => blobClient.downloadToBuffer(), toError),
    TE.map((buffer) => buffer.toString()),
    TE.chainEitherKW(J.parse),
    TE.chainEitherKW(BlobStorageCheckpoint.decode),
    TE.mapLeft(() => undefined),
    TE.toUnion,
  );

export const getSaveBlobCheckpoint =
  (containerClient: ContainerClient, blobName: string) =>
  (
    alreadyVisitedContainers: string[],
    lastContainerName: string,
    blobContinuationToken?: string,
  ) =>
    pipe(
      BlobStorageCheckpoint.encode({
        alreadyVisitedContainers,
        lastContainerName,
        continuationToken: blobContinuationToken,
      }),
      JSON.stringify,
      (checkpoint) =>
        TE.tryCatch(
          () =>
            containerClient.uploadBlockBlob(
              blobName,
              checkpoint,
              checkpoint.length,
            ),
          toError,
        ),
      TE.map(constVoid),
    );
