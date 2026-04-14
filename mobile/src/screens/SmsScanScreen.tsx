import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
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
import { formatCurrency, formatDate } from "../lib/format";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "../lib/constants";
import { PickerModal } from "../components/PickerModal";
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

type PaymentModeFilter = "all" | "upi" | "imps" | "neft" | "atm" | "pos" | "other";

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
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [allResults, setAllResults] = useState<ScanResult[]>([]);
  const [activeDaysFilter, setActiveDaysFilter] = useState(90); // default: 3 months
  const [activeSenders, setActiveSenders] = useState<Set<string>>(new Set()); // empty = all
  const [activePaymentMode, setActivePaymentMode] = useState<PaymentModeFilter>("all");
  const [showSenderFilter, setShowSenderFilter] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  // null = checking, "granted" | "denied" | "never_ask_again"
  const [permissionState, setPermissionState] = useState<PermissionResult | null>(null);
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
        if (activePaymentMode === "other") return !mode || !["UPI", "IMPS", "NEFT", "ATM", "POS"].includes(mode);
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
  }, [allResults, activeDaysFilter, activeSenders, activePaymentMode, showHidden]);

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
      prev.map((r) => (r.rawText === item.rawText ? { ...r, hidden: true, selected: false } : r))
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
      // System won't show the dialog anymore — take user to app settings
      openAppSettings();
    }
  }

  function handleOpenSettings() {
    openAppSettings();
    // When user comes back from settings, re-check permission
    // We use a small delay since the app resumes before the toggle takes effect
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
      const bankMessages = messages.filter((m) => isBankSms(m.address, m.body));

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
            assignedCategory: result.type === "debit" ? "miscellaneous" : "other",
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
    // idx is relative to filtered `results` — find the actual item and toggle by date+amount
    const item = results[idx];
    if (!item) return;
    setAllResults((prev) =>
      prev.map((r) =>
        r.date === item.date && r.amount === item.amount && r.rawText === item.rawText
          ? { ...r, selected: !r.selected }
          : r
      )
    );
  }

  function selectAll() {
    const filteredKeys = new Set(results.map((r) => r.rawText));
    setAllResults((prev) =>
      prev.map((r) => (filteredKeys.has(r.rawText) ? { ...r, selected: true } : r))
    );
  }

  function deselectAll() {
    const filteredKeys = new Set(results.map((r) => r.rawText));
    setAllResults((prev) =>
      prev.map((r) => (filteredKeys.has(r.rawText) ? { ...r, selected: false } : r))
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
        const payee = r.description || r.merchantName || r.upiId?.split("@")[0] || "Unknown";
        const paymentMethod = r.paymentMode === "UPI" ? "upi"
          : r.paymentMode === "IMPS" || r.paymentMode === "NEFT" || r.paymentMode === "RTGS" ? "bank_transfer"
          : r.paymentMode === "ATM" ? "cash"
          : r.paymentMode === "POS" ? "debit_card"
          : "upi";

        if (r.type === "debit") {
          // Insert directly into expense_entries
          const { error } = await supabase
            .from("expense_entries")
            .insert({
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
          if (error) { errorCount++; } else { successCount++; }
        } else {
          // Insert directly into income_entries
          const { error } = await supabase
            .from("income_entries")
            .insert({
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
          if (error) { errorCount++; } else { successCount++; }
        }
      }

      if (successCount > 0) {
        Alert.alert(
          "Added to Dashboard",
          `${successCount} transaction${successCount !== 1 ? "s" : ""} added directly to your ${selected[0].type === "debit" ? "Expenses" : "Income"}.${errorCount > 0 ? `\n${errorCount} failed.` : ""}`,
          [
            {
              text: "View Expenses",
              onPress: () => navigation.navigate("Main", { screen: "Expenses" }),
            },
            { text: "OK" },
          ]
        );
        // Mark imported ones as already imported
        const importedTexts = new Set(selected.filter((_, i) => i < successCount).map((r) => r.rawText));
        setAllResults((prev) =>
          prev.map((r) =>
            importedTexts.has(r.rawText)
              ? { ...r, selected: false, alreadyImported: true }
              : r
          )
        );
      } else {
        Alert.alert("Error", "Failed to import transactions. Please try again.");
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
      <View style={styles.centered}>
        <Text style={styles.permTitle}>SMS Permission Required</Text>
        <Text style={styles.permDesc}>
          {isBlocked
            ? "SMS permission was previously denied. Please open Settings and enable SMS permission for KomalFin to scan your bank messages."
            : "KomalFin needs to read your SMS to find bank transaction messages. Your messages are parsed on-device and never sent to any server."}
        </Text>
        {isBlocked ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenSettings}>
            <Text style={styles.primaryBtnText}>Open Settings</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={requestAndScan}>
            <Text style={styles.primaryBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Scanning ──

  if (scanning || permissionState === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
        <Text style={styles.scanText}>Scanning SMS messages...</Text>
      </View>
    );
  }

  // ── Results ──

  return (
    <View style={styles.screen}>
      {/* Header Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{newCount}</Text>
          <Text style={styles.statLabel}>New</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: "#0d9488" }]}>
            {selectedCount}
          </Text>
          <Text style={styles.statLabel}>Selected</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: "#9ca3af" }]}>
            {importedCount}
          </Text>
          <Text style={styles.statLabel}>Already In</Text>
        </View>
      </View>

      {/* Date Filter Chips */}
      {allResults.length > 0 && (
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {DATE_FILTERS.map((f) => {
              const isActive = activeDaysFilter === f.days;
              return (
                <TouchableOpacity
                  key={f.label}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setActiveDaysFilter(f.days)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Payment Mode Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {(["all", "upi", "imps", "neft", "atm", "pos", "other"] as PaymentModeFilter[]).map((mode) => {
              const isActive = activePaymentMode === mode;
              const label = mode === "all" ? "All Modes" : mode.toUpperCase();
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setActivePaymentMode(mode)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Hidden toggle */}
          <View style={styles.selectionRow}>
            <TouchableOpacity
              style={[styles.selectionBtn, showHidden && { backgroundColor: "#fef3c7" }]}
              onPress={() => setShowHidden((v) => !v)}
            >
              <Text style={styles.selectionBtnText}>
                {showHidden ? `Showing Hidden (${hiddenCount})` : `${hiddenCount} Hidden`}
              </Text>
            </TouchableOpacity>
            {showHidden && hiddenCount > 0 && (
              <TouchableOpacity style={styles.selectionBtn} onPress={unhideAll}>
                <Text style={[styles.selectionBtnText, { color: "#dc2626" }]}>Unhide All</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Sender Filter */}
          {senderStats.length > 1 && (
            <>
              <TouchableOpacity
                style={styles.senderToggle}
                onPress={() => setShowSenderFilter((v) => !v)}
              >
                <Text style={styles.senderToggleText}>
                  {showSenderFilter ? "▼" : "▶"} Filter by Sender
                  {activeSenders.size > 0 ? ` (${activeSenders.size} selected)` : " (All)"}
                </Text>
                {activeSenders.size > 0 && (
                  <TouchableOpacity onPress={clearSenderFilter}>
                    <Text style={styles.clearFilterText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              {showSenderFilter && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  {senderStats.map(({ sender, count }) => {
                    const isExplicit = activeSenders.has(sender);
                    return (
                      <TouchableOpacity
                        key={sender}
                        style={[
                          styles.senderChip,
                          isExplicit && styles.senderChipActive,
                        ]}
                        onPress={() => toggleSender(sender)}
                      >
                        <Text
                          style={[
                            styles.senderChipText,
                            isExplicit && styles.senderChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {sender}
                        </Text>
                        <Text
                          style={[
                            styles.senderChipCount,
                            isExplicit && styles.senderChipTextActive,
                          ]}
                        >
                          {count}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}

          {/* Select All / Deselect All */}
          <View style={styles.selectionRow}>
            <TouchableOpacity style={styles.selectionBtn} onPress={selectAll}>
              <Text style={styles.selectionBtnText}>Select All ({results.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.selectionBtn} onPress={deselectAll}>
              <Text style={styles.selectionBtnText}>Deselect All</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {results.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {allResults.length > 0
              ? "No transactions found for this date range."
              : "No bank transaction SMS found."}
          </Text>
          {allResults.length === 0 && (
            <TouchableOpacity style={styles.primaryBtn} onPress={startScan}>
              <Text style={styles.primaryBtnText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <FlatList
            data={results}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.txnCard,
                  item.selected && styles.txnCardSelected,
                  item.alreadyImported && styles.txnCardImported,
                ]}
                onPress={() => !item.alreadyImported && toggleSelect(index)}
                activeOpacity={item.alreadyImported ? 1 : 0.7}
              >
                {/* Already imported banner */}
                {item.alreadyImported && (
                  <View style={styles.importedBanner}>
                    <Text style={styles.importedBannerText}>Already in Dashboard</Text>
                  </View>
                )}

                <View style={styles.txnHeader}>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          item.type === "debit" ? "#fee2e2" : "#dcfce7",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: item.type === "debit" ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {item.type === "debit" ? "EXPENSE" : "INCOME"}
                    </Text>
                  </View>
                  {item.paymentMode && (
                    <View style={styles.modeBadge}>
                      <Text style={styles.modeBadgeText}>{item.paymentMode}</Text>
                    </View>
                  )}
                  <Text style={styles.txnDate}>{formatDate(item.date)}</Text>
                </View>

                <Text
                  style={[
                    styles.txnAmount,
                    { color: item.alreadyImported ? "#9ca3af" : item.type === "debit" ? "#dc2626" : "#16a34a" },
                  ]}
                >
                  {item.type === "debit" ? "-" : "+"}
                  {formatCurrency(item.amount)}
                </Text>

                {/* Merchant / Description */}
                {item.description && (
                  <Text style={styles.txnDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}

                {/* Extra details row */}
                <View style={styles.detailsRow}>
                  {item.upiRemark && item.upiRemark !== item.merchantName && (
                    <View style={styles.detailChip}>
                      <Text style={styles.detailChipText} numberOfLines={1}>
                        "{item.upiRemark}"
                      </Text>
                    </View>
                  )}
                  {item.upiId && (
                    <View style={styles.detailChip}>
                      <Text style={styles.detailChipText} numberOfLines={1}>
                        {item.upiId}
                      </Text>
                    </View>
                  )}
                  {item.accountHint && (
                    <View style={styles.detailChip}>
                      <Text style={styles.detailChipText}>A/c •••{item.accountHint}</Text>
                    </View>
                  )}
                  {item.recipientAccount && (
                    <View style={styles.detailChip}>
                      <Text style={styles.detailChipText}>To •••{item.recipientAccount}</Text>
                    </View>
                  )}
                  {item.bankName && (
                    <View style={styles.detailChip}>
                      <Text style={styles.detailChipText}>{item.bankName}</Text>
                    </View>
                  )}
                </View>

                {!item.alreadyImported && !item.hidden && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.categoryBtn, { flex: 1 }]}
                      onPress={() => openCategoryPicker(index)}
                    >
                      <Text style={styles.categoryBtnText}>
                        {getCategoryLabel(item.assignedCategory, item.type)}
                      </Text>
                      <Text style={styles.categoryBtnArrow}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.hideBtn}
                      onPress={() => hideTransaction(index)}
                    >
                      <Text style={styles.hideBtnText}>Hide</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Hidden label */}
                {item.hidden && (
                  <View style={styles.hiddenLabel}>
                    <Text style={styles.hiddenLabelText}>Hidden — not a real transaction</Text>
                  </View>
                )}

                {/* Selection indicator */}
                {!item.alreadyImported && !item.hidden && (
                  <View
                    style={[
                      styles.checkbox,
                      item.selected && styles.checkboxChecked,
                    ]}
                  >
                    {item.selected && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            )}
          />

          {/* Bottom Action Bar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { flex: 1 },
                (selectedCount === 0 || importing) && styles.btnDisabled,
              ]}
              onPress={handleImport}
              disabled={selectedCount === 0 || importing}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  Import {selectedCount} Transaction{selectedCount !== 1 ? "s" : ""}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      <PickerModal
        visible={categoryPickerVisible}
        title="Select Category"
        options={
          activeResultIdx >= 0 && results[activeResultIdx]?.type === "credit"
            ? INCOME_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))
            : EXPENSE_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#fff",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    paddingBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 24, fontWeight: "700", color: "#1f2937" },
  statLabel: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  filterChipActive: {
    backgroundColor: "#0d9488",
    borderColor: "#0d9488",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  senderToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  senderToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0d9488",
  },
  senderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  senderChipActive: {
    backgroundColor: "#0d9488",
    borderColor: "#0d9488",
  },
  senderChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6b7280",
    maxWidth: 120,
  },
  senderChipTextActive: {
    color: "#fff",
  },
  senderChipCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
  },
  selectionRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 4,
    paddingBottom: 4,
  },
  selectionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  selectionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  listContent: { padding: 16, paddingBottom: 100 },
  txnCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
  },
  txnCardSelected: {
    borderColor: "#0d9488",
    backgroundColor: "#f0fdfa",
  },
  txnCardImported: {
    opacity: 0.55,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  importedBanner: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  importedBannerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  modeBadge: {
    backgroundColor: "#ede9fe",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#7c3aed",
  },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
    marginTop: 4,
  },
  detailChip: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  detailChipText: {
    fontSize: 11,
    color: "#4b5563",
    maxWidth: 180,
  },
  txnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  txnDate: { fontSize: 12, color: "#6b7280" },
  txnAmount: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  txnDesc: { fontSize: 13, color: "#4b5563", marginBottom: 8 },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  hideBtn: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  hideBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
  },
  hiddenLabel: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  hiddenLabelText: {
    fontSize: 11,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  categoryBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryBtnText: { fontSize: 13, fontWeight: "500", color: "#374151" },
  categoryBtnArrow: { fontSize: 12, color: "#0d9488", fontWeight: "600" },
  checkbox: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#0d9488",
    borderColor: "#0d9488",
  },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: "#0d9488",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryBtnText: { color: "#6b7280", fontSize: 15, fontWeight: "500" },
  btnDisabled: { opacity: 0.5 },
  permTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
    textAlign: "center",
  },
  permDesc: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  scanText: { fontSize: 14, color: "#6b7280", marginTop: 16 },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 16,
  },
});
