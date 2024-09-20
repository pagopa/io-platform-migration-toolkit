/* eslint-disable no-console */
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { toError } from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import { asyncIteratorToArray, filterAsyncIterator } from "@pagopa/io-functions-commons/dist/src/utils/async";

import { Args, Command } from "@oclif/core";

export default class CheckBlobMigration extends Command {
  public static description = "Check Storage Blob migration status";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-platform-migration-ops check_blob_migration`,
  ];

  public static args = {
    statefulStorage: Args.string({ char: "S", description: "Connection string related to storage account used to save progresses and execution results", required: true }),
    targetStorage: Args.string({ char: "t", description: "Connection string related to target storage account", required: true })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(CheckBlobMigration);

    this.log(`Test Check with arguments ${args}`);
  }
}

const getSaveBlobCheckpoint = (containerClient: ContainerClient, blobName: string) => (blobContinuationToken?: string) => pipe(
  blobContinuationToken,
  O.fromNullable,
  O.map(continuationToken => TE.tryCatch(() => containerClient.uploadBlockBlob(blobName, continuationToken, continuationToken?.length), toError)),
  O.getOrElseW(() => TE.of(void 0))
)

const processBlobPage = (saveBlobCheckPoint: ReturnType<typeof getSaveBlobCheckpoint>) => (containerClient: ContainerClient, blobContinuationToken?: string) =>
  pipe(
    containerClient.listBlobsFlat().byPage({ continuationToken: blobContinuationToken, maxPageSize: 1 }),
    pagedIter => TE.tryCatch(() => pagedIter.next(), toError),
    TE.filterOrElseW(res => !res.done, () => Error("Done")),
    TE.map(res => ({ continuationToken: res.value.continuationToken, items: res.value.segment.blobItems })),
    TE.chain(searchRes => saveBlobCheckPoint(searchRes.continuationToken))
  );