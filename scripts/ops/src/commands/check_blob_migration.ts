/* eslint-disable no-console */
import { BlobServiceClient } from "@azure/storage-blob";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import * as B from "fp-ts/boolean";

import { Args, Command, Flags } from "@oclif/core";
import { createContainerClientIfNotExistsOrGet } from "../utils/storage";
import { getCheckpoint, getSaveBlobCheckpoint } from "../utils/checkpoint";

export default class CheckBlobMigration extends Command {
  public static description = "Check Storage Blob migration status";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-platform-migration-ops check_blob_migration test 'DefaultEndpointsProtocol=https;AccountName=foo;AccountKey=bar==;EndpointSuffix=core.windows.net' 'DefaultEndpointsProtocol=https;AccountName=bar;AccountKey=xyz==;EndpointSuffix=core.windows.net'`,
  ];

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
      char: "d",
      description: "Connection string related to target storage account",
      required: true,
    }),
  };

  public static flags = {
    tagName: Flags.string({
      char: "t",
      description: "Specify the tag name to check",
      required: true,
    }),
    tagValue: Flags.string({
      char: "v",
      description: "Tag value to compare",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(CheckBlobMigration);

    const targetClient = BlobServiceClient.fromConnectionString(
      args.targetStorage,
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
      `checkpoint_${args.id}_${targetClient.accountName}`,
    );

    const checkpoint = await getCheckpoint(
      statefulClient,
      `checkpoint_${args.id}_${targetClient.accountName}`,
    )();

    this.log(`checkpoint is ${JSON.stringify(checkpoint)}`);

    this.log(`Reading blobs with tag ${flags.tagName} equal to ${flags.tagValue}`);
    let skip = true;
    let flagTerm = false;
    const alreadyVisitedContainers = checkpoint?.alreadyVisitedContainers ?? [];
    for await (const container of targetClient.listContainers()) {
      if (!flagTerm) {
        skip =
          alreadyVisitedContainers.includes(container.name) &&
          container.name !== checkpoint?.lastContainerName &&
          skip;
        if (!skip) {
          await saveBlobCheckPoint(alreadyVisitedContainers, container.name)();
          const containerClient = targetClient.getContainerClient(
            container.name,
          );

          let i = 1;
          for await (const response of containerClient.listBlobsFlat().byPage({
            continuationToken: checkpoint?.continuationToken,
            maxPageSize: 1,
          })) {
            for (const blob of response.segment.blobItems) {
              flagTerm = pipe(
                blob.tags,
                O.fromNullable,
                O.map((tags) => tags[flags.tagName] !== flags.tagValue),
                O.getOrElse(() => true),
              );

              if (flagTerm) {
                this.log(`Migration not completed yet!`);
                break;
              }
            }
            if (flagTerm) {
              break;
            }
            await saveBlobCheckPoint(
              alreadyVisitedContainers,
              container.name,
              response.continuationToken,
            )();
          }
          if (flagTerm) {
            break;
          }
          if (!alreadyVisitedContainers.includes(container.name)) {
            alreadyVisitedContainers.push(container.name);
          }
          await saveBlobCheckPoint(alreadyVisitedContainers, container.name)();
        }
      }
    }
    if (!flagTerm) {
      await saveBlobCheckPoint(alreadyVisitedContainers, "undefined")();
    }
  }
}
