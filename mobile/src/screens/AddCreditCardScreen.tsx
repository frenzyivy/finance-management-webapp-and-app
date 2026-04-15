import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { PageHeader } from "../components/PageHeader";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii } from "../lib/radii";
import { formatINR } from "../components/komal";
import type { RootStackParamList } from "../navigation/AppNavigator";

export function AddCreditCardScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "AddCreditCard">>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

  const inputStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
  } as const;

  const labelStyle = [typography.pillLabel, { color: colors.textTertiary, marginBottom: 6, marginTop: 16 }];

  const previewLimit = parseFloat(creditLimit);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageHeader
        title={isEditing ? "Edit Card" : "Add Card"}
        actions={
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={1.8} strokeLinecap="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </Pressable>
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom, paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={labelStyle}>Card Name *</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. HDFC Regalia"
          placeholderTextColor={colors.textTertiary}
          value={cardName}
          onChangeText={setCardName}
        />

        <Text style={labelStyle}>Last 4 Digits</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. 1234"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          maxLength={4}
          value={lastFour}
          onChangeText={setLastFour}
        />

        <Text style={labelStyle}>Billing Cycle Day *</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. 15"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          maxLength={2}
          value={billingDay}
          onChangeText={setBillingDay}
        />

        <Text style={labelStyle}>Credit Limit (optional)</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. 200000"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          value={creditLimit}
          onChangeText={setCreditLimit}
        />
        {!isNaN(previewLimit) && previewLimit > 0 && (
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
            {formatINR(previewLimit)}
          </Text>
        )}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: colors.accent,
              opacity: saving ? 0.6 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.saveBtnText, { fontFamily: fonts.sansSemibold }]}>
              {isEditing ? "Update Card" : "Save Card"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
