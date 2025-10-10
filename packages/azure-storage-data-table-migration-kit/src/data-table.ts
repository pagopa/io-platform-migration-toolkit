import {
  TableClient,
  TableEntity,
  TableEntityResult,
  TableInsertEntityHeaders,
  ListTableEntitiesOptions,
  TableEntityResultPage,
  TransactionAction,
  TableTransactionResponse,
  DeleteTableEntityOptions,
  DeleteTableEntityResponse,
  UpdateMode,
  UpdateTableEntityOptions,
  UpdateEntityResponse,
  UpsertEntityResponse,
  GetAccessPolicyResponse,
  SetAccessPolicyResponse,
  SignedIdentifier,
  TableServiceClientOptions,
} from "@azure/data-tables";
import { PagedAsyncIterableIterator, PageSettings } from "@azure/core-paging";
import type { OperationOptions } from "@azure/core-client";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as AP from "fp-ts/Apply";
import * as E from "fp-ts/Either";
import { match, P } from "ts-pattern";

export class CustomTableClient {
  oldTableClient?: TableClient;
  newTableClient?: TableClient;
  onError?: <T extends object>(error: Error, entity?: T) => void;

  constructor(
    oldTableClient?: TableClient,
    newTableClient?: TableClient,
    onError?: <T extends object>(error: Error, entity?: T) => void
  ) {
    if (!oldTableClient && !newTableClient) {
      throw new Error("At least one TableClient must be provided");
    }

    this.oldTableClient = oldTableClient;
    this.newTableClient = newTableClient;
    this.onError = onError;
  }

  static fromConnectionString(
    oldTableConnectionString: string,
    newTableConnectionString: string,
    oldTableName: string,
    newTableName: string,
    oldTableOptions?: TableServiceClientOptions,
    newTableOptions?: TableServiceClientOptions,
    onError?: <T extends object>(error: Error, entity?: T) => void
  ) {
    if (!oldTableConnectionString && !newTableConnectionString) {
      throw new Error("At least one connection string must be provided");
    }

    return new CustomTableClient(
      oldTableConnectionString
        ? TableClient.fromConnectionString(
            oldTableConnectionString,
            oldTableName,
            oldTableOptions
          )
        : undefined,
      newTableConnectionString
        ? TableClient.fromConnectionString(
            newTableConnectionString,
            newTableName,
            newTableOptions
          )
        : undefined,
      onError
    );
  }

  private methodNotImplemented = "Method not implemented.";

  private getCreateEntityTE = <T extends object>(
    tc: TableClient,
    entity: TableEntity<T>,
    options?: OperationOptions
  ) => TE.tryCatch(() => tc.createEntity(entity, options), E.toError);

  createEntity = async <T extends object>(
    entity: TableEntity<T>,
    options?: OperationOptions
  ): Promise<TableInsertEntityHeaders> => {
    const p = match([this.newTableClient, this.oldTableClient])
      .with([P.not(undefined), undefined], ([newTableClient]) =>
        this.getCreateEntityTE(newTableClient, entity, options)
      )
      .with([undefined, P.not(undefined)], ([, oldTableClient]) =>
        this.getCreateEntityTE(oldTableClient, entity, options)
      )
      .with(
        [P.not(undefined), P.not(undefined)],
        ([newTableClient, oldTableClient]) =>
          pipe(
            AP.sequenceT(TE.ApplicativeSeq)(
              this.getCreateEntityTE(newTableClient, entity, options),
              pipe(
                this.getCreateEntityTE(oldTableClient, entity, options),
                TE.orElseW((error) => {
                  this.onError?.(error, entity);
                  return TE.right(void 0);
                })
              )
            ),
            TE.map(([newRes]) => newRes)
          )
      )
      .otherwise(() =>
        TE.left(new Error("No TableClient available to create entity."))
      );

    return await pipe(
      p,
      TE.getOrElse((error) => {
        throw error;
      })
    )();
  };

  listEntities = function <
    T extends Record<string, unknown> = Record<string, unknown>
  >(
    this: CustomTableClient,
    options?: ListTableEntitiesOptions
  ): PagedAsyncIterableIterator<
    TableEntityResult<T>,
    TableEntityResultPage<T>,
    PageSettings
  > {
    const itemIterator = async function* (this: CustomTableClient) {
      const seen = new Set<string>();

      if (this.newTableClient) {
        for await (const entity of this.newTableClient.listEntities<T>(
          options
        )) {
          const key = `${entity.partitionKey}|${entity.rowKey}`;
          seen.add(key);
          yield entity;
        }
      }

      if (this.oldTableClient) {
        for await (const entity of this.oldTableClient.listEntities<T>(
          options
        )) {
          const key = `${entity.partitionKey}|${entity.rowKey}`;
          if (!seen.has(key)) {
            yield entity;
          }
        }
      }
    }.call(this);

    const iterator: PagedAsyncIterableIterator<
      TableEntityResult<T>,
      TableEntityResultPage<T>,
      PageSettings
    > = {
      next: itemIterator.next.bind(itemIterator),
      [Symbol.asyncIterator]() {
        return this;
      },

      byPage(
        _settings?: PageSettings
      ): AsyncIterableIterator<TableEntityResultPage<T>> {
        throw new Error("listEntities: byPage not implemented.");
      },
    };

    return iterator;
  }.bind(this);

  submitTransaction = (
    _actions: TransactionAction[],
    _options?: OperationOptions
  ): Promise<TableTransactionResponse> =>
    Promise.reject(new Error(this.methodNotImplemented));

  deleteEntity = (
    _partitionKey: string,
    _rowKey: string,
    _options?: DeleteTableEntityOptions
  ): Promise<DeleteTableEntityResponse> =>
    Promise.reject(new Error(this.methodNotImplemented));

  updateEntity = <T extends object>(
    _entity: TableEntity<T>,
    _mode?: UpdateMode,
    _options?: UpdateTableEntityOptions
  ): Promise<UpdateEntityResponse> =>
    Promise.reject(new Error(this.methodNotImplemented));

  upsertEntity = <T extends object>(
    _entity: TableEntity<T>,
    _mode?: UpdateMode,
    _options?: OperationOptions
  ): Promise<UpsertEntityResponse> =>
    Promise.reject(new Error(this.methodNotImplemented));

  getAccessPolicy = (
    _options?: OperationOptions
  ): Promise<GetAccessPolicyResponse> =>
    Promise.reject(new Error(this.methodNotImplemented));

  setAccessPolicy = (
    _tableAcl: SignedIdentifier[],
    _options?: OperationOptions
  ): Promise<SetAccessPolicyResponse> =>
    Promise.reject(new Error(this.methodNotImplemented));
}
