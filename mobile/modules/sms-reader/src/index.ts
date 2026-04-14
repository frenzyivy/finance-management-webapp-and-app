import { requireNativeModule } from "expo-modules-core";

const SmsReader = requireNativeModule("SmsReader");

export interface SmsMessage {
  _id: string;
  address: string;
  body: string;
  date: number;
  type: number;
}

/**
 * Read SMS messages from the device inbox.
 * @param minDate - Unix timestamp in ms. Only messages after this date are returned. Pass 0 for all.
 */
export async function readSms(minDate: number = 0): Promise<SmsMessage[]> {
  return await SmsReader.readSms(minDate);
}