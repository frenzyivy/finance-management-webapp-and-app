import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/AppNavigator";

export function AddCreditCardScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "AddCreditCard">>();
  const existingCard = route.params?.card;
  const isEditing = !!existingCard;

  const [cardName, setCardName] = useState(existingCard?.card_name ?? "");
  const [lastFour, setLastFour] = useState(existingCard?.last_four_digits ?? "");
  const [billingDay, setBillingDay] = useState(
    existingCard ? String(existingCard.billing_cycle_day) : ""
  );
  const [creditLimit, setCreditLimit] = useState(
    existingCard?.credit_limit != null ? String(existingCard.credit_limit) : ""
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!cardName.trim()) {
      Alert.alert("Required", "Please enter a card name");
      return;
    }
    if (lastFour && !/^\d{4}$/.test(lastFour)) {
      Alert.alert("Invalid", "Last 4 digits must be exactly 4 numbers");
      return;
    }
    const day = parseInt(billingDay, 10);
    if (!day || day < 1 || day > 31) {
      Alert.alert("Invalid", "Billing day must be between 1 and 31");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        card_name: cardName.trim(),
        last_four_digits: lastFour || null,
        billing_cycle_day: day,
        credit_limit: creditLimit ? parseFloat(creditLimit) : null,
      };

      const { error } = isEditing
        ? await supabase.from("credit_cards").update(payload).eq("id", existingCard!.id)
        : await supabase.from("credit_cards").insert({ ...payload, user_id: user.id });

      if (error) throw error;
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save card");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Card Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. HDFC Regalia"
        value={cardName}
        onChangeText={setCardName}
      />

      <Text style={styles.label}>Last 4 Digits</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 1234"
        keyboardType="numeric"
        maxLength={4}
        value={lastFour}
        onChangeText={setLastFour}
      />

      <Text style={styles.label}>Billing Cycle Day *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 15"
        keyboardType="numeric"
        maxLength={2}
        value={billingDay}
        onChangeText={setBillingDay}
      />

      <Text style={styles.label}>Credit Limit (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 200000"
        keyboardType="numeric"
        value={creditLimit}
        onChangeText={setCreditLimit}
      />

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>
            {isEditing ? "Update Card" : "Save Card"}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, paddingBottom: 40 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#1f2937",
  },
  saveBtn: {
    backgroundColor: "#0d9488",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
