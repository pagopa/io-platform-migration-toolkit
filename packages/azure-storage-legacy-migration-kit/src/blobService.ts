import { constant, constVoid, pipe } from "fp-ts/lib/function";
import * as AS from "azure-storage";
import * as B from "fp-ts/boolean";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as t from "io-ts";
import {
  BlobNotFoundCode,
  BlobServiceWithFallBack,
  FallbackTracker,
} from "./types";

/**
 *
 * @param primaryConnectionString: The primary storage used for principal read/write IO
 * @param secondaryConnectionString: Optional: The fallback storage used for migration purpose (i.e: read fallback)
 * @returns Both primary and secondary blob services while needed.
 */
export const createBlobService = (
  primaryConnectionString: string,
  secondaryConnectionString?: string
): BlobServiceWithFallBack =>
  pipe(
    secondaryConnectionString,
    O.fromNullable,
    O.map((conn) => ({
      secondary: AS.createBlobService(conn),
    })),
    O.getOrElseW(() => ({})),
    (secondaryConfig) => ({
      primary: AS.createBlobService(primaryConnectionString),
      ...secondaryConfig,
    })
  );

const consumeFallbackTracker = (
  containerName: string,
  blobName: string,
  tracker?: FallbackTracker
) =>
  pipe(
    tracker,
    O.fromNullable,
    O.map((fallbackTracker) => fallbackTracker(containerName, blobName)),
    O.getOrElse(constVoid)
  );

export const doesBlobExistOnDifferentContainerNames = (
  blobServiceWithFallback: BlobServiceWithFallBack,
  containerName: string,
  secondaryContainerName: string,
  blobName: string,
  tracker?: FallbackTracker
) =>
  doesBlobExist(
    blobServiceWithFallback,
    containerName,
    blobName,
    tracker,
    secondaryContainerName
  );

export const doesBlobExist = (
  blobServiceWithFallback: BlobServiceWithFallBack,
  containerName: string,
  blobName: string,
  tracker?: FallbackTracker,
  secondaryContainerName?: string
): TE.TaskEither<Error, AS.BlobService.BlobResult> =>
  pipe(
    TE.taskify<Error, AS.BlobService.BlobResult>((cb) =>
      blobServiceWithFallback.primary.doesBlobExist(containerName, blobName, cb)
    )(),
    TE.chain((primaryRes) =>
      pipe(
        primaryRes.exists === true,
        B.fold(
          () =>
            pipe(
              blobServiceWithFallback.secondary,
              O.fromNullable,
              O.map((fallback) =>
                pipe(
                  TE.taskify<Error, AS.BlobService.BlobResult>((cb) =>
                    fallback.doesBlobExist(
                      secondaryContainerName ?? containerName,
                      blobName,
                      cb
                    )
                  )(),
                  TE.map((res) =>
                    pipe(
                      consumeFallbackTracker(
                        secondaryContainerName ?? containerName,
                        blobName,
                        tracker
                      ),
                      () => res
                    )
                  )
                )
              ),
              O.getOrElse(() => TE.right(primaryRes))
            ),
          () => TE.right(primaryRes)
        )
      )
    )
  );

export const upsertBlobFromText = (
  blobService: BlobServiceWithFallBack,
  containerName: string,
  blobName: string,
  text: string | Buffer,
  options: AS.BlobService.CreateBlobRequestOptions = {}
): TE.TaskEither<Error, O.Option<AS.BlobService.BlobResult>> =>
  pipe(
    TE.taskify<Error, AS.BlobService.BlobResult>((cb) =>
      blobService.primary.createBlockBlobFromText(
        containerName,
        blobName,
        text,
        options,
        cb
      )
    )(),
    TE.map(O.fromNullable)
  );

export const getBlobAsTextOnDifferentContainerNames = (
  blobService: BlobServiceWithFallBack,
  containerName: string,
  secondaryContainerName: string,
  blobName: string,
  options: AS.BlobService.GetBlobRequestOptions = {},
  tracker?: FallbackTracker
) =>
  getBlobAsText(
    blobService,
    containerName,
    blobName,
    options,
    tracker,
    secondaryContainerName
  );

export const getBlobAsText = (
  blobService: BlobServiceWithFallBack,
  containerName: string,
  blobName: string,
  options: AS.BlobService.GetBlobRequestOptions = {},
  tracker?: FallbackTracker,
  secondaryContainerName?: string
): TE.TaskEither<Error, O.Option<string>> =>
  pipe(
    // eslint-disable-next-line sonarjs/cognitive-complexity
    new Promise<E.Either<Error, O.Option<string>>>((resolve) => {
      blobService.primary.getBlobToText(
        containerName,
        blobName,
        options,
        (err, result, __) => {
          if (err) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const errorAsStorageError = err as AS.StorageError;
            if (
              errorAsStorageError.code !== undefined &&
              errorAsStorageError.code === BlobNotFoundCode
            ) {
              return pipe(
                blobService.secondary,
                O.fromNullable,
                O.map((fallback) =>
                  fallback.getBlobToText(
                    secondaryContainerName ?? containerName,
                    blobName,
                    options,
                    (e, r, ___) => {
                      consumeFallbackTracker(
                        secondaryContainerName ?? containerName,
                        blobName,
                        tracker
                      );
                      if (e) {
                        const storageError = e as AS.StorageError;
                        if (
                          storageError.code !== undefined &&
                          storageError.code === BlobNotFoundCode
                        ) {
                          return resolve(
                            E.right<Error, O.Option<string>>(O.none)
                          );
                        } else {
                          return resolve(E.left<Error, O.Option<string>>(e));
                        }
                      } else {
                        return resolve(
                          E.right<Error, O.Option<string>>(O.fromNullable(r))
                        );
                      }
                    }
                  )
                ),
                O.getOrElse(() =>
                  resolve(E.right<Error, O.Option<string>>(O.none))
                )
              );
            }
            return resolve(E.left<Error, O.Option<string>>(err));
          } else {
            return pipe(
              result,
              O.fromNullable,
              O.map((firstRes) => resolve(E.right(O.some(firstRes)))),
              O.getOrElse(() =>
                pipe(
                  blobService.secondary,
                  O.fromNullable,
                  O.map((fallback) =>
                    fallback.getBlobToText(
                      secondaryContainerName ?? containerName,
                      blobName,
                      options,
                      (er, re, ___) => {
                        consumeFallbackTracker(
                          secondaryContainerName ?? containerName,
                          blobName,
                          tracker
                        );
                        if (er) {
                          const storageError = er as AS.StorageError;
                          if (
                            storageError.code !== undefined &&
                            storageError.code === BlobNotFoundCode
                          ) {
                            return resolve(
                              E.right<Error, O.Option<string>>(O.none)
                            );
                          } else {
                            return resolve(E.left<Error, O.Option<string>>(er));
                          }
                        } else {
                          return resolve(
                            E.right<Error, O.Option<string>>(O.fromNullable(re))
                          );
                        }
                      }
                    )
                  ),
                  O.getOrElse(() =>
                    resolve(
                      E.right<Error, O.Option<string>>(O.fromNullable(result))
                    )
                  )
                )
              )
            );
          }
        }
      );
    }),
    (promise) => TE.tryCatch(() => promise, E.toError),
    TE.chain(TE.fromEither)
  );

export const getBlobAsTextsWithErrorOnDifferentContainerName = (
  blobService: BlobServiceWithFallBack,
  containerName: string,
  secondaryContainerName: string,
  blobName: string,
  options: AS.BlobService.GetBlobRequestOptions = {},
  tracker?: FallbackTracker
) =>
  getBlobAsTextWithError(
    blobService,
    containerName,
    options,
    tracker,
    secondaryContainerName
  )(blobName);

export const getBlobAsTextWithError =
  (
    blobService: BlobServiceWithFallBack,
    containerName: string,
    options: AS.BlobService.GetBlobRequestOptions = {},
    tracker?: FallbackTracker,
    secondaryContainerName?: string
  ) =>
  (blobName: string): TE.TaskEither<AS.StorageError, O.Option<string>> =>
    pipe(
      new Promise<E.Either<AS.StorageError, O.Option<string>>>((resolve) =>
        blobService.primary.getBlobToText(
          containerName,
          blobName,
          options,
          (err, result, _) =>
            err
              ? resolve(E.left(err))
              : pipe(
                  result,
                  O.fromNullable,
                  O.map((res) => resolve(E.right(O.fromNullable(res)))),
                  O.getOrElse(() =>
                    pipe(
                      blobService.secondary,
                      O.fromNullable,
                      O.map((fallback) =>
                        fallback.getBlobToText(
                          secondaryContainerName ?? containerName,
                          blobName,
                          options,
                          (e, r, __) =>
                            pipe(
                              consumeFallbackTracker(
                                secondaryContainerName ?? containerName,
                                blobName,
                                tracker
                              ),
                              () =>
                                e
                                  ? resolve(E.left(e))
                                  : resolve(E.right(O.fromNullable(r)))
                            )
                        )
                      ),
                      O.getOrElse(() => resolve(E.right(O.none)))
                    )
                  )
                )
        )
      ),
      constant
    );

export const getBlobAsObjectOnDifferentContainerNames = <A, O, I>(
  type: t.Type<A, O, I>,
  blobService: BlobServiceWithFallBack,
  containerName: string,
  secondaryContainerName: string,
  blobName: string,
  options: AS.BlobService.GetBlobRequestOptions = {},
  tracker?: FallbackTracker
) =>
  getBlobAsObject(
    type,
    blobService,
    containerName,
    blobName,
    options,
    tracker,
    secondaryContainerName
  );

/**
 * Get a blob content as a typed (io-ts) object.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob file name
 */
export const getBlobAsObject = async <A, O, I>(
  type: t.Type<A, O, I>,
  blobService: BlobServiceWithFallBack,
  containerName: string,
  blobName: string,
  options: AS.BlobService.GetBlobRequestOptions = {},
  tracker?: FallbackTracker,
  secondaryContainerName?: string
): Promise<E.Either<Error, O.Option<A>>> => {
  const errorOrMaybeText = await getBlobAsText(
    blobService,
    containerName,
    blobName,
    options,
    tracker,
    secondaryContainerName
  )();
  return pipe(
    errorOrMaybeText,
    E.chain((maybeText) => {
      if (O.isNone(maybeText)) {
        return E.right(O.none);
      }

      const text = maybeText.value;
      try {
        const json = JSON.parse(text);
        return pipe(
          type.decode(json),
          E.fold(
            (err) => E.left(new Error(err.join("|"))),
            (_) => E.right(O.some(_))
          )
        );
      } catch (e) {
        // e will always be an instance of SyntaxError here which is a subclass of Error
        return E.left(e as Error);
      }
    })
  );
};
