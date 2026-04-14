import React, { useEffect, useState } from "react";
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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import {
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  RECURRENCE_FREQUENCIES,
  INCOME_SOURCE_TYPES,
} from "../lib/constants";
import { BUSINESS_INCOME_CATEGORIES } from "../lib/business-constants";
import { formatCurrency } from "../lib/format";
import type { IncomeCategory, PaymentMethod, RecurrenceFrequency, Debt } from "../types/database";
import type { BusinessClient, BusinessIncomeCategory } from "../types/business";
import type { RootStackParamList } from "../navigation/AppNavigator";

type SourceType = "personal" | "client" | "borrowed";

export function AddIncomeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "AddIncome">>();
  const existingEntry = route.params?.entry;
  const isEditing = !!existingEntry;
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState(existingEntry ? String(existingEntry.amount) : "");
  const [category, setCategory] = useState<IncomeCategory>(existingEntry?.category ?? "salary");
  const [source, setSource] = useState(existingEntry?.source_name ?? "");
  const [date, setDate] = useState(existingEntry?.date ?? new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>((existingEntry?.payment_method as PaymentMethod) ?? "bank_transfer");
  const [isRecurring, setIsRecurring] = useState(existingEntry?.is_recurring ?? false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>(existingEntry?.recurrence_frequency ?? "monthly");
  const [notes, setNotes] = useState(existingEntry?.notes ?? "");

  // Source type & related state
  const wasBusinessOnLoad = existingEntry?.is_business_withdrawal ?? false;
  const initialSourceType: SourceType = wasBusinessOnLoad
    ? "client"
    : existingEntry?.category === "borrowed"
    ? "borrowed"
    : "personal";
  const [sourceType, setSourceType] = useState<SourceType>(initialSourceType);

  // Client-mirror fields
  const [bizCategory, setBizCategory] = useState<BusinessIncomeCategory>("client_project");
  const [bizClientId, setBizClientId] = useState<string | null>(null);
  const [bizProjectName, setBizProjectName] = useState<string>("");
  const [bizInvoiceNumber, setBizInvoiceNumber] = useState<string>("");
  const [businessClients, setBusinessClients] = useState<BusinessClient[]>([]);

  // Borrowed fields
  const [linkedDebtId, setLinkedDebtId] = useState<string | null>(existingEntry?.linked_debt_id ?? null);
  const [activeDebts, setActiveDebts] = useState<Debt[]>([]);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [showSourceTypePicker, setShowSourceTypePicker] = useState(false);
  const [showBizCategoryPicker, setShowBizCategoryPicker] = useState(false);
  const [showBizClientPicker, setShowBizClientPicker] = useState(false);
  const [showDebtPicker, setShowDebtPicker] = useState(false);

  useEffect(() => {
    async function fetchClients() {
      const { data } = await supabase
        .from("business_clients")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (data) setBusinessClients(data as BusinessClient[]);
    }
    async function fetchDebts() {
      const { data } = await supabase
        .from("debts")
        .select("*")
        .eq("status", "active")
        .order("creditor_name");
      if (data) setActiveDebts(data as Debt[]);
    }
    fetchClients();
    fetchDebts();
  }, []);

  // Keep category and side-fields in sync with sourceType
  useEffect(() => {
    if (sourceType === "borrowed") {
      setCategory("borrowed");
    } else if (sourceType === "client" && category === "borrowed") {
      setCategory("freelance");
      setLinkedDebtId(null);
    } else if (sourceType === "personal") {
      setLinkedDebtId(null);
      setBizClientId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType]);

  const getCategoryLabel = (val: string) =>
    INCOME_CATEGORIES.find((c) => c.value === val)?.label ?? val;
  const getPaymentLabel = (val: string) =>
    PAYMENT_METHODS.find((p) => p.value === val)?.label ?? val;
  const getFrequencyLabel = (val: string) =>
    RECURRENCE_FREQUENCIES.find((f) => f.value === val)?.label ?? val;
  const getSourceTypeLabel = (val: string) =>
    INCOME_SOURCE_TYPES.find((s) => s.value === val)?.label ?? val;
  const getBizCategoryLabel = (val: string) =>
    BUSINESS_INCOME_CATEGORIES.find((c) => c.value === val)?.label ?? val;

  const debtPickerOptions = activeDebts.map((d) => ({
    value: d.id,
    label: `${d.creditor_name} — ${d.name} (${formatCurrency(d.outstanding_balance)} outstanding)`,
  }));
  const bizClientPickerOptions = [
    { value: "", label: "— No client link —" },
    ...businessClients.map((c) => ({ value: c.id, label: c.name })),
  ];
  const selectedBizClientLabel =
    businessClients.find((c) => c.id === bizClientId)?.name ?? "— No client link —";
  const visibleIncomeCategories = INCOME_CATEGORIES.filter((c) => c.value !== "borrowed");

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount greater than 0.");
      return;
    }
    if (!source.trim()) {
      Alert.alert("Validation Error", "Please enter a source name.");
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Validation Error", "Please enter a valid date in YYYY-MM-DD format.");
      return;
    }
    if (sourceType === "borrowed" && !linkedDebtId) {
      Alert.alert("Validation Error", "Please link this income to the debt it came from.");
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
        source_name: source.trim(),
        notes: notes.trim() || null,
        date,
        is_recurring: isRecurring,
        recurrence_frequency: isRecurring ? recurrenceFrequency : null,
        payment_method: paymentMethod,
        linked_debt_id: sourceType === "borrowed" ? linkedDebtId : null,
      };

      const wantsMirror = sourceType === "client";

      const runMirror = async (personalIncomeId: string) => {
        const { error: mirrorErr } = await supabase.rpc("mirror_income_to_business", {
          p_personal_income_id: personalIncomeId,
          p_biz_category: bizCategory,
          p_biz_source_name: source.trim(),
          p_project_name: bizProjectName.trim() || null,
          p_client_id: bizClientId || null,
          p_invoice_number: bizInvoiceNumber.trim() || null,
          p_reason: "Client revenue landed in personal account",
          p_notes: notes.trim() || null,
        });
        if (mirrorErr) throw mirrorErr;
      };

      const runUnmirror = async (personalIncomeId: string) => {
        const { error: unmirrorErr } = await supabase.rpc("unmirror_income_to_business", {
          p_personal_income_id: personalIncomeId,
        });
        if (unmirrorErr) throw unmirrorErr;
      };

      let savedIncomeId: string | null = null;

      if (isEditing) {
        const { error } = await supabase
          .from("income_entries")
          .update(payload)
          .eq("id", existingEntry!.id);
        if (error) throw error;
        savedIncomeId = existingEntry!.id;

        if (wasBusinessOnLoad) {
          await runUnmirror(savedIncomeId);
        }
        if (wantsMirror) {
          await runMirror(savedIncomeId);
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("income_entries")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        savedIncomeId = (inserted as { id: string } | null)?.id ?? null;

        if (wantsMirror && savedIncomeId) {
          await runMirror(savedIncomeId);
        }
      }

      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to save income entry.");
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

        {/* Source Type */}
        <Text style={styles.label}>Where did this money come from? *</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowSourceTypePicker(true)}
        >
          <Text style={styles.pickerButtonText}>{getSourceTypeLabel(sourceType)}</Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Category — hidden when borrowed (forced to "borrowed") */}
        {sourceType !== "borrowed" && (
          <>
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
          </>
        )}

        {/* Source */}
        <Text style={styles.label}>Source Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Company Name, Client"
          placeholderTextColor="#9ca3af"
          value={source}
          onChangeText={setSource}
        />

        {/* Client mirror block */}
        {sourceType === "client" && (
          <View style={styles.businessBlock}>
            <Text style={styles.matchHint}>
              This will also appear in your business books as revenue (landed in personal account).
            </Text>

            <Text style={styles.label}>Business Income Category *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowBizCategoryPicker(true)}
            >
              <Text style={styles.pickerButtonText}>{getBizCategoryLabel(bizCategory)}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>

            {businessClients.length > 0 && (
              <>
                <Text style={styles.label}>Client (optional)</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowBizClientPicker(true)}
                >
                  <Text
                    style={[
                      styles.pickerButtonText,
                      !bizClientId && { color: "#9ca3af" },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedBizClientLabel}
                  </Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.label}>Project Name (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Q2 Landing Page Build"
              placeholderTextColor="#9ca3af"
              value={bizProjectName}
              onChangeText={setBizProjectName}
            />

            <Text style={styles.label}>Invoice # (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. INV-2026-042"
              placeholderTextColor="#9ca3af"
              value={bizInvoiceNumber}
              onChangeText={setBizInvoiceNumber}
            />
          </View>
        )}

        {/* Borrowed: debt selector */}
        {sourceType === "borrowed" && (
          <>
            <Text style={styles.label}>Link to Debt *</Text>
            {activeDebts.length === 0 ? (
              <Text style={styles.hintText}>
                No active debts found. Create a debt first so this income can be linked to it.
              </Text>
            ) : (
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowDebtPicker(true)}
              >
                <Text
                  style={[
                    styles.pickerButtonText,
                    !linkedDebtId && { color: "#9ca3af" },
                  ]}
                  numberOfLines={1}
                >
                  {linkedDebtId
                    ? debtPickerOptions.find((d) => d.value === linkedDebtId)?.label ?? "Select a debt"
                    : "Select the debt this money came from"}
                </Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>
            )}
          </>
        )}

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
            <Text style={styles.saveButtonText}>{isEditing ? "Update Income" : "Save Income"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Picker Modals */}
      <PickerModal
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        options={visibleIncomeCategories}
        selectedValue={category}
        onSelect={(val) => setCategory(val as IncomeCategory)}
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
      <PickerModal
        visible={showSourceTypePicker}
        onClose={() => setShowSourceTypePicker(false)}
        options={INCOME_SOURCE_TYPES}
        selectedValue={sourceType}
        onSelect={(val) => setSourceType(val as SourceType)}
        title="Source of Money"
      />
      <PickerModal
        visible={showBizCategoryPicker}
        onClose={() => setShowBizCategoryPicker(false)}
        options={BUSINESS_INCOME_CATEGORIES}
        selectedValue={bizCategory}
        onSelect={(val) => setBizCategory(val as BusinessIncomeCategory)}
        title="Business Income Category"
      />
      {businessClients.length > 0 && (
        <PickerModal
          visible={showBizClientPicker}
          onClose={() => setShowBizClientPicker(false)}
          options={bizClientPickerOptions}
          selectedValue={bizClientId ?? ""}
          onSelect={(val) => setBizClientId(val || null)}
          title="Link to Client"
        />
      )}
      {debtPickerOptions.length > 0 && (
        <PickerModal
          visible={showDebtPicker}
          onClose={() => setShowDebtPicker(false)}
          options={debtPickerOptions}
          selectedValue={linkedDebtId ?? ""}
          onSelect={(val) => setLinkedDebtId(val)}
          title="Select Debt"
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
  businessBlock: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#0d9488",
    backgroundColor: "rgba(13, 148, 136, 0.05)",
  },
  matchHint: {
    fontSize: 12,
    color: "#0d9488",
    marginTop: 4,
    fontWeight: "600",
  },
  hintText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
});
