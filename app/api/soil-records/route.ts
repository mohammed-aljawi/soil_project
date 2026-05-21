import {
  addSoilRecords,
  deleteSoilRecord,
  readSoilRecords,
  updateSoilRecord
} from "../../../lib/soil-records-store";
import { NextRequest, NextResponse } from "next/server";

// Returns a safe error message that helps during local development.
function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown server error.";
}

// Handles loading all soil records for the dashboard.
export async function GET() {
  try {
    const records = await readSoilRecords();

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to read soil records.",
        detail: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}

// Handles adding one batch of imported or manually entered records.
export async function POST(request: NextRequest) {
  try {
    const recordsToAdd = await request.json();

    if (!Array.isArray(recordsToAdd)) {
      return NextResponse.json(
        { error: "POST body must be an array of soil records." },
        { status: 400 }
      );
    }

    const records = await addSoilRecords(recordsToAdd);

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to add soil records.",
        detail: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}

// Handles saving edits to one existing soil record.
export async function PUT(request: NextRequest) {
  try {
    const updatedRecord = await request.json();

    if (!updatedRecord?.id || typeof updatedRecord.id !== "string") {
      return NextResponse.json(
        { error: "PUT body must include a string record id." },
        { status: 400 }
      );
    }

    const records = await updateSoilRecord(updatedRecord);

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to update soil record.",
        detail: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}

// Handles deleting one soil record by id.
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "DELETE request must include a record id." },
        { status: 400 }
      );
    }

    const records = await deleteSoilRecord(id);

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to delete soil record.",
        detail: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
