# Kentucky Mesonet Soil Data Manager

Internal Next.js application for entering, importing, editing, and exporting Kentucky Mesonet soil/pedon records.

## Stack

- Next.js App Router
- TypeScript
- Material UI
- AWS DynamoDB
- Mammoth for `.docx` text extraction

## What This Project Does

- Import NRCS `.docx` pedon descriptions
- Add soil records manually
- Edit site metadata
- Add, edit, and delete soil horizons
- Delete records
- Export site and horizon CSV files

## Project Structure

- `app/soil-dashboard.tsx`: main dashboard UI and frontend logic
- `app/api/soil-records/route.ts`: backend API route for records
- `lib/soil-records-store.ts`: DynamoDB read, add, update, and delete functions
- `app/providers.tsx`: Material UI theme setup
- `public/kymesonet-logo.png`: Kentucky Mesonet logo used in the header
- `dynamodb-schema.json`: JSON schema shape for the DynamoDB item
- `amplify-data-resource.ts`: Amplify Gen 2 schema draft for backend review

## Data Fields

Each soil record includes:

- station
- county
- site ID
- pedon ID
- description date
- soil series
- classification
- latitude and longitude
- map unit
- slope
- drainage class
- parent material
- source document
- review status
- reviewer notes
- validation warnings
- raw source text
- soil horizons

Each horizon can include depth, texture, color, sand/silt/clay percentages, pH, acidity, structure, roots, boundary, fragments, clay films, electrical conductivity, and the full horizon description.

## Local Environment

This app expects these environment variables when DynamoDB is connected:

```bash
AWS_REGION=us-east-1
DYNAMODB_SOIL_TABLE_NAME=mesonet-soil-records
```


