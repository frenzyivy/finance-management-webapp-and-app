import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import { formatCurrency } from "../lib/format";
import type {
  BusinessExpense,
  BusinessIncome,
  TransferDirection,
} from "../types/business";

const DIRECTION_OPTIONS = [
  { value: "personal_to_business", label: "Personal → Business" },
  { value: "business_to_personal", label: "Business → Personal" },
];

export function AddTransferScreen() {
  const navigation = useNavigation();
  const [saving, setSaving] = useState(false);

  const [direction, setDirection] = useState<TransferDirection>("personal_to_business");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [linkedExpenseId, setLinkedExpenseId] = useState<string | null>(null);
  const [linkedIncomeId, setLinkedIncomeId] = useState<string | null>(null);

  const [businessExpenses, setBusinessExpenses] = useState<BusinessExpense[]>([]);
  const [businessIncome, setBusinessIncome] = useState<BusinessIncome[]>([]);

  const [showDirectionPicker, setShowDirectionPicker] = useState(false);
  const [showExpensePicker, setShowExpensePicker] = useState(false);
  const [showIncomePicker, setShowIncomePicker] = useState(false);

  useEffect(() => {
    async function fetchRelated() {
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60)
        .toISOString()
        .split("T")[0];
      const [expRes, incRes] = await Promise.all([
        supabase
          .from("business_expenses")
          .select("*")
          .gte("date", sixtyDaysAgo)
          .order("date", { ascending: false })
          .limit(50),
        supabase
          .from("business_income")
          .select("*")
          .gte("date", sixtyDaysAgo)
          .order("date", { ascending: false })
          .limit(50),
      ]);
      if (expRes.data) setBusinessExpenses(expRes.data as BusinessExpense[]);
      if (incRes.data) setBusinessIncome(incRes.data as BusinessIncome[]);
    }
    fetchRelated();
  }, []);

  const getDirectionLabel = (val: string) =>
    DIRECTION_OPTIONS.find((d) => d.value === val)?.label ?? val;

  const expenseOptions = [
    { value: "", label: "— None —" },
    ...businessExpenses.map((e) => ({
      value: e.id,
      label: `${e.vendor_name} — ${formatCurrency(e.amount)} (${e.date})`,
    })),
  ];

  const incomeOptions = [
    { value: "", label: "— None —" },
    ...businessIncome.map((i) => ({
      value: i.id,
      label: `${i.source_name} — ${formatCurrency(i.amount)} (${i.date})`,
    })),
  ];

  const getExpenseLabel = (val: string) =>
    expenseOptions.find((o) => o.value === val)?.label ?? "— None —";
  const getIncomeLabel = (val: string) =>
    incomeOptions.find((o) => o.value === val)?.label ?? "— None —";

  const handleSave = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount greater than 0.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Validation Error", "Please enter a reason.");
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Validation Error", "Date must be YYYY-MM-DD.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        return;
      }

      const { error } = await supabase.rpc("log_personal_business_transfer", {
        p_user_id: user.id,
        p_direction: direction,
        p_amount: parsed,
        p_date: date,
        p_reason: reason.trim(),
        p_business_expense_id:
          direction === "personal_to_business" ? linkedExpenseId || null : null,
        p_business_income_id:
          direction === "business_to_personal" ? linkedIncomeId || null : null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to log transfer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Direction *</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowDirectionPicker(true)}
        >
          <Text style={styles.pickerButtonText}>{getDirectionLabel(direction)}</Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Amount *</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>Date *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9ca3af"
          value={date}
          onChangeText={setDate}
        />

        <Text style={styles.label}>Reason *</Text>
        <TextInput
          style={styles.input}
          placeholder={
            direction === "personal_to_business"
              ? "e.g. Paid for VPS hosting"
              : "e.g. Client payment withdrawal"
          }
          placeholderTextColor="#9ca3af"
          value={reason}
          onChangeText={setReason}
        />

        {direction === "personal_to_business" && (
          <>
            <Text style={styles.label}>Link to business expense (optional)</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowExpensePicker(true)}
            >
              <Text style={styles.pickerButtonText} numberOfLines={1}>
                {getExpenseLabel(linkedExpenseId ?? "")}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </>
        )}

        {direction === "business_to_personal" && (
          <>
            <Text style={styles.label}>Link to business income (optional)</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowIncomePicker(true)}
            >
              <Text style={styles.pickerButtonText} numberOfLines={1}>
                {getIncomeLabel(linkedIncomeId ?? "")}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Optional notes..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Log Transfer</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <PickerModal
        visible={showDirectionPicker}
        onClose={() => setShowDirectionPicker(false)}
        options={DIRECTION_OPTIONS}
        selectedValue={direction}
        onSelect={(val) => {
          setDirection(val as TransferDirection);
          setLinkedExpenseId(null);
          setLinkedIncomeId(null);
        }}
        title="Select Direction"
      />
      <PickerModal
        visible={showExpensePicker}
        onClose={() => setShowExpensePicker(false)}
        options={expenseOptions}
        selectedValue={linkedExpenseId ?? ""}
        onSelect={(val) => setLinkedExpenseId(val || null)}
        title="Link to Business Expense"
      />
      <PickerModal
        visible={showIncomePicker}
        onClose={() => setShowIncomePicker(false)}
        options={incomeOptions}
        selectedValue={linkedIncomeId ?? ""}
        onSelect={(val) => setLinkedIncomeId(val || null)}
        title="Link to Business Income"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
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
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#f9fafb",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  pickerButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f9fafb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerButtonText: { fontSize: 16, color: "#1f2937", flex: 1, marginRight: 8 },
  pickerArrow: { fontSize: 12, color: "#6b7280" },
  saveButton: {
    backgroundColor: "#185FA5",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});