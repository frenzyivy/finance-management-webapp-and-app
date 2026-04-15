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
import { DebtType, PriorityLevel } from "../types/database";
import { PickerModal } from "../components/PickerModal";
import { PageHeader } from "../components/PageHeader";
import { DEBT_TYPES } from "../lib/constants";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii } from "../lib/radii";
import { formatINR } from "../components/komal";
import type { RootStackParamList } from "../navigation/AppNavigator";

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function AddDebtScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, "AddDebt">>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const existingDebt = route.params?.debt;
  const isEditing = !!existingDebt;

  const [name, setName] = useState(existingDebt?.name ?? "");
  const [type, setType] = useState<DebtType>(existingDebt?.type ?? "credit_card");
  const [lender, setLender] = useState(existingDebt?.creditor_name ?? "");
  const [principalAmount, setPrincipalAmount] = useState(existingDebt ? String(existingDebt.original_amount) : "");
  const [currentBalance, setCurrentBalance] = useState(existingDebt ? String(existingDebt.outstanding_balance) : "");
  const [interestRate, setInterestRate] = useState(existingDebt?.interest_rate != null ? String(existingDebt.interest_rate) : "");
  const [minimumPayment, setMinimumPayment] = useState(existingDebt?.emi_amount != null ? String(existingDebt.emi_amount) : "");
  const [dueDate, setDueDate] = useState(existingDebt?.expected_payoff_date ?? "");
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [priorityPickerVisible, setPriorityPickerVisible] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a debt name");
      return;
    }
    const principal = parseFloat(principalAmount);
    if (!principal || principal <= 0) {
      Alert.alert("Required", "Please enter a valid principal amount");
      return;
    }
    const balance = parseFloat(currentBalance);
    if (isNaN(balance) || balance < 0) {
      Alert.alert("Required", "Please enter a valid outstanding balance");
      return;
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert("Invalid Date", "Please use YYYY-MM-DD format");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const interest = interestRate ? parseFloat(interestRate) : null;
      const minPay = minimumPayment ? parseFloat(minimumPayment) : null;

      const payload = {
        name: name.trim(),
        type,
        creditor_name: lender.trim() || name.trim(),
        original_amount: principal,
        outstanding_balance: balance,
        interest_rate: interest,
        emi_amount: minPay,
        expected_payoff_date: dueDate || null,
        status: balance <= 0 ? "paid_off" : "active" as const,
      };

      const { error } = isEditing
        ? await supabase.from("debts").update(payload).eq("id", existingDebt!.id)
        : await supabase.from("debts").insert({ ...payload, user_id: user.id, start_date: new Date().toISOString().split("T")[0] });

      if (error) throw error;
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save debt");
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

  const outstanding = parseFloat(currentBalance);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageHeader
        title={isEditing ? "Edit Debt" : "Add Debt"}
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
        <Text style={labelStyle}>Debt Name *</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. HDFC Credit Card"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
        />

        <Text style={labelStyle}>Type</Text>
        <Pressable
          onPress={() => setTypePickerVisible(true)}
          style={({ pressed }) => [
            inputStyle,
            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 14 }}>
            {DEBT_TYPES.find((d) => d.value === type)?.label || "Select"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>▼</Text>
        </Pressable>

        <PickerModal
          visible={typePickerVisible}
          onClose={() => setTypePickerVisible(false)}
          options={DEBT_TYPES}
          selectedValue={type}
          onSelect={(val) => {
            setType(val as DebtType);
            setTypePickerVisible(false);
          }}
        />

        <Text style={labelStyle}>Creditor / Lender Name</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. HDFC Bank"
          placeholderTextColor={colors.textTertiary}
          value={lender}
          onChangeText={setLender}
        />

        <Text style={labelStyle}>Original Amount *</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. 50000"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          value={principalAmount}
          onChangeText={setPrincipalAmount}
        />

        <Text style={labelStyle}>Outstanding Balance *</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. 35000"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          value={currentBalance}
          onChangeText={setCurrentBalance}
        />
        {!isNaN(outstanding) && outstanding > 0 && (
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
            {formatINR(outstanding)}
          </Text>
        )}

        <Text style={labelStyle}>Interest Rate % (optional)</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. 18"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          value={interestRate}
          onChangeText={setInterestRate}
        />

        <Text style={labelStyle}>EMI / Minimum Payment (optional)</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. 2000"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          value={minimumPayment}
          onChangeText={setMinimumPayment}
        />

        <Text style={labelStyle}>Due Date (optional)</Text>
        <TextInput
          style={inputStyle}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
          value={dueDate}
          onChangeText={setDueDate}
        />

        <Text style={labelStyle}>Priority</Text>
        <Pressable
          onPress={() => setPriorityPickerVisible(true)}
          style={({ pressed }) => [
            inputStyle,
            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 14 }}>
            {PRIORITY_OPTIONS.find((p) => p.value === priority)?.label || "Select"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>▼</Text>
        </Pressable>

        <PickerModal
          visible={priorityPickerVisible}
          onClose={() => setPriorityPickerVisible(false)}
          options={PRIORITY_OPTIONS}
          selectedValue={priority}
          onSelect={(val) => {
            setPriority(val as PriorityLevel);
            setPriorityPickerVisible(false);
          }}
        />

        <Text style={labelStyle}>Notes (optional)</Text>
        <TextInput
          style={[inputStyle, { height: 80, textAlignVertical: "top" }]}
          placeholder="Any additional details..."
          placeholderTextColor={colors.textTertiary}
          multiline
          value={notes}
          onChangeText={setNotes}
        />

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
              {isEditing ? "Update Debt" : "Save Debt"}
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
