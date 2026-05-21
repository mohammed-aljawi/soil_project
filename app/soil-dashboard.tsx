"use client";

import AddIcon from "@mui/icons-material/Add";
import ArticleIcon from "@mui/icons-material/Article";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import mammoth from "mammoth";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type {
  ReviewStatus,
  SoilHorizon,
  SoilSiteRecord
} from "../lib/soil-records-store";

type WorkspaceView = "records" | "import" | "reports";
type ApiErrorResponse = {
  error?: string;
  detail?: string;
};

// Base shape used when creating a new soil record or filling missing fields.
const emptyRecord: SoilSiteRecord = {
  id: "",
  station: "",
  county: "",
  siteId: "",
  pedonId: "",
  descriptionDate: "",
  soilSeries: "",
  classification: "",
  latitude: "",
  longitude: "",
  mapUnit: "",
  slope: "",
  drainageClass: "",
  parentMaterial: "",
  sourceDocument: "",
  reviewStatus: "Needs Review",
  reviewerNotes: "",
  validationWarnings: [],
  rawText: "",
  horizons: []
};

const statusColors: Record<ReviewStatus, "info" | "warning" | "success"> = {
  Imported: "info",
  "Needs Review": "warning",
  Complete: "success"
};

// Builds a readable message from a failed backend response.
async function getApiErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    return [payload.error, payload.detail].filter(Boolean).join(" ");
  } catch {
    return "The backend request failed.";
  }
}

// Local color tokens for the Mesonet-style red interface.
const theme = {
  ink: "#241316",
  muted: "#6b4a4f",
  red950: "#2b080d",
  red900: "#4a1118",
  red800: "#751924",
  red700: "#a21d2d",
  red600: "#c52839",
  red100: "#ffe4e8",
  red50: "#fff4f5",
  line: "#ead4d7",
  paper: "#ffffff",
  shell: "#fbf7f7"
};

// Normalizes raw Word text so the parser can read it more consistently.
function cleanDocumentText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Returns the first captured regex group, with extra spacing cleaned up.
function firstMatch(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

// Returns a numeric-looking captured regex group without additional formatting.
function numberMatch(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.trim() ?? "";
}

// Extracts soil horizon layers from NRCS pedon description text.
function parseHorizons(text: string): SoilHorizon[] {
  const normalizedText = `\n${text.replace(/\r/g, "\n")}`;
  const headingPattern =
    /\n([0-9]*[A-Z][A-Za-z0-9]*)--(?=\s*[0-9.]+\s+to\s+[0-9.]+\s+centimeters)/g;
  const headings = [...normalizedText.matchAll(headingPattern)];

  return headings.slice(0, 24).map((match, index) => {
    const name = match[1].trim();
    const blockStart = (match.index ?? 0) + match[0].length;
    const blockEnd =
      index + 1 < headings.length
        ? headings[index + 1].index ?? normalizedText.length
        : normalizedText.search(/\n\s*(?:Remarks|Lab|Additional|Pedon|Site)\b/i) >
            blockStart
          ? normalizedText.search(/\n\s*(?:Remarks|Lab|Additional|Pedon|Site)\b/i)
          : normalizedText.length;
    const description = normalizedText
      .slice(blockStart, blockEnd)
      .replace(/\s+/g, " ")
      .trim();
    const depthMatch = description.match(
      /^([0-9.]+)\s+to\s+([0-9.]+)\s+centimeters\s+\(([0-9.]+)\s+to\s+([0-9.]+)\s+inches\)/i
    );
    const segments = description
      .split(";")
      .map((segment) => segment.trim())
      .filter(Boolean);
    const colorAndTexture =
      segments[0] && /^\d/.test(segments[0]) ? segments[1] ?? "" : segments[0] ?? "";
    const texture =
      colorAndTexture.match(
        /\b((?:silty clay loam)|(?:sandy clay loam)|(?:silty clay)|(?:sandy clay)|(?:clay loam)|(?:sandy loam)|(?:silt loam)|(?:loamy sand)|(?:sandy clay)|(?:silt)|(?:loam)|(?:clay)|(?:sand))\b/i
      )?.[1] ?? "";
    const color = texture
      ? colorAndTexture.replace(texture, "").replace(/,$/, "").trim()
      : colorAndTexture;
    const structure =
      segments.find((segment) => /\bstructure\b/i.test(segment)) ?? "";
    const consistence =
      segments.find((segment) => /\b(?:loose|friable|firm|sticky|plastic)\b/i.test(segment)) ??
      "";
    const roots =
      segments.find((segment) => /\broots?\b/i.test(segment)) ?? "";
    const boundary =
      segments.find((segment) => /\bboundary\b/i.test(segment)) ?? "";
    const fragments =
      segments.find((segment) => /\bfragments?\b/i.test(segment)) ?? "";
    const clayFilms =
      segments.find((segment) => /\bclay films?\b/i.test(segment)) ?? "";
    const electricalConductivity =
      firstMatch(description, /electrical conductivity of\s+([0-9.]+\s+mmhos\/cm)/i);
    const acidity =
      firstMatch(
        description,
        /\b(extremely acid|very strongly acid|strongly acid|moderately acid|slightly acid|neutral|slightly alkaline|moderately alkaline|strongly alkaline)\b/i
      );

    return {
      name,
      depth: depthMatch
        ? `${depthMatch[1]} to ${depthMatch[2]} cm (${depthMatch[3]} to ${depthMatch[4]} in)`
        : firstMatch(description, /^([^;]+)/i),
      texture,
      topDepthCm: depthMatch?.[1] ?? "",
      bottomDepthCm: depthMatch?.[2] ?? "",
      topDepthIn: depthMatch?.[3] ?? "",
      bottomDepthIn: depthMatch?.[4] ?? "",
      sandPercent: numberMatch(description, /([0-9.]+)\s+percent\s+sand/i),
      siltPercent: numberMatch(description, /([0-9.]+)\s+percent\s+silt/i),
      clayPercent: numberMatch(description, /([0-9.]+)\s+percent\s+clay/i),
      ph: numberMatch(description, /pH\s+([0-9.]+)/i),
      acidity,
      color,
      structure,
      consistence,
      roots,
      boundary,
      fragments,
      clayFilms,
      electricalConductivity,
      description
    };
  });
}

// Creates review flags for missing or incomplete record fields.
function buildValidationWarnings(record: Omit<SoilSiteRecord, "validationWarnings">) {
  const warnings: string[] = [];

  if (!record.station) warnings.push("Station name is missing.");
  if (!record.county) warnings.push("County was not found.");
  if (!record.siteId) warnings.push("Site ID was not found.");
  if (!record.pedonId) warnings.push("Pedon ID was not found.");
  if (!record.descriptionDate) warnings.push("Description date was not found.");
  if (!record.soilSeries) warnings.push("Soil series was not found.");
  if (!record.classification) warnings.push("Soil classification was not found.");
  if (!record.latitude || !record.longitude) {
    warnings.push("Latitude or longitude was not found.");
  }
  if (!record.mapUnit) warnings.push("Map unit was not found.");
  if (!record.parentMaterial) warnings.push("Parent material was not found.");
  if (record.horizons.length === 0) warnings.push("No soil horizons were extracted.");
  if (record.horizons.length > 0 && record.horizons.length < 3) {
    warnings.push("Only a small number of horizons were extracted.");
  }
  if (record.horizons.some((horizon) => !horizon.depth || !horizon.texture)) {
    warnings.push("One or more horizons are missing depth or texture.");
  }
  if (
    record.horizons.some(
      (horizon) =>
        !horizon.sandPercent || !horizon.siltPercent || !horizon.clayPercent
    )
  ) {
    warnings.push("One or more horizons are missing sand/silt/clay percentages.");
  }

  return warnings;
}

// Ensures records have all expected fields before saving or rendering.
function normalizeRecord(record: SoilSiteRecord): SoilSiteRecord {
  const safeRecord = {
    ...emptyRecord,
    ...record,
    validationWarnings: record.validationWarnings ?? [],
    horizons: record.horizons ?? []
  };
  const recordForValidation = {
    ...safeRecord,
    validationWarnings: []
  };

  return {
    ...safeRecord,
    validationWarnings: buildValidationWarnings(recordForValidation)
  };
}

// Safely fills older database records that may not have newer fields.
function hydrateRecord(record: SoilSiteRecord): SoilSiteRecord {
  return {
    ...emptyRecord,
    ...record,
    validationWarnings: record.validationWarnings ?? [],
    horizons: record.horizons ?? []
  };
}

// Converts pasted or imported pedon text into one editable soil record.
function parsePedonText(text: string, fileName: string): SoilSiteRecord {
  const cleanedText = cleanDocumentText(text);
  const siteNote = firstMatch(
    cleanedText,
    /Site Note:\s*([\s\S]*?)\n\s*Pedon ID:/i
  );
  const county = firstMatch(cleanedText, /County:\s*([A-Za-z ]+)/i);
  const station =
    siteNote.match(/site for the\s+(.+?)\s+weather station/i)?.[1]?.trim() ||
    `${county || "Unknown"} County Mesonet`;

  const recordWithoutWarnings: Omit<SoilSiteRecord, "validationWarnings"> = {
    ...emptyRecord,
    id: createRecordId(),
    station,
    county,
    siteId: firstMatch(cleanedText, /Site ID:\s*([A-Za-z0-9]+)/i),
    pedonId: firstMatch(cleanedText, /Pedon ID:\s*([A-Za-z0-9]+)/i),
    descriptionDate: firstMatch(cleanedText, /Description Date:\s*([^\n]+)/i),
    soilSeries: firstMatch(
      cleanedText,
      /Soil Name as Described\/Sampled:\s*([^\n]+)/i
    ),
    classification: firstMatch(
      cleanedText,
      /Classification:\s*([\s\S]*?)\n\s*Pedon Type:/i
    ),
    latitude: firstMatch(cleanedText, /Latitude:[\s\S]*?\(([-0-9.]+)\)/i),
    longitude: firstMatch(cleanedText, /Longitude:[\s\S]*?\(([-0-9.]+)\)/i),
    mapUnit: firstMatch(cleanedText, /Map Unit:\s*([^\n]+)/i),
    slope: firstMatch(cleanedText, /\|\s*([0-9.]+)\s*\|\s*[0-9]+\s*\|/) || "",
    drainageClass:
      firstMatch(
        cleanedText,
        /\|\s*[0-9.]+\s*\|\s*[0-9]+\s*\|[\s\S]*?\|\s*([A-Za-z ]+)\s*\|/
      ) || "",
    parentMaterial: firstMatch(
      cleanedText,
      /Parent Material:\s*([\s\S]*?)\n\s*Bedrock Kind:/i
    ),
    sourceDocument: fileName,
    reviewStatus: "Needs Review",
    reviewerNotes:
      "Imported from a pedon document. Review extracted fields against the source file.",
    rawText: cleanedText,
    horizons: parseHorizons(`\n${cleanedText}`)
  };

  return {
    ...recordWithoutWarnings,
    validationWarnings: buildValidationWarnings(recordWithoutWarnings)
  };
}

// Creates a string id that works with Amplify Data and DynamoDB.
function createRecordId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Escapes CSV values so commas and quotes do not break exports.
function csvEscape(value: string) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

// Builds the site-level CSV export.
function recordsToCsv(records: SoilSiteRecord[]) {
  const headers = [
    "station",
    "county",
    "site_id",
    "pedon_id",
    "description_date",
    "soil_series",
    "classification",
    "latitude",
    "longitude",
    "map_unit",
    "slope",
    "drainage_class",
    "parent_material",
    "source_document",
    "review_status",
    "reviewer_notes",
    "review_flags",
    "horizon_count"
  ];
  const rows = records.map((record) =>
    [
      record.station,
      record.county,
      record.siteId,
      record.pedonId,
      record.descriptionDate,
      record.soilSeries,
      record.classification,
      record.latitude,
      record.longitude,
      record.mapUnit,
      record.slope,
      record.drainageClass,
      record.parentMaterial,
      record.sourceDocument,
      record.reviewStatus,
      record.reviewerNotes,
      record.validationWarnings.join("; "),
      String(record.horizons.length)
    ]
      .map(csvEscape)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

// Builds the horizon-level CSV export.
function horizonsToCsv(records: SoilSiteRecord[]) {
  const headers = [
    "station",
    "county",
    "pedon_id",
    "horizon",
    "top_depth_cm",
    "bottom_depth_cm",
    "top_depth_in",
    "bottom_depth_in",
    "texture",
    "color",
    "sand_percent",
    "silt_percent",
    "clay_percent",
    "ph",
    "acidity",
    "structure",
    "consistence",
    "roots",
    "boundary",
    "fragments",
    "clay_films",
    "electrical_conductivity",
    "description"
  ];
  const rows = records.flatMap((record) =>
    record.horizons.map((horizon) =>
      [
        record.station,
        record.county,
        record.pedonId,
        horizon.name,
        horizon.topDepthCm ?? "",
        horizon.bottomDepthCm ?? "",
        horizon.topDepthIn ?? "",
        horizon.bottomDepthIn ?? "",
        horizon.texture,
        horizon.color ?? "",
        horizon.sandPercent ?? "",
        horizon.siltPercent ?? "",
        horizon.clayPercent ?? "",
        horizon.ph ?? "",
        horizon.acidity ?? "",
        horizon.structure ?? "",
        horizon.consistence ?? "",
        horizon.roots ?? "",
        horizon.boundary ?? "",
        horizon.fragments ?? "",
        horizon.clayFilms ?? "",
        horizon.electricalConductivity ?? "",
        horizon.description
      ]
        .map(csvEscape)
        .join(",")
    )
  );

  return [headers.join(","), ...rows].join("\n");
}

// Triggers a browser download for generated CSV content.
function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// Main client-side application component.
export function SoilDashboard() {
  const [records, setRecords] = useState<SoilSiteRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [activeView, setActiveView] = useState<WorkspaceView>("records");
  const [searchText, setSearchText] = useState("");
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [databaseError, setDatabaseError] = useState("");
  const [notice, setNotice] = useState("");
  const [manualText, setManualText] = useState("");
  const [manualFileName, setManualFileName] = useState("");
  const [manualRecord, setManualRecord] = useState<SoilSiteRecord>({
    ...emptyRecord,
    id: createRecordId(),
    reviewStatus: "Needs Review",
    reviewerNotes: "Created manually. Review before marking complete."
  });
  const [isManualOpen, setIsManualOpen] = useState(false);

  useEffect(() => {
    // Fetches the saved records when the page first loads.
    async function loadRecords() {
      try {
        const response = await fetch("/api/soil-records");
        if (!response.ok) throw new Error(await getApiErrorMessage(response));
        const loadedRecords = ((await response.json()) as SoilSiteRecord[]).map(
          hydrateRecord
        );

        setRecords(loadedRecords);
        setSelectedId(loadedRecords[0]?.id ?? "");
      } catch (error) {
        setDatabaseError(
          error instanceof Error
            ? error.message
            : "Could not load records from DynamoDB."
        );
      } finally {
        setIsLoadingRecords(false);
      }
    }

    loadRecords();
  }, []);

  const selectedRecord =
    records.find((record) => record.id === selectedId) ?? records[0];

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const filtered = records.filter((record) => {
      const searchTarget = [
        record.station,
        record.county,
        record.siteId,
        record.pedonId,
        record.soilSeries,
        record.sourceDocument,
        record.reviewerNotes
      ]
        .join(" ")
        .toLowerCase();

      return !normalizedSearch || searchTarget.includes(normalizedSearch);
    });

    return [...filtered].sort((a, b) => b.id.localeCompare(a.id));
  }, [records, searchText]);

  const completeCount = records.filter(
    (record) => record.reviewStatus === "Complete"
  ).length;
  const warningCount = records.reduce(
    (total, record) => total + record.validationWarnings.length,
    0
  );
  const horizonCount = records.reduce(
    (total, record) => total + record.horizons.length,
    0
  );

  // Reads the API response and replaces the dashboard records with the saved data.
  async function replaceRecordsFromApi(response: Response) {
    if (!response.ok) throw new Error(await getApiErrorMessage(response));
    const savedRecords = ((await response.json()) as SoilSiteRecord[]).map(
      hydrateRecord
    );

    setRecords(savedRecords);
    return savedRecords;
  }

  // Sends one edited record to the backend and refreshes the local dashboard state.
  async function saveUpdatedRecord(updatedRecord: SoilSiteRecord) {
    try {
      const response = await fetch("/api/soil-records", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeRecord(updatedRecord))
      });
      const savedRecords = await replaceRecordsFromApi(response);

      setSelectedId(updatedRecord.id);
      setNotice("Record saved.");
      return savedRecords;
    } catch (error) {
      setDatabaseError(
        error instanceof Error
          ? error.message
          : "Could not save the latest record change."
      );
      return records;
    }
  }

  // Updates one field on the selected record while the user edits the form.
  function updateSelectedRecord(field: keyof SoilSiteRecord, value: string) {
    if (!selectedRecord) return;

    const updatedRecord = normalizeRecord({ ...selectedRecord, [field]: value });

    setRecords((currentRecords) =>
      currentRecords.map((record) =>
        record.id === selectedRecord.id ? updatedRecord : record
      )
    );
    saveUpdatedRecord(updatedRecord);
  }

  // Adds imported or manually created records after checking for duplicates.
  async function addRecords(newRecords: SoilSiteRecord[]) {
    const existingKeys = new Set(
      records.map((record) =>
        `${record.siteId || "none"}|${record.pedonId || "none"}|${record.sourceDocument}`
      )
    );
    const uniqueRecords = newRecords.filter(
      (record) =>
        !existingKeys.has(
          `${record.siteId || "none"}|${record.pedonId || "none"}|${record.sourceDocument}`
        )
    );

    if (uniqueRecords.length === 0) {
      setNotice("No new records were added because they already exist.");
      return;
    }

    try {
      const response = await fetch("/api/soil-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uniqueRecords.map(normalizeRecord))
      });
      const savedRecords = await replaceRecordsFromApi(response);

      setSelectedId(uniqueRecords[0]?.id ?? savedRecords[0]?.id ?? "");
      setActiveView("records");
      setNotice(`Added ${uniqueRecords.length} record${uniqueRecords.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setDatabaseError(
        error instanceof Error ? error.message : "Could not save records to DynamoDB."
      );
    }
  }

  // Reads one or more Word files and converts each document into a soil record.
  async function handleFileImport(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    setDatabaseError("");
    setNotice("");
    setIsImporting(true);

    try {
      const importedRecords = await Promise.all(
        files.map(async (file, index) => {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });

          return {
            ...parsePedonText(result.value, file.name),
            id: `${createRecordId()}-${index}`
          };
        })
      );

      await addRecords(importedRecords);
    } catch {
      setDatabaseError(
        "Unable to read one or more files. Upload .docx files or paste the text manually."
      );
    } finally {
      setIsImporting(false);
    }
  }

  // Converts pasted pedon text into a new soil record.
  async function handlePastedImport() {
    if (!manualText.trim()) {
      setDatabaseError("Paste the pedon description text first.");
      return;
    }

    await addRecords([
      parsePedonText(manualText, manualFileName || "Pasted pedon description")
    ]);
    setManualText("");
    setManualFileName("");
  }

  // Saves a blank/manual record created from the manual entry dialog.
  async function handleManualRecordSave() {
    const recordToSave = normalizeRecord({
      ...manualRecord,
      id: createRecordId(),
      sourceDocument: manualRecord.sourceDocument || "Manual entry"
    });

    await addRecords([recordToSave]);
    setManualRecord({
      ...emptyRecord,
      id: createRecordId(),
      reviewStatus: "Needs Review",
      reviewerNotes: "Created manually. Review before marking complete."
    });
    setIsManualOpen(false);
  }

  // Deletes one record from DynamoDB and updates the selected record in the UI.
  async function handleDeleteRecord(id: string) {
    try {
      const response = await fetch(`/api/soil-records?id=${id}`, {
        method: "DELETE"
      });
      const savedRecords = await replaceRecordsFromApi(response);

      setSelectedId(savedRecords[0]?.id ?? "");
      setNotice("Record deleted.");
    } catch (error) {
      setDatabaseError(
        error instanceof Error
          ? error.message
          : "Could not delete that record from DynamoDB."
      );
    }
  }

  // Marks the selected record as reviewed and complete.
  async function markSelectedComplete() {
    if (!selectedRecord) return;

    await saveUpdatedRecord({
      ...selectedRecord,
      reviewStatus: "Complete",
      reviewerNotes:
        selectedRecord.reviewerNotes || "Reviewed and marked complete."
    });
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${theme.red950} 0, ${theme.red950} 176px, ${theme.shell} 176px, #ffffff 100%)`,
        py: { xs: 2, md: 3 }
      }}
    >
      <Container maxWidth="xl">
        <Stack spacing={2.5}>
          <Header
            records={records}
            completeCount={completeCount}
            onImport={() => setActiveView("import")}
            onManual={() => setIsManualOpen(true)}
            onExport={() =>
              downloadCsv("kentucky-mesonet-soil-records.csv", recordsToCsv(records))
            }
          />

          {databaseError ? (
            <Alert severity="error" onClose={() => setDatabaseError("")}>
              {databaseError}
            </Alert>
          ) : null}
          {notice ? (
            <Alert severity="success" onClose={() => setNotice("")}>
              {notice}
            </Alert>
          ) : null}

          <Stack spacing={2}>
            <Paper elevation={0} sx={{ border: `1px solid ${theme.line}`, overflow: "hidden" }}>
              <Tabs
                value={activeView}
                onChange={(_, value: WorkspaceView) => setActiveView(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  px: 1,
                  background: "#ffffff",
                  "& .MuiTab-root": { fontWeight: 900, textTransform: "none" },
                  "& .MuiTabs-indicator": { backgroundColor: theme.red700, height: 3 }
                }}
              >
                <Tab value="records" label="Entry" />
                <Tab value="import" label="Import" />
                <Tab value="reports" label="Export" />
              </Tabs>
            </Paper>

              {activeView === "records" ? (
                <RecordsView
                  records={records}
                  filteredRecords={filteredRecords}
                  selectedRecord={selectedRecord}
                  isLoadingRecords={isLoadingRecords}
                  searchText={searchText}
                  setSearchText={setSearchText}
                  setSelectedId={setSelectedId}
                  updateSelectedRecord={updateSelectedRecord}
                  saveSelectedRecord={saveUpdatedRecord}
                  handleDeleteRecord={handleDeleteRecord}
                  markSelectedComplete={markSelectedComplete}
                />
              ) : null}

              {activeView === "import" ? (
                <ImportView
                  isImporting={isImporting}
                  manualText={manualText}
                  manualFileName={manualFileName}
                  setManualText={setManualText}
                  setManualFileName={setManualFileName}
                  handleFileImport={handleFileImport}
                  handlePastedImport={handlePastedImport}
                  openManual={() => setIsManualOpen(true)}
                />
              ) : null}

              {activeView === "reports" ? (
                <ReportsView
                  records={records}
                  warningCount={warningCount}
                  horizonCount={horizonCount}
                  onExportRecords={() =>
                    downloadCsv(
                      "kentucky-mesonet-soil-records.csv",
                      recordsToCsv(records)
                    )
                  }
                  onExportHorizons={() =>
                    downloadCsv(
                      "kentucky-mesonet-soil-horizons.csv",
                      horizonsToCsv(records)
                    )
                  }
                />
              ) : null}
          </Stack>
        </Stack>
      </Container>

      <ManualRecordDialog
        open={isManualOpen}
        record={manualRecord}
        onClose={() => setIsManualOpen(false)}
        onChange={(field, value) =>
          setManualRecord((currentRecord) => ({
            ...currentRecord,
            [field]: value
          }))
        }
        onSave={handleManualRecordSave}
      />
    </Box>
  );
}

// Renders the top application header and summary metric cards.
function Header({
  records,
  completeCount,
  onImport,
  onManual,
  onExport
}: {
  records: SoilSiteRecord[];
  completeCount: number;
  onImport: () => void;
  onManual: () => void;
  onExport: () => void;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        overflow: "hidden",
        color: "#ffffff",
        background: `linear-gradient(135deg, ${theme.red900} 0%, ${theme.red950} 58%, ${theme.red800} 100%)`,
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 22px 48px rgba(43, 8, 13, 0.25)"
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
          gap: 2,
          p: { xs: 2, md: 2.5 },
          alignItems: "center"
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
          <Box
            component="img"
            src="/kymesonet-logo.png"
            alt="Kentucky Mesonet logo"
            sx={{
              width: 168,
              maxWidth: "100%",
              height: "auto",
              background: "#ffffff",
              borderRadius: 1,
              p: 1
            }}
          />
          <Box>
            <Typography variant="overline" sx={{ color: "#fecdd3", fontWeight: 900 }}>
              Kentucky Mesonet internal inventory
            </Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 900 }}>
              Soil Description Data Manager
            </Typography>
            <Typography sx={{ maxWidth: 780, color: "#f9d7dc" }}>
              Import NRCS pedon documents, review extracted metadata, edit soil
              horizons, and export clean records for the Mesonet soil archive.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: { xs: "flex-start", md: "flex-end" } }}>
          <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={onImport} sx={{ background: "#ffffff", color: theme.red900, "&:hover": { background: theme.red100 } }}>
            Import
          </Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={onManual} sx={{ borderColor: "rgba(255,255,255,0.58)", color: "#ffffff" }}>
            Manual
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExport} sx={{ borderColor: "rgba(255,255,255,0.58)", color: "#ffffff" }}>
            Export
          </Button>
        </Stack>
      </Box>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />
      <Stack direction="row" spacing={1} sx={{ px: 2.5, py: 1.5, flexWrap: "wrap" }}>
        <Chip label={`${records.length} records`} sx={{ color: "#fff", background: "rgba(255,255,255,0.12)" }} />
        <Chip label={`${completeCount} complete`} sx={{ color: "#fff", background: "rgba(34,197,94,0.28)" }} />
        <Chip label="DynamoDB storage" sx={{ color: "#fff", background: "rgba(255,255,255,0.12)" }} />
      </Stack>
    </Paper>
  );
}

// Renders the searchable list of records and the selected record detail area.
function RecordsView({
  records,
  filteredRecords,
  selectedRecord,
  isLoadingRecords,
  searchText,
  setSearchText,
  setSelectedId,
  updateSelectedRecord,
  saveSelectedRecord,
  handleDeleteRecord,
  markSelectedComplete
}: {
  records: SoilSiteRecord[];
  filteredRecords: SoilSiteRecord[];
  selectedRecord?: SoilSiteRecord;
  isLoadingRecords: boolean;
  searchText: string;
  setSearchText: (value: string) => void;
  setSelectedId: (id: string) => void;
  updateSelectedRecord: (field: keyof SoilSiteRecord, value: string) => void;
  saveSelectedRecord: (record: SoilSiteRecord) => void;
  handleDeleteRecord: (id: string) => void;
  markSelectedComplete: () => void;
}) {
  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${theme.line}` }}>
        <Stack spacing={1.5}>
          <SectionTitle title="Entry" subtitle="Select a site, then review or edit the soil record." />
          {isLoadingRecords ? <LinearProgress /> : null}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1.3fr" }, gap: 1.5 }}>
            <TextField
              placeholder="Search station, county, pedon ID..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              size="small"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }
              }}
            />
            <FormControl size="small">
              <InputLabel>Current record</InputLabel>
              <Select
                label="Current record"
                value={selectedRecord?.id ?? ""}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {filteredRecords.map((record) => (
                  <MenuItem key={record.id} value={record.id}>
                    {record.station || "Unnamed site"} · {record.county || "Unknown county"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          {!isLoadingRecords && records.length === 0 ? (
            <Alert severity="info">
              Import a Word document or add a manual record to start entering data.
            </Alert>
          ) : null}
          {!isLoadingRecords && records.length > 0 && filteredRecords.length === 0 ? (
            <Alert severity="info" sx={{ m: 1 }}>
              No records match that search.
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ border: `1px solid ${theme.line}`, overflow: "hidden" }}>
        {selectedRecord ? (
          <RecordDetail
            record={selectedRecord}
            onChange={updateSelectedRecord}
            onUpdateRecord={saveSelectedRecord}
            onDelete={() => handleDeleteRecord(selectedRecord.id)}
            onMarkComplete={markSelectedComplete}
          />
        ) : (
          <Box sx={{ p: 3 }}>
            <Alert severity="info">Import or select a record to start reviewing.</Alert>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}

// Renders the editable detail form for one selected soil site record.
function RecordDetail({
  record,
  onChange,
  onUpdateRecord,
  onDelete,
  onMarkComplete
}: {
  record: SoilSiteRecord;
  onChange: (field: keyof SoilSiteRecord, value: string) => void;
  onUpdateRecord: (record: SoilSiteRecord) => void;
  onDelete: () => void;
  onMarkComplete: () => void;
}) {
  const [detailTab, setDetailTab] = useState(0);

  // Replaces the selected record's horizon list after a horizon edit.
  function saveHorizons(horizons: SoilHorizon[]) {
    onUpdateRecord(
      normalizeRecord({
        ...record,
        horizons
      })
    );
  }

  // Updates one field on one horizon row.
  function updateHorizon(
    index: number,
    field: keyof SoilHorizon,
    value: string
  ) {
    const horizons = record.horizons.map((horizon, horizonIndex) =>
      horizonIndex === index ? { ...horizon, [field]: value } : horizon
    );

    saveHorizons(horizons);
  }

  // Adds a blank horizon row so users can enter missing layer data manually.
  function addHorizon() {
    saveHorizons([
      ...record.horizons,
      {
        name: "",
        depth: "",
        texture: "",
        topDepthCm: "",
        bottomDepthCm: "",
        topDepthIn: "",
        bottomDepthIn: "",
        sandPercent: "",
        siltPercent: "",
        clayPercent: "",
        ph: "",
        acidity: "",
        color: "",
        structure: "",
        consistence: "",
        roots: "",
        boundary: "",
        fragments: "",
        clayFilms: "",
        electricalConductivity: "",
        description: ""
      }
    ]);
    setDetailTab(1);
  }

  // Removes one horizon row from the selected record.
  function deleteHorizon(index: number) {
    saveHorizons(record.horizons.filter((_, horizonIndex) => horizonIndex !== index));
  }

  return (
    <Stack>
      <Box sx={{ p: 2, background: `linear-gradient(135deg, ${theme.red900}, ${theme.red800})`, color: "#fff" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}>
          <Box>
            <Typography variant="overline" sx={{ color: "#fecdd3", fontWeight: 900 }}>
              Active record
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              {record.station || "Unnamed Mesonet Site"}
            </Typography>
            <Typography sx={{ color: "#fbd0d6" }}>
              {record.county || "Unknown county"} county · {record.soilSeries || "No soil series"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Chip label={record.reviewStatus} color={statusColors[record.reviewStatus]} />
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ p: 2 }}>
        <Paper variant="outlined" sx={{ borderColor: theme.line, mb: 2, background: "#fffafa" }}>
          <Box sx={{ p: 1.5, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1 }}>
            <CompactFact label="Horizons" value={String(record.horizons.length)} />
            <CompactFact label="County" value={record.county || "Missing"} />
            <CompactFact label="Pedon ID" value={record.pedonId || "Missing"} />
            <CompactFact label="Status" value={record.reviewStatus} />
          </Box>
        </Paper>

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
          <Button variant="contained" startIcon={<CheckCircleIcon />} onClick={onMarkComplete}>
            Mark complete
          </Button>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>
            Delete
          </Button>
          <Chip icon={<SaveIcon />} label="Auto-saves edits" variant="outlined" />
        </Stack>

        <Paper variant="outlined" sx={{ borderColor: theme.line, overflow: "hidden" }}>
          <Tabs
            value={detailTab}
            onChange={(_, value: number) => setDetailTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 1,
              background: "#fff7f8",
              borderBottom: `1px solid ${theme.line}`,
              "& .MuiTab-root": { fontWeight: 900, textTransform: "none" },
              "& .MuiTabs-indicator": { backgroundColor: theme.red700, height: 3 }
            }}
          >
            <Tab label="Review fields" />
            <Tab label={`Horizons (${record.horizons.length})`} />
            <Tab label="Source text" />
          </Tabs>

          <Box sx={{ p: 2 }}>
            {detailTab === 0 ? (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
                <FormSection title="Site Identity">
                  <TextField label="Station" value={record.station} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("station", event.target.value)} />
                  <TextField label="County" value={record.county} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("county", event.target.value)} />
                  <TextField label="Site ID" value={record.siteId} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("siteId", event.target.value)} />
                  <TextField label="Pedon ID" value={record.pedonId} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("pedonId", event.target.value)} />
                </FormSection>

                <FormSection title="Location">
                  <TextField label="Latitude" value={record.latitude} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("latitude", event.target.value)} />
                  <TextField label="Longitude" value={record.longitude} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("longitude", event.target.value)} />
                  <TextField label="Map unit" value={record.mapUnit} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("mapUnit", event.target.value)} sx={{ gridColumn: { xs: "auto", md: "span 2" } }} />
                </FormSection>

                <FormSection title="Soil Description">
                  <TextField label="Description date" value={record.descriptionDate} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("descriptionDate", event.target.value)} />
                  <TextField label="Soil series" value={record.soilSeries} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("soilSeries", event.target.value)} />
                  <TextField label="Classification" value={record.classification} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("classification", event.target.value)} sx={{ gridColumn: { xs: "auto", md: "span 2" } }} />
                  <TextField label="Parent material" value={record.parentMaterial} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("parentMaterial", event.target.value)} sx={{ gridColumn: { xs: "auto", md: "span 2" } }} />
                </FormSection>

                <FormSection title="Review">
                  <FormControl>
                    <InputLabel>Review status</InputLabel>
                    <Select label="Review status" value={record.reviewStatus} onChange={(event) => onChange("reviewStatus", event.target.value as ReviewStatus)}>
                      <MenuItem value="Imported">Imported</MenuItem>
                      <MenuItem value="Needs Review">Needs Review</MenuItem>
                      <MenuItem value="Complete">Complete</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField label="Source document" value={record.sourceDocument} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("sourceDocument", event.target.value)} />
                  <TextField label="Reviewer notes" value={record.reviewerNotes} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("reviewerNotes", event.target.value)} multiline minRows={3} sx={{ gridColumn: { xs: "auto", md: "span 2" } }} />
                </FormSection>
              </Box>
            ) : null}

            {detailTab === 1 ? (
              <HorizonsPanel
                record={record}
                compact
                onHorizonChange={updateHorizon}
                onAddHorizon={addHorizon}
                onDeleteHorizon={deleteHorizon}
              />
            ) : null}
            {detailTab === 2 ? (
              <Box>
                <SectionTitle title="Source Text" subtitle="Original imported text for reference." />
                <TextField sx={{ mt: 2 }} value={record.rawText} multiline minRows={16} fullWidth slotProps={{ input: { readOnly: true } }} />
              </Box>
            ) : null}
          </Box>
        </Paper>
      </Box>
    </Stack>
  );
}

// Shows a compact label/value pair in the record summary strip.
function CompactFact({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </Typography>
    </Box>
  );
}

// Renders the import workspace for batch Word uploads, pasted text, and manual entry.
function ImportView({
  isImporting,
  manualText,
  manualFileName,
  setManualText,
  setManualFileName,
  handleFileImport,
  handlePastedImport,
  openManual
}: {
  isImporting: boolean;
  manualText: string;
  manualFileName: string;
  setManualText: (value: string) => void;
  setManualFileName: (value: string) => void;
  handleFileImport: (files: FileList | null) => void;
  handlePastedImport: () => void;
  openManual: () => void;
}) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "0.9fr 1.1fr" }, gap: 2 }}>
      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${theme.line}` }}>
        <SectionTitle title="Import Center" subtitle="Add many NRCS Word pedon descriptions at one time." />
        <Box
          sx={{
            mt: 2,
            p: 3,
            textAlign: "center",
            border: `2px dashed ${theme.red600}`,
            background: theme.red50,
            borderRadius: 1.5
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 48, color: theme.red700 }} />
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Batch import .docx files
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Select one file or dozens. Each document becomes a reviewable soil site record.
          </Typography>
          <Button component="label" variant="contained" startIcon={<CloudUploadIcon />}>
            Choose files
            <input hidden type="file" multiple accept=".docx" onChange={(event) => handleFileImport(event.target.files)} />
          </Button>
          {isImporting ? <LinearProgress sx={{ mt: 2 }} /> : null}
        </Box>
        <Alert severity="info" sx={{ mt: 2 }}>
          Imported records remain editable after upload.
        </Alert>
        <Button sx={{ mt: 2 }} variant="outlined" startIcon={<AddIcon />} onClick={openManual}>
          Add a blank manual record
        </Button>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${theme.line}` }}>
        <SectionTitle title="Paste Import" subtitle="Use this when a document was copied from email, Word, or PDF text." />
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <TextField label="Source name" value={manualFileName} onChange={(event) => setManualFileName(event.target.value)} placeholder="Adair County Mesonet Pedon Description.docx" />
          <TextField label="Pedon description text" value={manualText} onChange={(event) => setManualText(event.target.value)} multiline minRows={14} />
          <Button variant="contained" onClick={handlePastedImport}>
            Import pasted text
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

// Renders export tools and high-level data counts for the current records.
function ReportsView({
  records,
  warningCount,
  horizonCount,
  onExportRecords,
  onExportHorizons
}: {
  records: SoilSiteRecord[];
  warningCount: number;
  horizonCount: number;
  onExportRecords: () => void;
  onExportHorizons: () => void;
}) {
  const countyCount = new Set(records.map((record) => record.county).filter(Boolean)).size;

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
        <MetricCard icon={<Inventory2Icon />} label="Records" value={records.length} />
        <MetricCard icon={<FolderOpenIcon />} label="Counties" value={countyCount} />
        <MetricCard icon={<ArticleIcon />} label="Horizons" value={horizonCount} />
        <MetricCard icon={<WarningAmberIcon />} label="Review flags" value={warningCount} />
      </Box>

      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${theme.line}` }}>
        <SectionTitle title="Exports" subtitle="Download clean CSV files for spreadsheet review or reporting." />
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mt: 2 }}>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={onExportRecords}>
            Export site records CSV
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExportHorizons}>
            Export horizons CSV
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${theme.line}` }}>
        <SectionTitle title="Data Handling" subtitle="The app stores editable site records and editable horizon records in DynamoDB." />
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Alert severity="info">
            Site records and horizon records can be reviewed, edited, and exported.
          </Alert>
        </Stack>
      </Paper>
    </Stack>
  );
}

// Renders the manual entry dialog for stations that are not coming from a Word file.
function ManualRecordDialog({
  open,
  record,
  onClose,
  onChange,
  onSave
}: {
  open: boolean;
  record: SoilSiteRecord;
  onClose: () => void;
  onChange: (field: keyof SoilSiteRecord, value: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Add Soil Site Manually</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Manual entry is for new stations, field notes, or documents that cannot be parsed yet.
          </Alert>
          <FormSection title="Site Identity">
            <TextField label="Station" value={record.station} onChange={(event) => onChange("station", event.target.value)} />
            <TextField label="County" value={record.county} onChange={(event) => onChange("county", event.target.value)} />
            <TextField label="Site ID" value={record.siteId} onChange={(event) => onChange("siteId", event.target.value)} />
            <TextField label="Pedon ID" value={record.pedonId} onChange={(event) => onChange("pedonId", event.target.value)} />
          </FormSection>
          <FormSection title="Soil And Location">
            <TextField label="Description date" value={record.descriptionDate} onChange={(event) => onChange("descriptionDate", event.target.value)} />
            <TextField label="Soil series" value={record.soilSeries} onChange={(event) => onChange("soilSeries", event.target.value)} />
            <TextField label="Latitude" value={record.latitude} onChange={(event) => onChange("latitude", event.target.value)} />
            <TextField label="Longitude" value={record.longitude} onChange={(event) => onChange("longitude", event.target.value)} />
            <TextField label="Classification" value={record.classification} onChange={(event) => onChange("classification", event.target.value)} sx={{ gridColumn: { xs: "auto", md: "span 2" } }} />
            <TextField label="Map unit" value={record.mapUnit} onChange={(event) => onChange("mapUnit", event.target.value)} sx={{ gridColumn: { xs: "auto", md: "span 2" } }} />
            <TextField label="Parent material" value={record.parentMaterial} onChange={(event) => onChange("parentMaterial", event.target.value)} sx={{ gridColumn: { xs: "auto", md: "span 2" } }} />
          </FormSection>
          <FormSection title="Source And Notes">
            <TextField label="Source document or note" value={record.sourceDocument} onChange={(event) => onChange("sourceDocument", event.target.value)} sx={{ gridColumn: { xs: "auto", md: "span 2" } }} />
            <TextField label="Reviewer notes" value={record.reviewerNotes} onChange={(event) => onChange("reviewerNotes", event.target.value)} multiline minRows={3} sx={{ gridColumn: { xs: "auto", md: "span 2" } }} />
          </FormSection>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave}>
          Save manual record
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Groups related form fields under a simple section title.
function FormSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, color: theme.red900, fontWeight: 900 }}>
        {title}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
        {children}
      </Box>
    </Box>
  );
}


// Shows horizon rows either as editable fields or read-only extracted facts.
function HorizonsPanel({
  record,
  compact = false,
  onHorizonChange,
  onAddHorizon,
  onDeleteHorizon
}: {
  record: SoilSiteRecord;
  compact?: boolean;
  onHorizonChange?: (
    index: number,
    field: keyof SoilHorizon,
    value: string
  ) => void;
  onAddHorizon?: () => void;
  onDeleteHorizon?: (index: number) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderColor: theme.line }}>
      {!compact ? (
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.line}` }}>
          <SectionTitle title="Horizons" subtitle={`${record.horizons.length} extracted layers`} />
        </Box>
      ) : null}
      {onAddHorizon ? (
        <Box sx={{ p: compact ? 0 : 2, pb: 1 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={onAddHorizon}>
            Add horizon
          </Button>
        </Box>
      ) : null}
      <Stack spacing={1.25} sx={{ p: compact ? 0 : 2, maxHeight: compact ? 620 : 540, overflow: "auto" }}>
        {record.horizons.map((horizon) => {
          const canEdit = Boolean(onHorizonChange);

          return (
            <Paper key={`${record.id}-${horizon.name}-${horizon.depth}`} variant="outlined" sx={{ p: 1.5, borderColor: theme.line, background: "#fffdfd" }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", mb: 1 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Chip label={horizon.name || "New"} size="small" sx={{ background: theme.red700, color: "#fff", fontWeight: 900 }} />
                  <Typography sx={{ fontWeight: 800 }}>{horizon.depth || "Depth not set"}</Typography>
                  <Typography color="text.secondary">{horizon.texture || "Texture not set"}</Typography>
                </Stack>
                {onDeleteHorizon ? (
                  <Button size="small" color="error" onClick={() => onDeleteHorizon(record.horizons.indexOf(horizon))}>
                    Delete
                  </Button>
                ) : null}
              </Stack>
              {canEdit && onHorizonChange ? (
                <HorizonEditGrid
                  horizon={horizon}
                  index={record.horizons.indexOf(horizon)}
                  onChange={onHorizonChange}
                />
              ) : (
                <HorizonReadOnly horizon={horizon} />
              )}
            </Paper>
          );
        })}
        {record.horizons.length === 0 ? (
          <Alert severity="warning">No horizons are recorded for this site.</Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}

// Renders editable input fields for one soil horizon layer.
function HorizonEditGrid({
  horizon,
  index,
  onChange
}: {
  horizon: SoilHorizon;
  index: number;
  onChange: (index: number, field: keyof SoilHorizon, value: string) => void;
}) {
  const fields: Array<{
    label: string;
    field: keyof SoilHorizon;
    multiline?: boolean;
    wide?: boolean;
  }> = [
    { label: "Horizon", field: "name" },
    { label: "Depth label", field: "depth" },
    { label: "Texture", field: "texture" },
    { label: "Color", field: "color" },
    { label: "Top cm", field: "topDepthCm" },
    { label: "Bottom cm", field: "bottomDepthCm" },
    { label: "Top inches", field: "topDepthIn" },
    { label: "Bottom inches", field: "bottomDepthIn" },
    { label: "Sand %", field: "sandPercent" },
    { label: "Silt %", field: "siltPercent" },
    { label: "Clay %", field: "clayPercent" },
    { label: "pH", field: "ph" },
    { label: "Acidity", field: "acidity" },
    { label: "Structure", field: "structure" },
    { label: "Consistence", field: "consistence" },
    { label: "Roots", field: "roots" },
    { label: "Boundary", field: "boundary" },
    { label: "Fragments", field: "fragments" },
    { label: "Clay films", field: "clayFilms" },
    { label: "Electrical conductivity", field: "electricalConductivity" },
    { label: "Full description", field: "description", multiline: true, wide: true }
  ];

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 1.25 }}>
      {fields.map((item) => (
        <TextField
          key={item.field}
          label={item.label}
          value={String(horizon[item.field] ?? "")}
          onChange={(event) => onChange(index, item.field, event.target.value)}
          size="small"
          multiline={item.multiline}
          minRows={item.multiline ? 3 : undefined}
          sx={{ gridColumn: item.wide ? { xs: "auto", md: "span 4" } : undefined }}
        />
      ))}
    </Box>
  );
}

// Shows the important values from one horizon without empty placeholder dashes.
function HorizonReadOnly({ horizon }: { horizon: SoilHorizon }) {
  const measurements = [
    { label: "Top", value: horizon.topDepthCm, suffix: " cm" },
    { label: "Bottom", value: horizon.bottomDepthCm, suffix: " cm" },
    { label: "Sand", value: horizon.sandPercent, suffix: "%" },
    { label: "Silt", value: horizon.siltPercent, suffix: "%" },
    { label: "Clay", value: horizon.clayPercent, suffix: "%" },
    { label: "pH", value: horizon.ph }
  ].filter((item) => hasValue(item.value));
  const details = [
    { label: "Color", value: horizon.color },
    { label: "Acidity", value: horizon.acidity },
    { label: "Structure", value: horizon.structure },
    { label: "Consistence", value: horizon.consistence },
    { label: "Roots", value: horizon.roots },
    { label: "Boundary", value: horizon.boundary },
    { label: "Fragments", value: horizon.fragments },
    { label: "Clay films", value: horizon.clayFilms },
    { label: "EC", value: horizon.electricalConductivity }
  ].filter((item) => hasValue(item.value));

  return (
    <>
      {measurements.length > 0 ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(6, 1fr)" }, gap: 0.75 }}>
          {measurements.map((item) => (
            <HorizonStat key={item.label} label={item.label} value={item.value} suffix={item.suffix} />
          ))}
        </Box>
      ) : null}
      {details.length > 0 ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 0.75, mt: measurements.length > 0 ? 0.75 : 0 }}>
          {details.map((item) => (
            <HorizonStat key={item.label} label={item.label} value={item.value} />
          ))}
        </Box>
      ) : null}
      {horizon.description ? (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {horizon.description}
        </Typography>
      ) : null}
    </>
  );
}

// Returns true only when a field contains real text or a real value.
function hasValue(value?: string) {
  return Boolean(value && value.trim() && value.trim() !== "-");
}

// Displays one dashboard metric in the reports view.
function MetricCard({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Paper elevation={0} sx={{ p: 1.75, border: `1px solid ${theme.line}` }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box sx={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 1, background: theme.red50, color: theme.red700 }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}


// Standard title block used at the top of dashboard panels.
function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 900, color: theme.ink }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {subtitle}
      </Typography>
    </Box>
  );
}


// Displays one small horizon measurement or descriptive property.
function HorizonStat({
  label,
  value,
  suffix = ""
}: {
  label: string;
  value?: string;
  suffix?: string;
}) {
  return (
    <Box sx={{ p: 1, borderRadius: 1, background: theme.red50, border: `1px solid ${theme.line}` }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 900 }}>{`${value}${suffix}`}</Typography>
    </Box>
  );
}
