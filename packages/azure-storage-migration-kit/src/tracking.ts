import { constVoid, pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import { FallbackTracker } from "./types";

export const consumeFallbackTrackerWithTaskEither =
  <E, O>(containerName: string, blobName: string, tracker?: FallbackTracker) =>
  (te: TE.TaskEither<E, O>) =>
    pipe(
      tracker,
      O.fromNullable,
      O.map((fallbackTracker) => fallbackTracker(containerName, blobName)),
      O.getOrElse(constVoid),
      () => te
    );
