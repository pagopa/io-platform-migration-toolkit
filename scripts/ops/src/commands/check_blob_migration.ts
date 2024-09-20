/* eslint-disable no-console */
import { BlobServiceClient } from "@azure/storage-blob";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";

import { Args, Command } from "@oclif/core";
import { createContainerClientIfNotExistsOrGet } from "../utils/storage";
import { getCheckpoint, getSaveBlobCheckpoint } from "../utils/checkpoint";

export default class CheckBlobMigration extends Command {
  public static description = "Check Storage Blob migration status";

  // tslint:disable-next-line: readonly-array
  public static examples = [`$ io-platform-migration-ops check_blob_migration`];

  public static args = {
    id: Args.string({
      char: "i",
      description: "Check identifier",
      required: true,
    }),
    statefulStorage: Args.string({
      char: "s",
      description:
        "Connection string related to storage account used to save progresses and execution results",
      required: true,
    }),
    targetStorage: Args.string({
      char: "t",
      description: "Connection string related to target storage account",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(CheckBlobMigration);

    this.log(`Test Check with arguments ${args}`);
    const targetClient = BlobServiceClient.fromConnectionString(
      args.statefulStorage,
    );
    const statefulClient = await pipe(
      createContainerClientIfNotExistsOrGet(
        BlobServiceClient.fromConnectionString(args.statefulStorage),
        args.id,
      ),
      TE.getOrElse((err) => {
        this.log(`Cannot initialize stateful client for container ${args.id}`);
        throw err;
      }),
    )();
    const saveBlobCheckPoint = getSaveBlobCheckpoint(
      statefulClient,
      `checkpoint_${targetClient.accountName}`,
    );

    const checkpoint = await getCheckpoint(
      statefulClient,
      `checkpoint_${targetClient.accountName}`,
    )();

    let skip = true;
    for await (const container of targetClient.listContainers()) {
      skip = container.name !== checkpoint?.containerName && skip;
      if (!skip) {
        const containerClient = targetClient.getContainerClient(container.name);
        // passing optional maxPageSize in the page settings
        let i = 1;
        for await (const response of containerClient
          .listBlobsFlat()
          .byPage({ maxPageSize: 1 })) {
          for (const blob of response.segment.blobItems) {
            console.log(`Blob ${i++}: ${blob.name}`);

            await saveBlobCheckPoint(response.continuationToken)();
          }
        }
      }
    }
  }
}
