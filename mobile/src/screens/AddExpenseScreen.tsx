import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  RECURRENCE_FREQUENCIES,
} from "../lib/constants";
import type {
  ExpenseCategory,
  PaymentMethod,
  RecurrenceFrequency,
} from "../types/database";

export function AddExpenseScreen() {
  const navigation = useNavigation();
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food_groceries");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<RecurrenceFrequency>("monthly");
  const [notes, setNotes] = useState("");

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);

  const getCategoryLabel = (val: string) =>
    EXPENSE_CATEGORIES.find((c) => c.value === val)?.label ?? val;
  const getPaymentLabel = (val: string) =>
    PAYMENT_METHODS.find((p) => p.value === val)?.label ?? val;
  const getFrequencyLabel = (val: string) =>
    RECURRENCE_FREQUENCIES.find((f) => f.value === val)?.label ?? val;

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert(
        "Validation Error",
        "Please enter a valid amount greater than 0."
      );
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert(
        "Validation Error",
        "Please enter a valid date in YYYY-MM-DD format."
      );
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        return;
      }

      const descriptionText =
        description.trim() || notes.trim() || null;

      const { error } = await supabase.from("expense_entries").insert({
        user_id: user.id,
        amount: parsedAmount,
        category,
        description: descriptionText,
        date,
        is_recurring: isRecurring,
        recurrence_frequency: isRecurring ? recurrenceFrequency : null,
        payment_method: paymentMethod,
      });

      if (error) throw error;
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to save expense entry.");
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
        {/* Amount */}
        <Text style={styles.label}>Amount *</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        {/* Category */}
        <Text style={styles.label}>Category *</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowCategoryPicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getCategoryLabel(category)}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Description / Payee */}
        <Text style={styles.label}>Description / Payee</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Grocery Store, Netflix"
          placeholderTextColor="#9ca3af"
          value={description}
          onChangeText={setDescription}
        />

        {/* Date */}
        <Text style={styles.label}>Date *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9ca3af"
          value={date}
          onChangeText={setDate}
        />

        {/* Payment Method */}
        <Text style={styles.label}>Payment Method</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowPaymentPicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getPaymentLabel(paymentMethod)}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Is Recurring */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Is Recurring</Text>
          <Switch
            value={isRecurring}
            onValueChange={setIsRecurring}
            trackColor={{ false: "#d1d5db", true: "#99f6e4" }}
            thumbColor={isRecurring ? "#0d9488" : "#f4f4f5"}
          />
        </View>

        {/* Recurrence Frequency */}
        {isRecurring && (
          <>
            <Text style={styles.label}>Recurrence Frequency</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowFrequencyPicker(true)}
            >
              <Text style={styles.pickerButtonText}>
                {getFrequencyLabel(recurrenceFrequency)}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Notes */}
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

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Expense</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Picker Modals */}
      <PickerModal
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        options={EXPENSE_CATEGORIES}
        selectedValue={category}
        onSelect={(val) => setCategory(val as ExpenseCategory)}
        title="Select Category"
      />
      <PickerModal
        visible={showPaymentPicker}
        onClose={() => setShowPaymentPicker(false)}
        options={PAYMENT_METHODS}
        selectedValue={paymentMethod}
        onSelect={(val) => setPaymentMethod(val as PaymentMethod)}
        title="Select Payment Method"
      />
      <PickerModal
        visible={showFrequencyPicker}
        onClose={() => setShowFrequencyPicker(false)}
        options={RECURRENCE_FREQUENCIES}
        selectedValue={recurrenceFrequency}
        onSelect={(val) => setRecurrenceFrequency(val as RecurrenceFrequency)}
        title="Select Frequency"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
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
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
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
  pickerButtonText: {
    fontSize: 16,
    color: "#1f2937",
  },
  pickerArrow: {
    fontSize: 12,
    color: "#6b7280",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  saveButton: {
    backgroundColor: "#0d9488",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
