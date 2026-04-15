import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { formatDate } from "../lib/format";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageHeader } from "../components/PageHeader";
import { formatINR, TransactionCard } from "../components/komal";
import type { PersonalBusinessTransfer } from "../types/business";

export function TransfersScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<PersonalBusinessTransfer[]>([]);
  const [personalToBusiness, setPersonalToBusiness] = useState(0);
  const [businessToPersonal, setBusinessToPersonal] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("personal_business_transfers")
        .select("*")
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      const items = (data ?? []) as PersonalBusinessTransfer[];
      setEntries(items);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const thisMonth = items.filter((e) => e.date >= monthStart);
      setPersonalToBusiness(
        thisMonth
          .filter((e) => e.direction === "personal_to_business")
          .reduce((s, e) => s + e.amount, 0)
      );
      setBusinessToPersonal(
        thisMonth
          .filter((e) => e.direction === "business_to_personal")
          .reduce((s, e) => s + e.amount, 0)
      );
    } catch (err) {
      console.error("Transfers fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, syncVersion]);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => fetchData());
    return unsub;
  }, [navigation, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleLongPress = (t: PersonalBusinessTransfer) => {
    Alert.alert(
      t.reason,
      `${formatINR(t.amount)} • ${formatDate(t.date)}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("personal_business_transfers")
                .delete()
                .eq("id", t.id);
              if (error) throw error;
              fetchData();
            } catch (err: any) {
              Alert.alert("Error", err.message ?? "Failed to delete");
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: PersonalBusinessTransfer }) => {
    const isP2B = item.direction === "personal_to_business";
    const tone = isP2B ? colors.expense : colors.income;
    return (
      <Pressable
        onLongPress={() => handleLongPress(item)}
        style={({ pressed }) => [
          styles.entryRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: isP2B ? colors.expenseLight : colors.incomeLight,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 18,
              fontFamily: fonts.sansBold,
              color: tone,
            }}
          >
            {isP2B ? "→" : "←"}
          </Text>
        </View>
        <View style={styles.entryLeft}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.sansSemibold,
              fontSize: 14,
              color: colors.textPrimary,
              marginBottom: 2,
            }}
          >
            {item.reason}
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 11,
              color: colors.textTertiary,
            }}
          >
            {formatDate(item.date)} •{" "}
            {isP2B ? "Personal → Business" : "Business → Personal"}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: fonts.sansSemibold,
            fontSize: 15,
            color: tone,
          }}
        >
          {formatINR(item.amount)}
        </Text>
      </Pressable>
    );
  };

  const netFlow = businessToPersonal - personalToBusiness;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageHeader
        title="Transfers"
        actions={
          <Pressable
            onPress={() => navigation.navigate("AddTransfer")}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
          >
            <Svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.textPrimary}
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </Pressable>
        }
      />

      {/* Summary Bar */}
      <View
        style={{
          marginHorizontal: 24,
          marginBottom: 16,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 12,
          padding: 14,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <View style={styles.summaryCol}>
          <Text
            style={[
              typography.pillLabel,
              { color: colors.textSecondary },
            ]}
          >
            To Business
          </Text>
          <Text
            style={{
              fontFamily: fonts.sansSemibold,
              fontSize: 15,
              color: colors.expense,
              marginTop: 4,
            }}
          >
            {formatINR(personalToBusiness)}
          </Text>
        </View>
        <View style={styles.summaryCol}>
          <Text
            style={[
              typography.pillLabel,
              { color: colors.textSecondary },
            ]}
          >
            To Personal
          </Text>
          <Text
            style={{
              fontFamily: fonts.sansSemibold,
              fontSize: 15,
              color: colors.income,
              marginTop: 4,
            }}
          >
            {formatINR(businessToPersonal)}
          </Text>
        </View>
        <View style={styles.summaryCol}>
          <Text
            style={[
              typography.pillLabel,
              { color: colors.textSecondary },
            ]}
          >
            Net
          </Text>
          <Text
            style={{
              fontFamily: fonts.sansSemibold,
              fontSize: 15,
              color: netFlow >= 0 ? colors.income : colors.expense,
              marginTop: 4,
            }}
          >
            {netFlow >= 0 ? "+" : ""}
            {formatINR(netFlow)}
          </Text>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingBottom: navHeight + 40 + insets.bottom,
          paddingHorizontal: 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              No transfers yet.
            </Text>
            <Text
              style={[
                typography.captionRegular,
                { color: colors.textTertiary, textAlign: "center" },
              ]}
            >
              Tap + to log a transfer between personal and business.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCol: { flex: 1, alignItems: "center" },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  entryLeft: { flex: 1, marginRight: 8 },
  emptyState: { alignItems: "center", paddingVertical: 48 },
});
