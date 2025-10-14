import { TableServiceClientOptions } from "@azure/data-tables";

export type TableFields = {
  connectionString: string;
  tableName: string;
  tableOptions?: TableServiceClientOptions;
};
