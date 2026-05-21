import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  SoilHorizon: a.customType({
    name: a.string().required(),
    depth: a.string().required(),
    texture: a.string().required(),
    topDepthCm: a.string(),
    bottomDepthCm: a.string(),
    topDepthIn: a.string(),
    bottomDepthIn: a.string(),
    sandPercent: a.string(),
    siltPercent: a.string(),
    clayPercent: a.string(),
    ph: a.string(),
    acidity: a.string(),
    color: a.string(),
    structure: a.string(),
    consistence: a.string(),
    roots: a.string(),
    boundary: a.string(),
    fragments: a.string(),
    clayFilms: a.string(),
    electricalConductivity: a.string(),
    description: a.string().required()
  }),
  SoilSiteRecord: a
    .model({
      id: a.id().required(),
      station: a.string().required(),
      county: a.string().required(),
      siteId: a.string(),
      pedonId: a.string(),
      descriptionDate: a.string(),
      soilSeries: a.string(),
      classification: a.string(),
      latitude: a.string(),
      longitude: a.string(),
      mapUnit: a.string(),
      slope: a.string(),
      drainageClass: a.string(),
      parentMaterial: a.string(),
      sourceDocument: a.string(),
      reviewStatus: a.enum(["Imported", "Needs Review", "Complete"]),
      reviewerNotes: a.string(),
      validationWarnings: a.string().array(),
      rawText: a.string(),
      horizons: a.ref("SoilHorizon").array(),
      updatedAt: a.datetime()
    })
    .identifier(["id"])
    .authorization((allow) => [allow.authenticated()])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool"
  }
});
