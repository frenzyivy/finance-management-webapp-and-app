/**
 * SMS Reader for Android devices.
 * Uses a custom Expo native module for reliable SMS reading.
 * No-op on iOS since SMS access is not available.
 */

import { Platform, PermissionsAndroid, Linking } from "react-native";

export interface SmsMessage {
  _id: string;
  address: string; // Sender ID (e.g., "HDFCBK")
  body: string;
  date: number; // Unix timestamp in ms
  type: number; // 1 = received, 2 = sent
}

export type PermissionResult = "granted" | "denied" | "never_ask_again";

/**
 * Request SMS read permission on Android.
 * Returns:
 * - "granted" if permission was given
 * - "denied" if user tapped Deny (can ask again)
 * - "never_ask_again" if user checked "Don't ask again" or system blocked the dialog
 * Always returns "denied" on iOS.
 */
export async function requestSmsPermission(): Promise<PermissionResult> {
  if (Platform.OS !== "android") return "denied";

  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: "SMS Permission",
        message:
          "KomalFin needs access to your SMS messages to automatically detect bank transactions and import them as expenses or income.",
        buttonPositive: "Allow",
        buttonNegative: "Deny",
      }
    );

    if (result === PermissionsAndroid.RESULTS.GRANTED) return "granted";
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return "never_ask_again";
    return "denied";
  } catch {
    return "denied";
  }
}

/**
 * Open the app's system settings page where the user can toggle permissions.
 */
export function openAppSettings(): void {
  Linking.openSettings();
}

/**
 * Check if SMS permission is already granted.
 */
export async function hasSmsPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    );
  } catch {
    return false;
  }
}

/**
 * Read SMS messages from the device using custom Expo native module.
 * Requires READ_SMS permission to be granted first.
 * Returns empty array on iOS.
 */
export async function readSmsMessages(
  sinceDate?: Date
): Promise<SmsMessage[]> {
  if (Platform.OS !== "android") return [];

  try {
    const { readSms } = require("../../modules/sms-reader/src");
    const minDate = sinceDate ? sinceDate.getTime() : 0;
    const messages: SmsMessage[] = await readSms(minDate);
    return messages;
  } catch (err) {
    console.warn("SMS read failed:", err);
    return [];
  }
}
