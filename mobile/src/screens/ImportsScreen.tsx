import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageHeader } from "../components/PageHeader";
import { formatINR, TransactionCard } from "../components/komal";
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: navHeight + 40 + insets.bottom,
          paddingHorizontal: 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPendingCount();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <View style={{ marginHorizontal: -24 }}>
          <PageHeader title="Imports" eyebrow="Bank statements, SMS, CSV" />
        </View>

        {/* Privacy Notice */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.accentLight,
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 20 }}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                typography.caption,
                { color: colors.accent, fontFamily: fonts.sansSemibold },
              ]}
            >
              Your data stays private
            </Text>
            <Text
              style={[
                typography.captionRegular,
                { color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
              ]}
            >
              PDFs are parsed locally. Pending transactions stay on your device
              until you approve them.
            </Text>
          </View>
        </View>

        {/* Pending Badge */}
        {pendingCount > 0 && (
          <Pressable
            onPress={() => navigation.navigate("TransactionReview")}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
                marginRight: 12,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontFamily: fonts.sansBold,
                  fontSize: 16,
                }}
              >
                {pendingCount}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.body,
                  { color: colors.accent, fontFamily: fonts.sansSemibold },
                ]}
              >
                Pending Review
              </Text>
              <Text
                style={[
                  typography.captionRegular,
                  { color: colors.textSecondary, marginTop: 2 },
                ]}
              >
                {pendingCount} transaction{pendingCount !== 1 ? "s" : ""} waiting
                for your review (stored on device)
              </Text>
            </View>
            <Text
              style={{
                fontSize: 18,
                color: colors.accent,
                fontFamily: fonts.sansSemibold,
              }}
            >
              →
            </Text>
          </Pressable>
        )}

        {/* SMS Scan (Android only) */}
        {Platform.OS === "android" && (
          <Pressable
            onPress={() => navigation.navigate("SmsScan")}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text style={{ fontSize: 28, marginRight: 14 }}>📱</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.body,
                  {
                    color: colors.textPrimary,
                    fontFamily: fonts.sansSemibold,
                  },
                ]}
              >
                Scan SMS Messages
              </Text>
              <Text
                style={[
                  typography.captionRegular,
                  { color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
                ]}
              >
                Automatically detect bank transactions from your SMS inbox
              </Text>
            </View>
            <Text
              style={{
                fontSize: 18,
                color: colors.textTertiary,
                fontFamily: fonts.sansSemibold,
              }}
            >
              →
            </Text>
          </Pressable>
        )}

        {/* Upload Statement */}
        <Pressable
          onPress={handleUploadStatement}
          disabled={uploading}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: uploading ? 0.6 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          {uploading ? (
            <ActivityIndicator
              size="small"
              color={colors.accent}
              style={{ marginRight: 14 }}
            />
          ) : (
            <Text style={{ fontSize: 28, marginRight: 14 }}>📄</Text>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={[
                typography.body,
                { color: colors.textPrimary, fontFamily: fonts.sansSemibold },
              ]}
            >
              Upload Bank Statement
            </Text>
            <Text
              style={[
                typography.captionRegular,
                { color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
              ]}
            >
              Upload a PDF or CSV bank statement to import transactions
            </Text>
          </View>
          <Text
            style={{
              fontSize: 18,
              color: colors.textTertiary,
              fontFamily: fonts.sansSemibold,
            }}
          >
            →
          </Text>
        </Pressable>

        {/* Review Queue */}
        <Pressable
          onPress={() => navigation.navigate("TransactionReview")}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.border,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          <Text style={{ fontSize: 28, marginRight: 14 }}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                typography.body,
                { color: colors.textPrimary, fontFamily: fonts.sansSemibold },
              ]}
            >
              Review Queue
            </Text>
            <Text
              style={[
                typography.captionRegular,
                { color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
              ]}
            >
              Review, categorize, and approve imported transactions
            </Text>
          </View>
          <Text
            style={{
              fontSize: 18,
              color: colors.textTertiary,
              fontFamily: fonts.sansSemibold,
            }}
          >
            →
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
