import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { asyncIterableToArray } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { flow, pipe } from "fp-ts/lib/function";
import { toError } from "fp-ts/lib/Either";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";

export const createContainerClientIfNotExistsOrGet = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
): TE.TaskEither<Error, ContainerClient> =>
  pipe(
    blobServiceClient.listContainers(),
    (iter) => TE.tryCatch(() => asyncIterableToArray(iter), toError),
    TE.map(RA.filter((item) => item.name === containerName)),
    TE.map(RA.head),
    TE.chain(
      flow(
        O.map(() => TE.of(blobServiceClient.getContainerClient(containerName))),
        O.getOrElse(() =>
          pipe(
            TE.tryCatch(
              () => blobServiceClient.createContainer(containerName),
              toError,
            ),
            TE.map((response) => response.containerClient),
          ),
        ),
      ),
    ),
  );
