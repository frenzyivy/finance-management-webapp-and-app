import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import type { CreditCard } from "../types/database";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import { formatINR } from "../components/komal";

export function CreditCardsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cards, setCards] = useState<CreditCard[]>([]);

  const fetchCards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCards(data ?? []);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load cards");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards, syncVersion]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", fetchCards);
    return unsubscribe;
  }, [navigation, fetchCards]);

  const handleDelete = (card: CreditCard) => {
    Alert.alert("Delete Card", `Delete "${card.card_name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("credit_cards").delete().eq("id", card.id);
            if (error) throw error;
            fetchCards();
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to delete card");
          }
        },
      },
    ]);
  };

  const renderCard = ({ item }: { item: CreditCard }) => (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[typography.sectionTitle, { color: colors.textPrimary }]}>
          {item.card_name}
        </Text>
        {item.last_four_digits && (
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, fontFamily: "monospace" },
            ]}
          >
            **** {item.last_four_digits}
          </Text>
        )}
      </View>
      <View style={styles.cardDetails}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Billing Day: {item.billing_cycle_day}
        </Text>
        {item.credit_limit != null && (
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Limit: {formatINR(item.credit_limit)}
          </Text>
        )}
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
          onPress={() => navigation.navigate("AddCreditCard", { card: item })}
        >
          <Text style={[typography.caption, { color: colors.textPrimary }]}>Edit</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: colors.expenseLight,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
          onPress={() => handleDelete(item)}
        >
          <Text style={[typography.caption, { color: colors.expense }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: navHeight + 40 + insets.bottom,
        }}
        ListHeaderComponent={
          <PageHeader
            title="Credit Cards"
            actions={
              <Pressable
                onPress={() => navigation.navigate("AddCreditCard")}
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
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>💳</Text>
            <Text style={[typography.sectionTitle, { color: colors.textPrimary }]}>
              No Credit Cards
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: 4 },
              ]}
            >
              Add a card to track spending
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchCards();
            }}
            tintColor={colors.accent}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardDetails: { gap: 4, marginBottom: 10 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  empty: { alignItems: "center", paddingTop: 60 },
});
