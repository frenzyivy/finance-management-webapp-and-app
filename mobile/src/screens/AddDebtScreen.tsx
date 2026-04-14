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
import { useRoute, RouteProp } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { DebtType, PriorityLevel } from "../types/database";
import { PickerModal } from "../components/PickerModal";
import { DEBT_TYPES } from "../lib/constants";
import type { RootStackParamList } from "../navigation/AppNavigator";

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function AddDebtScreen({ navigation }: any) {
  const route = useRoute<RouteProp<RootStackParamList, "AddDebt">>();
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Debt Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. HDFC Credit Card"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Type</Text>
      <TouchableOpacity
        style={styles.pickerBtn}
        onPress={() => setTypePickerVisible(true)}
      >
        <Text style={styles.pickerBtnText}>
          {DEBT_TYPES.find((d) => d.value === type)?.label || "Select"}
        </Text>
      </TouchableOpacity>

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

      <Text style={styles.label}>Creditor / Lender Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. HDFC Bank"
        value={lender}
        onChangeText={setLender}
      />

      <Text style={styles.label}>Original Amount *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 50000"
        keyboardType="numeric"
        value={principalAmount}
        onChangeText={setPrincipalAmount}
      />

      <Text style={styles.label}>Outstanding Balance *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 35000"
        keyboardType="numeric"
        value={currentBalance}
        onChangeText={setCurrentBalance}
      />

      <Text style={styles.label}>Interest Rate % (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 18"
        keyboardType="numeric"
        value={interestRate}
        onChangeText={setInterestRate}
      />

      <Text style={styles.label}>EMI / Minimum Payment (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 2000"
        keyboardType="numeric"
        value={minimumPayment}
        onChangeText={setMinimumPayment}
      />

      <Text style={styles.label}>Due Date (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={dueDate}
        onChangeText={setDueDate}
      />

      <Text style={styles.label}>Priority</Text>
      <TouchableOpacity
        style={styles.pickerBtn}
        onPress={() => setPriorityPickerVisible(true)}
      >
        <Text style={styles.pickerBtnText}>
          {PRIORITY_OPTIONS.find((p) => p.value === priority)?.label || "Select"}
        </Text>
      </TouchableOpacity>

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

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, { height: 80, textAlignVertical: "top" }]}
        placeholder="Any additional details..."
        multiline
        value={notes}
        onChangeText={setNotes}
      />

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>{isEditing ? "Update Debt" : "Save Debt"}</Text>
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
  pickerBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
  },
  pickerBtnText: { fontSize: 16, color: "#1f2937" },
  saveBtn: {
    backgroundColor: "#0d9488",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
