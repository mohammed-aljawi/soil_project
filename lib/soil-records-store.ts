import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

export type ReviewStatus = "Imported" | "Needs Review" | "Complete";

export type SoilHorizon = {
  name: string;
  depth: string;
  texture: string;
  topDepthCm?: string;
  bottomDepthCm?: string;
  topDepthIn?: string;
  bottomDepthIn?: string;
  sandPercent?: string;
  siltPercent?: string;
  clayPercent?: string;
  ph?: string;
  acidity?: string;
  color?: string;
  structure?: string;
  consistence?: string;
  roots?: string;
  boundary?: string;
  fragments?: string;
  clayFilms?: string;
  electricalConductivity?: string;
  description: string;
};

export type SoilSiteRecord = {
  id: string;
  station: string;
  county: string;
  siteId: string;
  pedonId: string;
  descriptionDate: string;
  soilSeries: string;
  classification: string;
  latitude: string;
  longitude: string;
  mapUnit: string;
  slope: string;
  drainageClass: string;
  parentMaterial: string;
  sourceDocument: string;
  reviewStatus: ReviewStatus;
  reviewerNotes: string;
  validationWarnings: string[];
  rawText: string;
  horizons: SoilHorizon[];
};

const tableName =
  process.env.DYNAMODB_SOIL_TABLE_NAME ?? process.env.SOIL_RECORDS_TABLE_NAME;
const region =
  process.env.AWS_REGION ?? process.env.NEXT_PUBLIC_AWS_REGION ?? "us-east-1";

// Creates one DynamoDB document client used by all server-side record actions.
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region }),
  {
    marshallOptions: {
      removeUndefinedValues: true
    }
  }
);

// Reads the DynamoDB table name from environment variables and fails clearly if missing.
function getTableName() {
  if (!tableName) {
    throw new Error(
      "Missing DYNAMODB_SOIL_TABLE_NAME environment variable for soil records."
    );
  }

  return tableName;
}

// Makes sure records loaded from DynamoDB always have the arrays the UI expects.
function normalizeRecord(record: SoilSiteRecord): SoilSiteRecord {
  return {
    ...record,
    validationWarnings: record.validationWarnings ?? [],
    horizons: record.horizons ?? []
  };
}

// Loads every soil record from DynamoDB for the dashboard.
export async function readSoilRecords() {
  const response = await dynamoClient.send(
    new ScanCommand({
      TableName: getTableName()
    })
  );

  return ((response.Items ?? []) as SoilSiteRecord[])
    .map(normalizeRecord)
    .sort((a, b) => b.id.localeCompare(a.id));
}

// Saves a batch of new soil records into DynamoDB.
export async function addSoilRecords(recordsToAdd: SoilSiteRecord[]) {
  for (const record of recordsToAdd) {
    await dynamoClient.send(
      new PutCommand({
        TableName: getTableName(),
        Item: {
          ...normalizeRecord(record),
          updatedAt: new Date().toISOString()
        }
      })
    );
  }

  return readSoilRecords();
}

// Replaces one existing soil record in DynamoDB with the edited version.
export async function updateSoilRecord(updatedRecord: SoilSiteRecord) {
  await dynamoClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: {
        ...normalizeRecord(updatedRecord),
        updatedAt: new Date().toISOString()
      }
    })
  );

  return readSoilRecords();
}

// Deletes one soil record from DynamoDB by its string id.
export async function deleteSoilRecord(id: string) {
  await dynamoClient.send(
    new DeleteCommand({
      TableName: getTableName(),
      Key: { id }
    })
  );

  return readSoilRecords();
}
