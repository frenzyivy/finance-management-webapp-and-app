import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { parseSms, isBankSms } from "../lib/sms-parser";
import {
  requestSmsPermission,
  hasSmsPermission,
  readSmsMessages,
  openAppSettings,
} from "../lib/sms-reader";
import type { PermissionResult } from "../lib/sms-reader";
import { formatDate } from "../lib/format";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../lib/constants";
import { PickerModal } from "../components/PickerModal";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageHeader } from "../components/PageHeader";
import { formatINR, TransactionCard } from "../components/komal";
import type { ParsedSmsTransaction } from "../lib/sms-parser";

interface ScanResult extends ParsedSmsTransaction {
  selected: boolean;
  assignedCategory: string;
  alreadyImported: boolean;
  sender: string;
  hidden: boolean; // user chose to hide this (reminders, false matches, etc.)
}

const HIDDEN_SMS_KEY = "komalfin_hidden_sms";

async function loadHiddenHashes(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(HIDDEN_SMS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

async function saveHiddenHashes(hashes: Set<string>) {
  await AsyncStorage.setItem(HIDDEN_SMS_KEY, JSON.stringify([...hashes]));
}

/** Simple hash of SMS text for persistence */
function smsHash(rawText: string): string {
  // Use first 100 chars to keep it small but unique enough
  return rawText.slice(0, 100);
}

type PaymentModeFilter =
  | "all"
  | "upi"
  | "imps"
  | "neft"
  | "atm"
  | "pos"
  | "other";

const DATE_FILTERS = [
  { label: "Today", days: 0 },
  { label: "3 Days", days: 3 },
  { label: "7 Days", days: 7 },
  { label: "15 Days", days: 15 },
  { label: "1 Month", days: 30 },
  { label: "3 Months", days: 90 },
  { label: "All", days: -1 },
] as const;

export function SmsScanScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [allResults, setAllResults] = useState<ScanResult[]>([]);
  const [activeDaysFilter, setActiveDaysFilter] = useState(90); // default: 3 months
  const [activeSenders, setActiveSenders] = useState<Set<string>>(new Set()); // empty = all
  const [activePaymentMode, setActivePaymentMode] =
    useState<PaymentModeFilter>("all");
  const [showSenderFilter, setShowSenderFilter] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  // null = checking, "granted" | "denied" | "never_ask_again"
  const [permissionState, setPermissionState] =
    useState<PermissionResult | null>(null);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [activeResultIdx, setActiveResultIdx] = useState<number>(-1);

  // Get unique senders with transaction counts
  const senderStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of allResults) {
      map.set(r.sender, (map.get(r.sender) || 0) + 1);
    }
    // Sort by count descending
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([sender, count]) => ({ sender, count }));
  }, [allResults]);

  // Filter results by date range, senders, payment mode, and hidden
  const results = useMemo(() => {
    let filtered = allResults;

    // Hide hidden items (unless user toggled "show hidden")
    if (!showHidden) {
      filtered = filtered.filter((r) => !r.hidden);
    }

    // Sender filter
    if (activeSenders.size > 0) {
      filtered = filtered.filter((r) => activeSenders.has(r.sender));
    }

    // Payment mode filter
    if (activePaymentMode !== "all") {
      filtered = filtered.filter((r) => {
        const mode = (r.paymentMode || "").toUpperCase();
        if (activePaymentMode === "upi") return mode === "UPI";
        if (activePaymentMode === "imps") return mode === "IMPS";
        if (activePaymentMode === "neft") return mode === "NEFT";
        if (activePaymentMode === "atm") return mode === "ATM";
        if (activePaymentMode === "pos") return mode === "POS";
        if (activePaymentMode === "other")
          return (
            !mode || !["UPI", "IMPS", "NEFT", "ATM", "POS"].includes(mode)
          );
        return true;
      });
    }

    // Date filter
    if (activeDaysFilter !== -1) {
      const now = new Date();
      let cutoff: string;
      if (activeDaysFilter === 0) {
        cutoff = now.toISOString().split("T")[0];
      } else {
        const d = new Date();
        d.setDate(d.getDate() - activeDaysFilter);
        cutoff = d.toISOString().split("T")[0];
      }
      filtered = filtered.filter((r) => r.date >= cutoff);
    }

    return filtered;
  }, [
    allResults,
    activeDaysFilter,
    activeSenders,
    activePaymentMode,
    showHidden,
  ]);

  const hiddenCount = allResults.filter((r) => r.hidden).length;

  function toggleSender(sender: string) {
    setActiveSenders((prev) => {
      const next = new Set(prev);
      if (next.has(sender)) {
        next.delete(sender);
      } else {
        next.add(sender);
      }
      return next;
    });
  }

  function clearSenderFilter() {
    setActiveSenders(new Set());
  }

  async function hideTransaction(idx: number) {
    const item = results[idx];
    if (!item) return;
    const hash = smsHash(item.rawText);
    // Update local state
    setAllResults((prev) =>
      prev.map((r) =>
        r.rawText === item.rawText
          ? { ...r, hidden: true, selected: false }
          : r
      )
    );
    // Persist to AsyncStorage
    const existing = await loadHiddenHashes();
    existing.add(hash);
    await saveHiddenHashes(existing);
  }

  async function unhideAll() {
    setAllResults((prev) => prev.map((r) => ({ ...r, hidden: false })));
    await AsyncStorage.removeItem(HIDDEN_SMS_KEY);
    setShowHidden(false);
  }

  useEffect(() => {
    if (Platform.OS !== "android") {
      Alert.alert(
        "Not Available",
        "SMS scanning is only available on Android devices.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
      return;
    }
    checkPermission();
  }, []);

  async function checkPermission() {
    const granted = await hasSmsPermission();
    if (granted) {
      setPermissionState("granted");
      startScan();
    } else {
      setPermissionState("denied");
    }
  }

  async function requestAndScan() {
    const result = await requestSmsPermission();
    setPermissionState(result);

    if (result === "granted") {
      startScan();
    } else if (result === "never_ask_again") {
      openAppSettings();
    }
  }

  function handleOpenSettings() {
    openAppSettings();
    const unsubscribe = navigation.addListener("focus", () => {
      checkPermission();
      unsubscribe();
    });
  }

  async function startScan() {
    setScanning(true);
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 90); // Last 90 days

      const [messages, hiddenHashes] = await Promise.all([
        readSmsMessages(sinceDate),
        loadHiddenHashes(),
      ]);
      const bankMessages = messages.filter((m) =>
        isBankSms(m.address, m.body)
      );

      // Fetch existing expenses and income to detect already-imported transactions
      const [expenseRes, incomeRes] = await Promise.all([
        supabase
          .from("expense_entries")
          .select("amount, date")
          .gte("date", sinceDate.toISOString().split("T")[0]),
        supabase
          .from("income_entries")
          .select("amount, date")
          .gte("date", sinceDate.toISOString().split("T")[0]),
      ]);

      // Build a Set of "amount|date" keys for fast lookup
      const existingKeys = new Set<string>();
      for (const e of expenseRes.data ?? []) {
        existingKeys.add(`${Number(e.amount).toFixed(2)}|${e.date}`);
      }
      for (const i of incomeRes.data ?? []) {
        existingKeys.add(`${Number(i.amount).toFixed(2)}|${i.date}`);
      }

      const parsed: ScanResult[] = [];
      for (const msg of bankMessages) {
        const result = parseSms(msg.body, new Date(msg.date), msg.address);
        if (result) {
          const key = `${result.amount.toFixed(2)}|${result.date}`;
          const alreadyImported = existingKeys.has(key);
          const isHidden = hiddenHashes.has(smsHash(msg.body));
          parsed.push({
            ...result,
            selected: !alreadyImported && !isHidden,
            assignedCategory:
              result.type === "debit" ? "miscellaneous" : "other",
            alreadyImported,
            sender: msg.address,
            hidden: isHidden,
          });
        }
      }

      // Sort by date descending
      parsed.sort((a, b) => b.date.localeCompare(a.date));
      setAllResults(parsed);
    } catch (err) {
      console.error("SMS scan error:", err);
      Alert.alert("Error", "Failed to scan SMS messages.");
    } finally {
      setScanning(false);
    }
  }

  function toggleSelect(idx: number) {
    const item = results[idx];
    if (!item) return;
    setAllResults((prev) =>
      prev.map((r) =>
        r.date === item.date &&
        r.amount === item.amount &&
        r.rawText === item.rawText
          ? { ...r, selected: !r.selected }
          : r
      )
    );
  }

  function selectAll() {
    const filteredKeys = new Set(results.map((r) => r.rawText));
    setAllResults((prev) =>
      prev.map((r) =>
        filteredKeys.has(r.rawText) ? { ...r, selected: true } : r
      )
    );
  }

  function deselectAll() {
    const filteredKeys = new Set(results.map((r) => r.rawText));
    setAllResults((prev) =>
      prev.map((r) =>
        filteredKeys.has(r.rawText) ? { ...r, selected: false } : r
      )
    );
  }

  function openCategoryPicker(idx: number) {
    setActiveResultIdx(idx);
    setCategoryPickerVisible(true);
  }

  function handleCategorySelect(value: string) {
    if (activeResultIdx >= 0) {
      setAllResults((prev) =>
        prev.map((r, i) =>
          i === activeResultIdx ? { ...r, assignedCategory: value } : r
        )
      );
    }
    setCategoryPickerVisible(false);
  }

  const getCategoryLabel = useCallback(
    (value: string, type: "debit" | "credit") => {
      const list = type === "debit" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
      return list.find((c) => c.value === value)?.label ?? value;
    },
    []
  );

  async function handleImport() {
    const selected = results.filter((r) => r.selected && !r.alreadyImported);
    if (selected.length === 0) {
      Alert.alert("No Selection", "Please select transactions to import.");
      return;
    }

    setImporting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "Not authenticated");
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const r of selected) {
        const payee =
          r.description ||
          r.merchantName ||
          r.upiId?.split("@")[0] ||
          "Unknown";
        const paymentMethod =
          r.paymentMode === "UPI"
            ? "upi"
            : r.paymentMode === "IMPS" ||
              r.paymentMode === "NEFT" ||
              r.paymentMode === "RTGS"
            ? "bank_transfer"
            : r.paymentMode === "ATM"
            ? "cash"
            : r.paymentMode === "POS"
            ? "debit_card"
            : "upi";

        if (r.type === "debit") {
          const { error } = await supabase.from("expense_entries").insert({
            user_id: user.id,
            amount: r.amount,
            category: r.assignedCategory,
            payee_name: payee,
            date: r.date,
            payment_method: paymentMethod,
            is_emi: false,
            is_recurring: false,
            notes: r.upiRemark
              ? `SMS Import | ${r.upiRemark}`
              : `SMS Import | ${r.sender}`,
          });
          if (error) {
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          const { error } = await supabase.from("income_entries").insert({
            user_id: user.id,
            amount: r.amount,
            category: r.assignedCategory,
            source_name: payee,
            date: r.date,
            payment_method: paymentMethod,
            is_recurring: false,
            notes: r.upiRemark
              ? `SMS Import | ${r.upiRemark}`
              : `SMS Import | ${r.sender}`,
          });
          if (error) {
            errorCount++;
          } else {
            successCount++;
          }
        }
      }

      if (successCount > 0) {
        Alert.alert(
          "Added to Dashboard",
          `${successCount} transaction${successCount !== 1 ? "s" : ""} added directly to your ${
            selected[0].type === "debit" ? "Expenses" : "Income"
          }.${errorCount > 0 ? `\n${errorCount} failed.` : ""}`,
          [
            {
              text: "View Expenses",
              onPress: () =>
                navigation.navigate("Main", { screen: "Expenses" }),
            },
            { text: "OK" },
          ]
        );
        const importedTexts = new Set(
          selected.filter((_, i) => i < successCount).map((r) => r.rawText)
        );
        setAllResults((prev) =>
          prev.map((r) =>
            importedTexts.has(r.rawText)
              ? { ...r, selected: false, alreadyImported: true }
              : r
          )
        );
      } else {
        Alert.alert(
          "Error",
          "Failed to import transactions. Please try again."
        );
      }
    } catch (err) {
      Alert.alert("Error", "Failed to import transactions.");
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = results.filter((r) => r.selected).length;
  const importedCount = results.filter((r) => r.alreadyImported).length;
  const newCount = results.length - importedCount;

  // ── Permission Request Screen ──

  if (permissionState === "denied" || permissionState === "never_ask_again") {
    const isBlocked = permissionState === "never_ask_again";
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <PageHeader title="Scan SMS" eyebrow="Parse bank SMS" />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 32,
          }}
        >
          <Text
            style={[
              typography.sectionTitle,
              {
                color: colors.textPrimary,
                marginBottom: 12,
                textAlign: "center",
              },
            ]}
          >
            SMS Permission Required
          </Text>
          <Text
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                textAlign: "center",
                lineHeight: 20,
                marginBottom: 24,
              },
            ]}
          >
            {isBlocked
              ? "SMS permission was previously denied. Please open Settings and enable SMS permission for KomalFin to scan your bank messages."
              : "KomalFin needs to read your SMS to find bank transaction messages. Your messages are parsed on-device and never sent to any server."}
          </Text>
          {isBlocked ? (
            <Pressable
              onPress={handleOpenSettings}
              style={({ pressed }) => [
                styles.primaryBtnBase,
                {
                  backgroundColor: colors.accent,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  color: "#fff",
                  fontFamily: fonts.sansSemibold,
                  fontSize: 15,
                }}
              >
                Open Settings
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={requestAndScan}
              style={({ pressed }) => [
                styles.primaryBtnBase,
                {
                  backgroundColor: colors.accent,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  color: "#fff",
                  fontFamily: fonts.sansSemibold,
                  fontSize: 15,
                }}
              >
                Grant Permission
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              {
                paddingVertical: 14,
                paddingHorizontal: 24,
                alignItems: "center",
                marginTop: 8,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 15,
                fontFamily: fonts.sansMedium,
              }}
            >
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Scanning ──

  if (scanning || permissionState === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <PageHeader title="Scan SMS" eyebrow="Parse bank SMS" />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" color={colors.accent} />
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginTop: 16 },
            ]}
          >
            Scanning SMS messages...
          </Text>
        </View>
      </View>
    );
  }

  // ── Results ──

  const cardBase = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageHeader title="Scan SMS" eyebrow="Parse bank SMS" />

      {/* Header Stats */}
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          paddingHorizontal: 24,
          paddingBottom: 10,
        }}
      >
        <View style={[cardBase, { flex: 1, alignItems: "center" }]}>
          <Text
            style={[
              typography.statValue,
              { color: colors.textPrimary },
            ]}
          >
            {newCount}
          </Text>
          <Text
            style={[
              typography.pillLabel,
              { color: colors.textSecondary, marginTop: 2 },
            ]}
          >
            New
          </Text>
        </View>
        <View style={[cardBase, { flex: 1, alignItems: "center" }]}>
          <Text
            style={[typography.statValue, { color: colors.accent }]}
          >
            {selectedCount}
          </Text>
          <Text
            style={[
              typography.pillLabel,
              { color: colors.textSecondary, marginTop: 2 },
            ]}
          >
            Selected
          </Text>
        </View>
        <View style={[cardBase, { flex: 1, alignItems: "center" }]}>
          <Text
            style={[
              typography.statValue,
              { color: colors.textTertiary },
            ]}
          >
            {importedCount}
          </Text>
          <Text
            style={[
              typography.pillLabel,
              { color: colors.textSecondary, marginTop: 2 },
            ]}
          >
            Already In
          </Text>
        </View>
      </View>

      {/* Date Filter Chips */}
      {allResults.length > 0 && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
          >
            {DATE_FILTERS.map((f) => {
              const isActive = activeDaysFilter === f.days;
              return (
                <Pressable
                  key={f.label}
                  onPress={() => setActiveDaysFilter(f.days)}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 100,
                      backgroundColor: isActive
                        ? colors.accent
                        : colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: isActive ? colors.accent : colors.border,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: fonts.sansMedium,
                      fontSize: 12,
                      color: isActive ? "#fff" : colors.textSecondary,
                    }}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Payment Mode Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
          >
            {(
              [
                "all",
                "upi",
                "imps",
                "neft",
                "atm",
                "pos",
                "other",
              ] as PaymentModeFilter[]
            ).map((mode) => {
              const isActive = activePaymentMode === mode;
              const label = mode === "all" ? "All Modes" : mode.toUpperCase();
              return (
                <Pressable
                  key={mode}
                  onPress={() => setActivePaymentMode(mode)}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 100,
                      backgroundColor: isActive
                        ? colors.accent
                        : colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: isActive ? colors.accent : colors.border,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: fonts.sansMedium,
                      fontSize: 12,
                      color: isActive ? "#fff" : colors.textSecondary,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Hidden toggle */}
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              paddingTop: 4,
              paddingBottom: 4,
            }}
          >
            <Pressable
              onPress={() => setShowHidden((v) => !v)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 100,
                  backgroundColor: showHidden
                    ? colors.warning
                    : colors.surfaceAlt,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: fonts.sansMedium,
                  fontSize: 12,
                  color: showHidden ? "#fff" : colors.textPrimary,
                }}
              >
                {showHidden
                  ? `Showing Hidden (${hiddenCount})`
                  : `${hiddenCount} Hidden`}
              </Text>
            </Pressable>
            {showHidden && hiddenCount > 0 && (
              <Pressable
                onPress={unhideAll}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 100,
                    backgroundColor: colors.surfaceAlt,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: fonts.sansMedium,
                    fontSize: 12,
                    color: colors.expense,
                  }}
                >
                  Unhide All
                </Text>
              </Pressable>
            )}
          </View>

          {/* Sender Filter */}
          {senderStats.length > 1 && (
            <>
              <Pressable
                onPress={() => setShowSenderFilter((v) => !v)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.sansSemibold,
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                >
                  {showSenderFilter ? "▼" : "▶"} Filter by Sender
                  {activeSenders.size > 0
                    ? ` (${activeSenders.size} selected)`
                    : " (All)"}
                </Text>
                {activeSenders.size > 0 && (
                  <Pressable onPress={clearSenderFilter}>
                    <Text
                      style={{
                        fontFamily: fonts.sansSemibold,
                        fontSize: 12,
                        color: colors.accent,
                      }}
                    >
                      Clear
                    </Text>
                  </Pressable>
                )}
              </Pressable>
              {showSenderFilter && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
                >
                  {senderStats.map(({ sender, count }) => {
                    const isExplicit = activeSenders.has(sender);
                    return (
                      <Pressable
                        key={sender}
                        onPress={() => toggleSender(sender)}
                        style={({ pressed }) => [
                          {
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 100,
                            backgroundColor: isExplicit
                              ? colors.accent
                              : colors.surfaceAlt,
                            borderWidth: 1,
                            borderColor: isExplicit
                              ? colors.accent
                              : colors.border,
                            transform: [{ scale: pressed ? 0.97 : 1 }],
                          },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            fontFamily: fonts.sansMedium,
                            fontSize: 12,
                            color: isExplicit ? "#fff" : colors.textSecondary,
                            maxWidth: 120,
                          }}
                        >
                          {sender}
                        </Text>
                        <Text
                          style={{
                            fontFamily: fonts.sansBold,
                            fontSize: 11,
                            color: isExplicit ? "#fff" : colors.textTertiary,
                          }}
                        >
                          {count}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}

          {/* Select All / Deselect All */}
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              paddingTop: 4,
              paddingBottom: 4,
            }}
          >
            <Pressable
              onPress={selectAll}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 100,
                  backgroundColor: colors.surfaceAlt,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: fonts.sansMedium,
                  fontSize: 12,
                  color: colors.textPrimary,
                }}
              >
                Select All ({results.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={deselectAll}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 100,
                  backgroundColor: colors.surfaceAlt,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: fonts.sansMedium,
                  fontSize: 12,
                  color: colors.textPrimary,
                }}
              >
                Deselect All
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {results.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 32,
          }}
        >
          <Text
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                textAlign: "center",
                marginBottom: 16,
              },
            ]}
          >
            {allResults.length > 0
              ? "No transactions found for this date range."
              : "No bank transaction SMS found."}
          </Text>
          {allResults.length === 0 && (
            <Pressable
              onPress={startScan}
              style={({ pressed }) => [
                styles.primaryBtnBase,
                {
                  backgroundColor: colors.accent,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  color: "#fff",
                  fontFamily: fonts.sansSemibold,
                  fontSize: 15,
                }}
              >
                Scan Again
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          <FlatList
            data={results}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={{
              paddingBottom: navHeight + 80 + insets.bottom,
              paddingHorizontal: 24,
            }}
            renderItem={({ item, index }) => {
              const typeColor =
                item.type === "debit" ? colors.expense : colors.income;
              return (
                <Pressable
                  onPress={() =>
                    !item.alreadyImported && toggleSelect(index)
                  }
                  disabled={item.alreadyImported}
                  style={({ pressed }) => [
                    {
                      backgroundColor: item.selected
                        ? colors.accentLight
                        : colors.surface,
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: item.selected
                        ? colors.accent
                        : colors.border,
                      opacity: item.alreadyImported ? 0.55 : 1,
                      transform: [
                        {
                          scale:
                            pressed && !item.alreadyImported ? 0.97 : 1,
                        },
                      ],
                      position: "relative",
                    },
                  ]}
                >
                  {/* Already imported banner */}
                  {item.alreadyImported && (
                    <View
                      style={{
                        backgroundColor: colors.surfaceAlt,
                        borderRadius: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        alignSelf: "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.sansSemibold,
                          fontSize: 11,
                          color: colors.textSecondary,
                        }}
                      >
                        Already in Dashboard
                      </Text>
                    </View>
                  )}

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        backgroundColor:
                          item.type === "debit"
                            ? colors.expenseLight
                            : colors.incomeLight,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.sansSemibold,
                          fontSize: 11,
                          color: typeColor,
                        }}
                      >
                        {item.type === "debit" ? "EXPENSE" : "INCOME"}
                      </Text>
                    </View>
                    {item.paymentMode && (
                      <View
                        style={{
                          backgroundColor: colors.surfaceAlt,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.sansSemibold,
                            fontSize: 10,
                            color: colors.textSecondary,
                          }}
                        >
                          {item.paymentMode}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 12,
                        color: colors.textTertiary,
                      }}
                    >
                      {formatDate(item.date)}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontFamily: fonts.sansBold,
                      fontSize: 20,
                      color: item.alreadyImported
                        ? colors.textTertiary
                        : typeColor,
                      marginBottom: 4,
                    }}
                  >
                    {item.type === "debit" ? "-" : "+"}
                    {formatINR(item.amount)}
                  </Text>

                  {item.description && (
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 13,
                        color: colors.textSecondary,
                        marginBottom: 8,
                      }}
                    >
                      {item.description}
                    </Text>
                  )}

                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 8,
                      marginTop: 4,
                    }}
                  >
                    {item.upiRemark &&
                      item.upiRemark !== item.merchantName && (
                        <DetailChip
                          text={`"${item.upiRemark}"`}
                          colors={colors}
                        />
                      )}
                    {item.upiId && (
                      <DetailChip text={item.upiId} colors={colors} />
                    )}
                    {item.accountHint && (
                      <DetailChip
                        text={`A/c •••${item.accountHint}`}
                        colors={colors}
                      />
                    )}
                    {item.recipientAccount && (
                      <DetailChip
                        text={`To •••${item.recipientAccount}`}
                        colors={colors}
                      />
                    )}
                    {item.bankName && (
                      <DetailChip text={item.bankName} colors={colors} />
                    )}
                  </View>

                  {!item.alreadyImported && !item.hidden && (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <Pressable
                        onPress={() => openCategoryPicker(index)}
                        style={({ pressed }) => [
                          {
                            flex: 1,
                            flexDirection: "row",
                            justifyContent: "space-between",
                            backgroundColor: colors.surfaceAlt,
                            borderRadius: 100,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            transform: [{ scale: pressed ? 0.97 : 1 }],
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.sansMedium,
                            fontSize: 13,
                            color: colors.textPrimary,
                          }}
                        >
                          {getCategoryLabel(item.assignedCategory, item.type)}
                        </Text>
                        <Text
                          style={{
                            fontFamily: fonts.sansSemibold,
                            fontSize: 12,
                            color: colors.accent,
                          }}
                        >
                          Change
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => hideTransaction(index)}
                        style={({ pressed }) => [
                          {
                            backgroundColor: colors.surfaceAlt,
                            borderRadius: 100,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                            transform: [{ scale: pressed ? 0.97 : 1 }],
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.sansSemibold,
                            fontSize: 12,
                            color: colors.textTertiary,
                          }}
                        >
                          Hide
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {item.hidden && (
                    <View
                      style={{
                        backgroundColor: colors.surfaceAlt,
                        borderRadius: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        alignSelf: "flex-start",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.sans,
                          fontSize: 11,
                          color: colors.textTertiary,
                          fontStyle: "italic",
                        }}
                      >
                        Hidden — not a real transaction
                      </Text>
                    </View>
                  )}

                  {/* Selection indicator */}
                  {!item.alreadyImported && !item.hidden && (
                    <View
                      style={{
                        position: "absolute",
                        top: 14,
                        right: 14,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: item.selected
                          ? colors.accent
                          : colors.border,
                        backgroundColor: item.selected
                          ? colors.accent
                          : "transparent",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {item.selected && (
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 13,
                            fontFamily: fonts.sansBold,
                          }}
                        >
                          ✓
                        </Text>
                      )}
                    </View>
                  )}
                </Pressable>
              );
            }}
          />

          {/* Bottom Action Bar */}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: 16,
              paddingBottom: 16 + insets.bottom,
              paddingHorizontal: 24,
              backgroundColor: colors.bg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              flexDirection: "row",
              gap: 12,
            }}
          >
            <Pressable
              onPress={handleImport}
              disabled={selectedCount === 0 || importing}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: colors.accent,
                  borderRadius: 100,
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  alignItems: "center",
                  opacity:
                    selectedCount === 0 || importing ? 0.5 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: fonts.sansSemibold,
                    fontSize: 15,
                  }}
                >
                  Import {selectedCount} Transaction
                  {selectedCount !== 1 ? "s" : ""}
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}

      <PickerModal
        visible={categoryPickerVisible}
        title="Select Category"
        options={
          activeResultIdx >= 0 && results[activeResultIdx]?.type === "credit"
            ? INCOME_CATEGORIES.map((c) => ({
                label: c.label,
                value: c.value,
              }))
            : EXPENSE_CATEGORIES.map((c) => ({
                label: c.label,
                value: c.value,
              }))
        }
        selectedValue={
          activeResultIdx >= 0
            ? results[activeResultIdx]?.assignedCategory
            : ""
        }
        onSelect={handleCategorySelect}
        onClose={() => setCategoryPickerVisible(false)}
      />
    </View>
  );
}

function DetailChip({
  text,
  colors,
}: {
  text: string;
  colors: any;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fonts.sans,
          fontSize: 11,
          color: colors.textSecondary,
          maxWidth: 180,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryBtnBase: {
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
});
