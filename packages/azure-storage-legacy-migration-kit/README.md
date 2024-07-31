# @pagopa/handler-kit

A minimal toolkit to make `handlers` in TypeScript & `fp-ts`

## What is an Handler?

An `Handler` is a specialization of fp-ts' `ReaderTaskEither` that takes a value as `input` and ensures uniform error handling and validation.

It is particularly useful for creating HTTP-agnostic "controllers" that can be adapted to any framework.

This package contains useful functions for creating handlers, manipulating them, abstracting HTTP controllers, and uniformly handling errors

## How to use it

```typescript
import * as H from "@pagopa/handler-kit";
import * as L from "@pagopa/logger";

import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { pipe, flow } from "fp-ts/function";
import { lookup } from "fp-ts/Record";

import * as t from "io-ts";

const GetMoviesBody = t.type({
  genre: t.keyof({
    action: null,
    comedy: null,
    drama: null,
    horror: null,
    "sci-fi": null,
  }),
});

type GetMoviesBody = t.TypeOf<typeof GetMoviesBody>;

const movies = {
  action: ["die hard"],
  horror: ["shining", "the exorcist"],
};

const getMoviesByGenre =
  (genre: GetMoviesBody["genre"]) =>
  (r: { movies: Record<string, string[]> }) =>
    pipe(
      r.movies,
      lookup(genre),
      TE.fromOption(
        () => new H.HttpNotFoundError("there are no movies for this genre")
      )
    );

// Reads genre from HTTP body,
// then performs an effecful search
// and returns an HTTP response.
const GetMovies = H.of((req: H.HttpRequest) =>
  pipe(
    req.body,
    // perform a refinement with io-ts, and returns a ValidationError
    // that represents a 422 HTTP response
    H.parse(GetMoviesBody),
    E.map(({ genre }) => genre),
    RTE.fromEither,
    RTE.chainW(getMoviesByGenre),
    RTE.map((movies) => ({ items: movies })),
    // wrap in a 200 HTTP response, with content-type JSON
    RTE.map(H.successJson),
    // converts Error instances to problem json (RFC 7807) objects
    RTE.orElseW(flow(H.toProblemJson, H.problemJson, RTE.of))
  )
);

// Run the handler
// too boilerplate? :P don't panic, see the handler-kit adapters

const httpRequest = {
  method: "POST",
  body: {
    genre: "sci-fi",
  },
  url: "https://my-req.url/",
  query: {},
  headers: {},
  path: {},
};

GetMovies({
  input: httpRequest,
  inputDecoder: H.HttpRequest,
  logger: {
    log: (r) => () => console.log(r),
    format: L.format.simple,
  },
  movies,
})();
```

See the unit tests for other examples
