import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import type {
  LocalParsedTransaction,
  ParsedStatementResponse,
} from "../types/database";

const LOCAL_STAGING_KEY = "komalfin_pending_imports";

async function loadLocalStaging(): Promise<LocalParsedTransaction[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_STAGING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLocalStaging(items: LocalParsedTransaction[]) {
  await AsyncStorage.setItem(LOCAL_STAGING_KEY, JSON.stringify(items));
}

export function ImportsScreen({ navigation }: { navigation: any }) {
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchPendingCount = useCallback(async () => {
    try {
      const items = await loadLocalStaging();
      const count = items.filter((t) => !t.is_duplicate).length;
      setPendingCount(count);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount, syncVersion]);

  // Refresh when navigating back from review screen
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      fetchPendingCount();
    });
    return unsubscribe;
  }, [navigation, fetchPendingCount]);

  async function handleUploadStatement() {
    try {
      const DocumentPicker = require("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/csv", "text/comma-separated-values"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file) return;

      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert("Error", "File too large (max 10MB)");
        return;
      }

      setUploading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "Not authenticated");
        setUploading(false);
        return;
      }

      const apiUrl =
        process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      } as any);

      const res = await fetch(`${apiUrl}/api/imports/upload-statement`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const resp: ParsedStatementResponse = await res.json();

        // Store parsed transactions locally (never sent to cloud)
        const newItems: LocalParsedTransaction[] = resp.transactions.map(
          (t, i) => ({
            local_id: `${resp.batch_id}-${i}`,
            amount: t.amount,
            transaction_type: t.transaction_type,
            date: t.date,
            description: t.description,
            reference: t.reference,
            dedup_hash: t.dedup_hash,
            is_duplicate: t.is_duplicate,
            import_source: resp.source,
            import_batch_id: resp.batch_id,
          })
        );

        const existing = await loadLocalStaging();
        await saveLocalStaging([...newItems, ...existing]);

        const pending = resp.total_count - resp.duplicate_count;
        setPendingCount((c) => c + pending);

        Alert.alert(
          "Success",
          `Parsed ${resp.total_count} transactions (${pending} new).\nYour data stays on this device until you approve it.`,
          [
            {
              text: "Review Now",
              onPress: () => navigation.navigate("TransactionReview"),
            },
            { text: "OK" },
          ]
        );
      } else {
        const errText = await res.text();
        Alert.alert("Error", `Failed to parse statement: ${errText}`);
      }
    } catch (err: any) {
      if (err?.message?.includes("expo-document-picker")) {
        Alert.alert(
          "Not Available",
          "Document picker is not installed. Please install expo-document-picker."
        );
      } else {
        Alert.alert("Error", "Failed to upload statement");
      }
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchPendingCount();
          }}
          tintColor="#0d9488"
        />
      }
    >
      <Text style={styles.title}>Import Transactions</Text>
      <Text style={styles.subtitle}>
        Import transactions from SMS or bank statements
      </Text>

      {/* Privacy Notice */}
      <View style={styles.privacyBanner}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.privacyTitle}>Your data stays private</Text>
          <Text style={styles.privacyDesc}>
            PDFs are parsed locally. Pending transactions stay on your device
            until you approve them.
          </Text>
        </View>
      </View>

      {/* Pending Badge */}
      {pendingCount > 0 && (
        <TouchableOpacity
          style={styles.pendingBanner}
          onPress={() => navigation.navigate("TransactionReview")}
        >
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingTitle}>Pending Review</Text>
            <Text style={styles.pendingDesc}>
              {pendingCount} transaction{pendingCount !== 1 ? "s" : ""} waiting
              for your review (stored on device)
            </Text>
          </View>
          <Text style={styles.pendingArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* SMS Scan (Android only) */}
      {Platform.OS === "android" && (
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("SmsScan")}
        >
          <Text style={styles.actionIcon}>📱</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Scan SMS Messages</Text>
            <Text style={styles.actionDesc}>
              Automatically detect bank transactions from your SMS inbox
            </Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Upload Statement */}
      <TouchableOpacity
        style={[styles.actionCard, uploading && styles.actionCardDisabled]}
        onPress={handleUploadStatement}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator
            size="small"
            color="#0d9488"
            style={{ marginRight: 12 }}
          />
        ) : (
          <Text style={styles.actionIcon}>📄</Text>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Upload Bank Statement</Text>
          <Text style={styles.actionDesc}>
            Upload a PDF or CSV bank statement to import transactions
          </Text>
        </View>
        <Text style={styles.actionArrow}>→</Text>
      </TouchableOpacity>

      {/* Review Queue */}
      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate("TransactionReview")}
      >
        <Text style={styles.actionIcon}>✅</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Review Queue</Text>
          <Text style={styles.actionDesc}>
            Review, categorize, and approve imported transactions
          </Text>
        </View>
        <Text style={styles.actionArrow}>→</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 32 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: { fontSize: 24, fontWeight: "700", color: "#1f2937", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 16 },
  privacyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    gap: 10,
  },
  privacyIcon: { fontSize: 20 },
  privacyTitle: { fontSize: 13, fontWeight: "600", color: "#166534" },
  privacyDesc: { fontSize: 12, color: "#4ade80", marginTop: 2, lineHeight: 17 },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdfa",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#99f6e4",
  },
  pendingBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0d9488",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  pendingBadgeText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  pendingTitle: { fontSize: 15, fontWeight: "600", color: "#0d9488" },
  pendingDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  pendingArrow: { fontSize: 18, color: "#0d9488", fontWeight: "600" },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  actionCardDisabled: { opacity: 0.6 },
  actionIcon: { fontSize: 28, marginRight: 14 },
  actionTitle: { fontSize: 15, fontWeight: "600", color: "#1f2937" },
  actionDesc: { fontSize: 12, color: "#6b7280", marginTop: 3, lineHeight: 17 },
  actionArrow: { fontSize: 18, color: "#9ca3af", fontWeight: "600" },
});
