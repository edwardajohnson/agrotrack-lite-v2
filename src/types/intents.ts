import { z } from "zod";

export const FarmerRegisterIntent = z.object({
  intent: z.literal("FARMER_REGISTER"),
  msisdn: z.string(),
  farmerName: z.string(),
});

export const OfferCreateIntent = z.object({
  intent: z.literal("OFFER_CREATE"),
  msisdn: z.string(),
  crop: z.enum(["maize", "beans", "coffee", "tea", "rice"]),
  quantityKg: z.number().positive(),
  location: z.string(),
  when: z.string().optional(),
});

export const OfferAcceptIntent = z.object({
  intent: z.literal("OFFER_ACCEPT"),
  msisdn: z.string(),
  ref: z.string(),
  otp: z.string().regex(/^\d{6}$/),
});

export const DeliveryConfirmIntent = z.object({
  intent: z.literal("DELIVERY_CONFIRM"),
  msisdn: z.string(),
  ref: z.string(),
  weightKg: z.number().positive(),
  grade: z.enum(["A", "B", "C"]).optional(),
  otp: z.string().regex(/^\d{6}$/),
});

export const PriceQueryIntent = z.object({
  intent: z.literal("PRICE_QUERY"),
  msisdn: z.string(),
  crop: z.enum(["maize", "beans", "coffee", "tea", "rice"]),
  location: z.string().optional(),
});

export const StatusCheckIntent = z.object({
  intent: z.literal("STATUS_CHECK"),
  msisdn: z.string(),
  ref: z.string(),
});

export const IntentSchema = z.discriminatedUnion("intent", [
  FarmerRegisterIntent,
  OfferCreateIntent,
  OfferAcceptIntent,
  DeliveryConfirmIntent,
  PriceQueryIntent,
  StatusCheckIntent,
]);

export type Intent = z.infer<typeof IntentSchema>;

// ============================================================================
// INTENT AGENT (NLP)
// ============================================================================
