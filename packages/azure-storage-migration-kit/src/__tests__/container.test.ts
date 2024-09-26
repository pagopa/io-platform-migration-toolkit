/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from "vitest";
import { BaseContainerClientWithFallback } from "../container";

const primaryGetBlobClientMock = vi.fn().mockReturnValue({});
const primaryGetBlockBlobClientMock = vi.fn();
const primaryUploadBlockBlobMock = vi.fn();
const primaryContainerClient = {
  getBlobClient: primaryGetBlobClientMock,
  getBlockBlobClient: primaryGetBlockBlobClientMock,
  uploadBlockBlob: primaryUploadBlockBlobMock,
} as any;

const fallbackGetBlobClientMock = vi.fn().mockReturnValue({});
const fallbackGetBlockBlobClientMock = vi.fn();
const fallbackUploadBlockBlobMock = vi.fn();
const fallbackContainerClient = {
  getBlobClient: fallbackGetBlobClientMock,
  getBlockBlobClient: fallbackGetBlockBlobClientMock,
  uploadBlockBlob: fallbackUploadBlockBlobMock,
} as any;

const getBaseContainerClientWithFallback = () =>
  new BaseContainerClientWithFallback(
    primaryContainerClient,
    fallbackContainerClient
  );

afterEach(() => {
  vi.resetAllMocks();
});
describe("uploadBlockBlob", () => {
  it("should upload a block blob on primary containerClient", async () => {
    primaryUploadBlockBlobMock.mockImplementationOnce((_) => ({}));
    const containerClient = getBaseContainerClientWithFallback();
    const content = Buffer.from("blob");
    await containerClient.uploadBlockBlob("blob", content, content.length);
    expect(primaryContainerClient.uploadBlockBlob).toHaveBeenCalled();
    expect(fallbackContainerClient.uploadBlockBlob).not.toHaveBeenCalled();
  });
});
