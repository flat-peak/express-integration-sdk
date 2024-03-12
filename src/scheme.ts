import { z } from "zod";

const isValidTimeFormat = (time: string) => {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
  return timeRegex.test(time);
};

export const TariffSchema = z.object({
  display_name: z.string(),
  contract_end_date: z.string().optional(),
  timezone: z.string().optional(),
  integration_instance: z.string(),
  provider_tariff_reference: z.string().optional(),
  provider_tariff_expiry_date: z.string().optional(),
  direction: z.enum(["IMPORT", "EXPORT"]),
  connection_type: z.enum(["DIRECT", "MARKET", "LIBRARY"]),
  data: z.array(
    z.object({
      months: z.array(z.string()),
      days_and_hours: z.array(
        z.object({
          days: z.array(z.string()),
          hours: z.array(
            z.object({
              rate: z.array(
                z.object({
                  to_kwh: z
                    .union([z.number().nullable(), z.undefined()])
                    .optional(),
                  value: z.number(),
                }),
              ),
              valid_from: z.string().refine(isValidTimeFormat, {
                message: "Invalid time format. Must be in the format hh:mm:ss",
              }),
              valid_to: z.string().refine(isValidTimeFormat, {
                message: "Invalid time format. Must be in the format hh:mm:ss",
              }),
            }),
          ),
        }),
      ),
    }),
  ),
});
