import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { formatCurrency } from "../lib/format";
import type { CreditCard } from "../types/database";

export function CreditCardsScreen() {
  const navigation = useNavigation<any>();
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
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{item.card_name}</Text>
        {item.last_four_digits && (
          <Text style={styles.lastFour}>**** {item.last_four_digits}</Text>
        )}
      </View>
      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>Billing Day: {item.billing_cycle_day}</Text>
        {item.credit_limit != null && (
          <Text style={styles.detailText}>
            Limit: {formatCurrency(item.credit_limit)}
          </Text>
        )}
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#3b82f6" }]}
          onPress={() => navigation.navigate("AddCreditCard", { card: item })}
        >
          <Text style={styles.actionBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#f87171" }]}
          onPress={() => handleDelete(item)}
        >
          <Text style={styles.actionBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={cards.length === 0 ? styles.centered : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>No Credit Cards</Text>
            <Text style={styles.emptySubtitle}>Add a card to track spending</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCards(); }} colors={["#0d9488"]} />
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddCreditCard")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardName: { fontSize: 16, fontWeight: "bold", color: "#1f2937" },
  lastFour: { fontSize: 14, color: "#6b7280", fontFamily: "monospace" },
  cardDetails: { gap: 4, marginBottom: 8 },
  detailText: { fontSize: 13, color: "#6b7280" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#1f2937" },
  emptySubtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0d9488",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 30 },
});
