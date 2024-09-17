/* eslint-disable no-console */
import { BlobServiceClient } from "@azure/storage-blob";
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
    statefulStorage: Args.string({ char: "S", description: "Connection string related to storage account used to save progresses and execution results", required: true}),
    targetStorage: Args.string({ char: "t", description: "Connection string related to target storage account", required: true })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(CheckBlobMigration);

    this.log(`Check with arguments ${args}`);
  }
}

const test = (connString: string, containername: string) =>
    pipe(
      BlobServiceClient.fromConnectionString(connString),
      (client) => client.getContainerClient(containername),
      (containerClient) => containerClient.listBlobsFlat(),
      (pagedIter) =>
        filterAsyncIterator(pagedIter, (blob) =>
          pipe(
            blob.objectReplicationSourceProperties,
            O.fromNullable,
            O.map(
              (replicaProps) =>
                replicaProps.find((p) =>
                  p.rules.find((r) => r.replicationStatus === "complete")
                ) === undefined
            ),
            O.getOrElse(() => true)
          )
        ),
      (iter) => TE.tryCatch(() => asyncIteratorToArray(iter), toError),
      TE.map(RA.map((b) => b.name)),
      TE.toUnion
    )();