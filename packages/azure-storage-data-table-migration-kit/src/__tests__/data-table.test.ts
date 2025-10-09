import { TableClient } from "@azure/data-tables";
import { PagedAsyncIterableIterator } from "@azure/core-paging";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomTableClient } from "../data-table";

const randomError = "Random error.";
const notImplementedError = "Method not implemented.";
const fakeConnectionString = "UseDevelopmentStorage=true";

const createEntityOldTableMock = vi.fn();
const listEntitiesOldTableMock = vi.fn();
const oldTableClient = {
  createEntity: createEntityOldTableMock,
  listEntities: listEntitiesOldTableMock,
} as unknown as TableClient;

const createEntityNewTableMock = vi.fn();
const listEntitiesNewTableMock = vi.fn();
const newTableClient = {
  createEntity: createEntityNewTableMock,
  listEntities: listEntitiesNewTableMock,
} as unknown as TableClient;

afterEach(() => {
  vi.resetAllMocks();
});

const toArray = async <T>(
  iter: PagedAsyncIterableIterator<T>
): Promise<T[]> => {
  const results: T[] = [];
  for await (const item of iter) {
    // eslint-disable-next-line functional/immutable-data
    results.push(item);
  }
  return results;
};

describe("Constructor", () => {
  it("should throw an error if no TableClient is provided", () => {
    expect(() => new CustomTableClient()).toThrow(
      "At least one TableClient must be provided"
    );
  });
});

describe("fromConnectionString", () => {
  it("should throw an error if no connection string is provided", () => {
    expect(() =>
      CustomTableClient.fromConnectionString("", "", "tableName")
    ).toThrow("At least one connection string must be provided");
  });

  it("should create a CustomTableClient instance with only old table connection string", () => {
    const client = CustomTableClient.fromConnectionString(
      fakeConnectionString,
      "",
      "tableName"
    );
    expect(client).toBeInstanceOf(CustomTableClient);
    expect(client.oldTableClient).toBeDefined();
    expect(client.newTableClient).toBeUndefined();
  });

  it("should create a CustomTableClient instance with only new table connection string", () => {
    const client = CustomTableClient.fromConnectionString(
      "",
      fakeConnectionString,
      "tableName"
    );
    expect(client).toBeInstanceOf(CustomTableClient);
    expect(client.oldTableClient).toBeUndefined();
    expect(client.newTableClient).toBeDefined();
  });

  it("should create a CustomTableClient instance with both connection strings", () => {
    const client = CustomTableClient.fromConnectionString(
      fakeConnectionString,
      fakeConnectionString,
      "tableName"
    );
    expect(client).toBeInstanceOf(CustomTableClient);
    expect(client.oldTableClient).toBeDefined();
    expect(client.newTableClient).toBeDefined();
  });
});

describe("createEntity", () => {
  it("should create an entity in the old table (only old table client)", async () => {
    const entityObj = {
      partitionKey: "part1",
      rowKey: "row1",
      email: "email1",
    };

    createEntityOldTableMock.mockImplementationOnce(() =>
      Promise.resolve(entityObj)
    );

    const res = await new CustomTableClient(oldTableClient).createEntity(
      entityObj
    );

    if (res) {
      expect(res).toEqual(entityObj);
      expect(createEntityOldTableMock).toHaveBeenCalled();
    }
  });

  it("should create an entity in the new table (only new table client)", async () => {
    const entityObj = {
      partitionKey: "part1",
      rowKey: "row1",
      email: "email1",
    };

    createEntityNewTableMock.mockImplementationOnce(() =>
      Promise.resolve(entityObj)
    );

    const res = await new CustomTableClient(
      undefined,
      newTableClient
    ).createEntity(entityObj);
    if (res) {
      expect(res).toEqual(entityObj);
      expect(createEntityNewTableMock).toHaveBeenCalled();
    }
  });

  it("should create an entity in both table (both table client)", async () => {
    const entityObj = {
      partitionKey: "part1",
      rowKey: "row1",
      email: "email1",
    };

    createEntityNewTableMock.mockImplementationOnce(() =>
      Promise.resolve(entityObj)
    );

    createEntityOldTableMock.mockImplementationOnce(() =>
      Promise.resolve(entityObj)
    );

    const res = await new CustomTableClient(
      oldTableClient,
      newTableClient
    ).createEntity(entityObj);

    if (res) {
      expect(res).toEqual(entityObj);
      expect(createEntityNewTableMock).toHaveBeenCalled();
      expect(createEntityOldTableMock).toHaveBeenCalled();
    }
  });

  it("should create an entity in new table and raise onError callback (both table client)", async () => {
    const entityObj = {
      partitionKey: "part1",
      rowKey: "row1",
      email: "email1",
    };

    createEntityNewTableMock.mockImplementationOnce(() =>
      Promise.resolve(entityObj)
    );

    createEntityOldTableMock.mockImplementationOnce(() =>
      Promise.reject(randomError)
    );

    const onErrorMock = vi.fn();
    onErrorMock.mockImplementationOnce((error: Error, entity?: object) => {
      expect(entity).toEqual(entityObj);
    });

    const res = await new CustomTableClient(
      oldTableClient,
      newTableClient,
      onErrorMock
    ).createEntity(entityObj);

    if (res) {
      expect(res).toEqual(entityObj);
      expect(createEntityNewTableMock).toHaveBeenCalled();
      expect(onErrorMock).toHaveBeenCalled();
    }
  });

  it("should get an error immediatly (both table client)", async () => {
    const entityObj = {
      partitionKey: "part1",
      rowKey: "row1",
      email: "email1",
    };

    createEntityNewTableMock.mockImplementationOnce(() =>
      Promise.reject(randomError)
    );

    createEntityOldTableMock.mockImplementationOnce(() =>
      Promise.resolve(entityObj)
    );

    await expect(
      new CustomTableClient(oldTableClient, newTableClient).createEntity(
        entityObj
      )
    ).rejects.toThrow(randomError);
    expect(createEntityOldTableMock).toHaveBeenCalledTimes(0);
  });
});

describe("listEntities", () => {
  it("should get error on byPage not implemented", async () => {
    const res = new CustomTableClient(
      oldTableClient,
      newTableClient
    ).listEntities();
    if (res) {
      expect(() => res.byPage()).toThrow(
        "listEntities: byPage not implemented."
      );
    }
  });

  it("should list entities in the old table (only old table client)", async () => {
    const entityObj1 = {
      partitionKey: "part1",
      rowKey: "row1",
      email: "email1",
    };

    listEntitiesOldTableMock.mockImplementationOnce(() => {
      async function* asyncGenerator() {
        yield entityObj1;
      }
      return asyncGenerator();
    });
    const res = new CustomTableClient(oldTableClient).listEntities();
    if (res) {
      const results = await toArray(res);

      expect(results).toHaveLength(1);
      expect(results.map((r) => r.email)).toContain("email1");
    }
  });

  it("should list entities in the new table (only new table client)", async () => {
    const entityObj1 = {
      partitionKey: "part1",
      rowKey: "row1",
      email: "email1",
    };
    const entityObj2 = {
      partitionKey: "part1",
      rowKey: "row2",
      email: "email2",
    };
    listEntitiesNewTableMock.mockImplementationOnce(() => {
      async function* asyncGenerator() {
        yield entityObj1;
        yield entityObj2;
      }
      return asyncGenerator();
    });
    const res = new CustomTableClient(newTableClient).listEntities();
    if (res) {
      const results = await toArray(res);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.email)).toContain("email1");
      expect(results.map((r) => r.email)).toContain("email2");
    }
  });

  it("should list entities in both table (merge, with new table priority) (both table client)", async () => {
    const entityObjOld1 = {
      partitionKey: "part1",
      rowKey: "row1",
      email: "email1",
    };
    const entityObjOld2 = {
      partitionKey: "part1",
      rowKey: "row2",
      email: "email2",
    };
    listEntitiesOldTableMock.mockImplementationOnce(() => {
      async function* asyncGenerator() {
        yield entityObjOld1;
        yield entityObjOld2;
      }
      return asyncGenerator();
    });

    const entityObjNew1 = {
      partitionKey: "part1",
      rowKey: "row1",
      email: "email3",
    };
    const entityObjNew2 = {
      partitionKey: "part2",
      rowKey: "row1",
      email: "email4",
    };
    listEntitiesNewTableMock.mockImplementationOnce(() => {
      async function* asyncGenerator() {
        yield entityObjNew1;
        yield entityObjNew2;
      }
      return asyncGenerator();
    });

    const res = new CustomTableClient(
      oldTableClient,
      newTableClient
    ).listEntities();
    if (res) {
      const results = await toArray(res);

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.email)).toContain("email3");
      expect(results.map((r) => r.email)).toContain("email4");
      expect(results.map((r) => r.email)).toContain("email2");
    }
  });
});

describe("submitTransaction", () => {
  it("submitTransaction not implemented, should generate error", async () => {
    await expect(
      new CustomTableClient(oldTableClient, newTableClient).submitTransaction(
        []
      )
    ).rejects.toThrow(notImplementedError);
  });
});

describe("deleteEntity", () => {
  it("deleteEntity not implemented, should generate error", async () => {
    await expect(
      new CustomTableClient(oldTableClient, newTableClient).deleteEntity(
        "pk",
        "rk"
      )
    ).rejects.toThrow(notImplementedError);
  });
});

describe("updateEntity", () => {
  it("updateEntity not implemented, should generate error", async () => {
    await expect(
      new CustomTableClient(oldTableClient, newTableClient).updateEntity({
        partitionKey: "pk",
        rowKey: "rk",
      })
    ).rejects.toThrow(notImplementedError);
  });
});

describe("upsertEntity", () => {
  it("upsertEntity not implemented, should generate error", async () => {
    await expect(
      new CustomTableClient(oldTableClient, newTableClient).upsertEntity({
        partitionKey: "pk",
        rowKey: "rk",
      })
    ).rejects.toThrow(notImplementedError);
  });
});

describe("getAccessPolicy", () => {
  it("getAccessPolicy not implemented, should generate error", async () => {
    await expect(
      new CustomTableClient(oldTableClient, newTableClient).getAccessPolicy()
    ).rejects.toThrow(notImplementedError);
  });
});

describe("setAccessPolicy", () => {
  it("setAccessPolicy not implemented, should generate error", async () => {
    await expect(
      new CustomTableClient(oldTableClient, newTableClient).setAccessPolicy([])
    ).rejects.toThrow(notImplementedError);
  });
});
