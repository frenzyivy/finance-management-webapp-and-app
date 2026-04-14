import React, { useState, useEffect } from "react";
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
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import {
  BUSINESS_INCOME_CATEGORIES,
  LANDED_IN_OPTIONS,
} from "../lib/business-constants";
import { PAYMENT_METHODS, RECURRENCE_FREQUENCIES } from "../lib/constants";
import type { BusinessIncome, BusinessIncomeCategory, LandedIn } from "../types/business";
import type { PaymentMethod, RecurrenceFrequency } from "../types/database";
import type { BusinessClient } from "../types/business";

export function AddBusinessIncomeScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const existingEntry: BusinessIncome | undefined = route.params?.entry;
  const isEditing = !!existingEntry;
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState(existingEntry ? String(existingEntry.amount) : "");
  const [category, setCategory] = useState<BusinessIncomeCategory>(existingEntry?.category ?? "client_project");
  const [sourceName, setSourceName] = useState(existingEntry?.source_name ?? "");
  const [projectName, setProjectName] = useState(existingEntry?.project_name ?? "");
  const [clientId, setClientId] = useState<string | null>(existingEntry?.client_id ?? null);
  const [invoiceNumber, setInvoiceNumber] = useState(existingEntry?.invoice_number ?? "");
  const [date, setDate] = useState(existingEntry?.date ?? new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>((existingEntry?.payment_method as PaymentMethod) ?? "bank_transfer");
  const [landedIn, setLandedIn] = useState<LandedIn>(existingEntry?.landed_in ?? "personal_account");
  const [isRecurring, setIsRecurring] = useState(existingEntry?.is_recurring ?? false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>((existingEntry?.recurrence_frequency as RecurrenceFrequency) ?? "monthly");
  const [notes, setNotes] = useState(existingEntry?.notes ?? "");

  const [activeClients, setActiveClients] = useState<BusinessClient[]>([]);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showLandedInPicker, setShowLandedInPicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);

  useEffect(() => {
    async function fetchClients() {
      const { data } = await supabase
        .from("business_clients")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (data) setActiveClients(data as BusinessClient[]);
    }
    fetchClients();
  }, []);

  const getCategoryLabel = (val: string) =>
    BUSINESS_INCOME_CATEGORIES.find((c) => c.value === val)?.label ?? val;
  const getPaymentLabel = (val: string) =>
    PAYMENT_METHODS.find((p) => p.value === val)?.label ?? val;
  const getLandedInLabel = (val: string) =>
    LANDED_IN_OPTIONS.find((l) => l.value === val)?.label ?? val;
  const getFrequencyLabel = (val: string) =>
    RECURRENCE_FREQUENCIES.find((f) => f.value === val)?.label ?? val;

  const clientPickerOptions = activeClients.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount greater than 0.");
      return;
    }
    if (!sourceName.trim()) {
      Alert.alert("Validation Error", "Please enter a source name.");
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Validation Error", "Please enter a valid date in YYYY-MM-DD format.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        return;
      }

      const payload = {
        user_id: user.id,
        amount: parsedAmount,
        category,
        source_name: sourceName.trim(),
        project_name: projectName.trim() || null,
        client_id: clientId || null,
        invoice_number: invoiceNumber.trim() || null,
        date,
        payment_method: paymentMethod,
        landed_in: landedIn,
        is_recurring: isRecurring,
        recurrence_frequency: isRecurring ? recurrenceFrequency : null,
        notes: notes.trim() || null,
      };

      const { error } = isEditing
        ? await supabase.from("business_income").update(payload).eq("id", existingEntry!.id)
        : await supabase.from("business_income").insert(payload);

      if (error) throw error;
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to save business income.");
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

        {/* Source Name */}
        <Text style={styles.label}>Source Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Client Name, Platform"
          placeholderTextColor="#9ca3af"
          value={sourceName}
          onChangeText={setSourceName}
        />

        {/* Project Name */}
        <Text style={styles.label}>Project Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Website Redesign"
          placeholderTextColor="#9ca3af"
          value={projectName}
          onChangeText={setProjectName}
        />

        {/* Client */}
        <Text style={styles.label}>Client (optional)</Text>
        {activeClients.length > 0 ? (
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowClientPicker(true)}
          >
            <Text
              style={[
                styles.pickerButtonText,
                !clientId && { color: "#9ca3af" },
              ]}
              numberOfLines={1}
            >
              {clientId
                ? clientPickerOptions.find((c) => c.value === clientId)?.label ?? "Select client"
                : "Select client"}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.hintText}>No active clients found.</Text>
        )}

        {/* Invoice Number */}
        <Text style={styles.label}>Invoice Number</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. INV-001"
          placeholderTextColor="#9ca3af"
          value={invoiceNumber}
          onChangeText={setInvoiceNumber}
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

        {/* Landed In */}
        <Text style={styles.label}>Landed In</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowLandedInPicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getLandedInLabel(landedIn)}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Is Recurring */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Is Recurring</Text>
          <Switch
            value={isRecurring}
            onValueChange={setIsRecurring}
            trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
            thumbColor={isRecurring ? "#185FA5" : "#f4f4f5"}
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
            <Text style={styles.saveButtonText}>
              {isEditing ? "Update Business Income" : "Save Business Income"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Picker Modals */}
      <PickerModal
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        options={BUSINESS_INCOME_CATEGORIES}
        selectedValue={category}
        onSelect={(val) => setCategory(val as BusinessIncomeCategory)}
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
        visible={showLandedInPicker}
        onClose={() => setShowLandedInPicker(false)}
        options={LANDED_IN_OPTIONS}
        selectedValue={landedIn}
        onSelect={(val) => setLandedIn(val as LandedIn)}
        title="Where Did It Land?"
      />
      <PickerModal
        visible={showFrequencyPicker}
        onClose={() => setShowFrequencyPicker(false)}
        options={RECURRENCE_FREQUENCIES}
        selectedValue={recurrenceFrequency}
        onSelect={(val) => setRecurrenceFrequency(val as RecurrenceFrequency)}
        title="Select Frequency"
      />
      {clientPickerOptions.length > 0 && (
        <PickerModal
          visible={showClientPicker}
          onClose={() => setShowClientPicker(false)}
          options={clientPickerOptions}
          selectedValue={clientId ?? ""}
          onSelect={(val) => setClientId(val)}
          title="Select Client"
        />
      )}
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
    backgroundColor: "#185FA5",
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
  hintText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
});
