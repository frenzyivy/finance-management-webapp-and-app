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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  RECURRENCE_FREQUENCIES,
  FUNDING_SOURCES,
} from "../lib/constants";
import { BUSINESS_EXPENSE_CATEGORIES } from "../lib/business-constants";
import { formatCurrency } from "../lib/format";
import type {
  ExpenseCategory,
  PaymentMethod,
  RecurrenceFrequency,
  FundingSource,
  Debt,
} from "../types/database";
import type { BusinessClient, BusinessExpenseCategory } from "../types/business";
import type { RootStackParamList } from "../navigation/AppNavigator";

export function AddExpenseScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "AddExpense">>();
  const existingEntry = route.params?.entry;
  const isEditing = !!existingEntry;
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState(existingEntry ? String(existingEntry.amount) : "");
  const [category, setCategory] = useState<ExpenseCategory>(existingEntry?.category ?? "food_groceries");
  const [description, setDescription] = useState(existingEntry?.payee_name ?? "");
  const [date, setDate] = useState(existingEntry?.date ?? new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>((existingEntry?.payment_method as PaymentMethod) ?? "upi");
  const [isRecurring, setIsRecurring] = useState(existingEntry?.is_recurring ?? false);
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<RecurrenceFrequency>(existingEntry?.recurrence_frequency ?? "monthly");
  const [notes, setNotes] = useState("");
  const [fundingSource, setFundingSource] = useState<FundingSource>(
    (existingEntry?.funding_source as FundingSource) ?? "own_funds"
  );
  const [linkedDebtId, setLinkedDebtId] = useState<string | null>(existingEntry?.linked_debt_id ?? null);
  const [activeDebts, setActiveDebts] = useState<Debt[]>([]);

  // Business investment state
  const wasBusinessOnLoad = existingEntry?.is_business_investment ?? false;
  const [isBusinessInvestment, setIsBusinessInvestment] = useState(wasBusinessOnLoad);
  const [bizCategory, setBizCategory] = useState<BusinessExpenseCategory>("miscellaneous");
  const [bizVendorName, setBizVendorName] = useState(existingEntry?.payee_name ?? "");
  const [bizClientId, setBizClientId] = useState<string | null>(null);
  const [bizSubscriptionId, setBizSubscriptionId] = useState<string | null>(null);
  const [bizSubscriptionName, setBizSubscriptionName] = useState<string | null>(null);
  const [bizReason, setBizReason] = useState<string>("");
  const [businessClients, setBusinessClients] = useState<BusinessClient[]>([]);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [showFundingSourcePicker, setShowFundingSourcePicker] = useState(false);
  const [showDebtPicker, setShowDebtPicker] = useState(false);
  const [showBizCategoryPicker, setShowBizCategoryPicker] = useState(false);
  const [showBizClientPicker, setShowBizClientPicker] = useState(false);

  useEffect(() => {
    async function fetchDebts() {
      const { data } = await supabase
        .from("debts")
        .select("*")
        .eq("status", "active")
        .order("creditor_name");
      if (data) setActiveDebts(data as Debt[]);
    }
    async function fetchClients() {
      const { data } = await supabase
        .from("business_clients")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (data) setBusinessClients(data as BusinessClient[]);
    }
    fetchDebts();
    fetchClients();
  }, []);

  // Force business investment off when funding is debt-linked (not supported yet)
  useEffect(() => {
    if (fundingSource !== "own_funds" && isBusinessInvestment) {
      setIsBusinessInvestment(false);
    }
  }, [fundingSource, isBusinessInvestment]);

  // Auto-match payee against business_subscriptions (debounced).
  useEffect(() => {
    if (!isBusinessInvestment || !description || description.trim().length < 3) {
      setBizSubscriptionId(null);
      setBizSubscriptionName(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: matchId, error } = await supabase.rpc("match_business_subscription_by_name", {
        p_user_id: user.id,
        p_payee_name: description,
      });
      if (error || cancelled || !matchId) {
        setBizSubscriptionId(null);
        setBizSubscriptionName(null);
        return;
      }
      const { data: sub } = await supabase
        .from("business_subscriptions")
        .select("id, name")
        .eq("id", matchId)
        .single();
      if (cancelled || !sub) return;
      setBizSubscriptionId(sub.id);
      setBizSubscriptionName(sub.name);
      setBizCategory((prev) => (prev === "miscellaneous" ? "saas_tools" : prev));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [isBusinessInvestment, description]);

  const getCategoryLabel = (val: string) =>
    EXPENSE_CATEGORIES.find((c) => c.value === val)?.label ?? val;
  const getPaymentLabel = (val: string) =>
    PAYMENT_METHODS.find((p) => p.value === val)?.label ?? val;
  const getFrequencyLabel = (val: string) =>
    RECURRENCE_FREQUENCIES.find((f) => f.value === val)?.label ?? val;
  const getFundingSourceLabel = (val: string) =>
    FUNDING_SOURCES.find((f) => f.value === val)?.label ?? val;

  const selectedDebt = activeDebts.find((d) => d.id === linkedDebtId);
  const debtPickerOptions = activeDebts.map((d) => ({
    value: d.id,
    label: `${d.creditor_name} — ${d.name} (${formatCurrency(d.outstanding_balance)} outstanding)`,
  }));

  const getBizCategoryLabel = (val: string) =>
    BUSINESS_EXPENSE_CATEGORIES.find((c) => c.value === val)?.label ?? val;
  const bizClientPickerOptions = [
    { value: "", label: "— No client link —" },
    ...businessClients.map((c) => ({ value: c.id, label: c.name })),
  ];
  const selectedBizClientLabel =
    businessClients.find((c) => c.id === bizClientId)?.name ?? "— No client link —";

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
    if (fundingSource !== "own_funds" && !linkedDebtId) {
      Alert.alert("Validation Error", "Please select a debt to link.");
      return;
    }
    if (isBusinessInvestment) {
      const vendor = (bizVendorName || description).trim();
      if (!vendor) {
        Alert.alert("Validation Error", "Vendor name is required for a business expense.");
        return;
      }
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

      const payload: Record<string, unknown> = {
        user_id: user.id,
        amount: parsedAmount,
        category,
        payee_name: description.trim() || "Unknown",
        notes: notes.trim() || null,
        date,
        is_recurring: isRecurring,
        recurrence_frequency: isRecurring ? recurrenceFrequency : null,
        payment_method: paymentMethod,
        funding_source: fundingSource,
        linked_debt_id: fundingSource !== "own_funds" ? linkedDebtId : null,
      };

      const wantsMirror = isBusinessInvestment && fundingSource === "own_funds";

      const runMirror = async (personalExpenseId: string) => {
        const { error: mirrorErr } = await supabase.rpc("mirror_expense_to_business", {
          p_personal_expense_id: personalExpenseId,
          p_biz_category: bizCategory,
          p_biz_vendor_name: (bizVendorName || description).trim(),
          p_biz_sub_category: null,
          p_biz_subscription_id: bizSubscriptionId || null,
          p_biz_client_id: bizClientId || null,
          p_reason: bizReason.trim() || "Paid from personal for business",
          p_notes: notes.trim() || null,
        });
        if (mirrorErr) throw mirrorErr;
      };

      const runUnmirror = async (personalExpenseId: string) => {
        const { error: unmirrorErr } = await supabase.rpc("unmirror_expense_to_business", {
          p_personal_expense_id: personalExpenseId,
        });
        if (unmirrorErr) throw unmirrorErr;
      };

      let savedExpenseId: string | null = null;

      if (isEditing) {
        const { error } = await supabase
          .from("expense_entries")
          .update(payload)
          .eq("id", existingEntry!.id);
        if (error) throw error;
        savedExpenseId = existingEntry!.id;

        // Same edit-transition logic as web: tear down any existing mirror, then re-mirror if wanted.
        if (wasBusinessOnLoad) {
          await runUnmirror(savedExpenseId);
        }
        if (wantsMirror) {
          await runMirror(savedExpenseId);
        }
      } else if (fundingSource !== "own_funds" && linkedDebtId) {
        // Use RPC for debt-linked expense creation (transactional). Business mirror is not supported on debt-funded path.
        const { error } = await supabase.rpc("create_expense_with_debt_link", {
          p_user_id: user.id,
          p_amount: parsedAmount,
          p_category: category,
          p_sub_category: null,
          p_payee_name: description.trim() || "Unknown",
          p_date: date,
          p_payment_method: paymentMethod,
          p_funding_source: fundingSource,
          p_linked_debt_id: linkedDebtId,
          p_is_emi: false,
          p_is_recurring: isRecurring,
          p_recurrence_frequency: isRecurring ? recurrenceFrequency : null,
          p_notes: notes.trim() || null,
        });
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("expense_entries")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        savedExpenseId = (inserted as { id: string } | null)?.id ?? null;

        if (wantsMirror && savedExpenseId) {
          await runMirror(savedExpenseId);
        }
      }

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

        {/* Funding Source */}
        <Text style={styles.label}>Funding Source</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowFundingSourcePicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getFundingSourceLabel(fundingSource)}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Debt Selector (conditional) */}
        {fundingSource !== "own_funds" && (
          <>
            <Text style={styles.label}>Select Debt *</Text>
            {activeDebts.length === 0 ? (
              <Text style={styles.hintText}>No active debts found.</Text>
            ) : (
              <>
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
                      : "Select a debt"}
                  </Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>
                {selectedDebt && fundingSource === "debt_repayment" && selectedDebt.emi_amount != null && (
                  <Text style={styles.hintText}>
                    EMI amount: {formatCurrency(selectedDebt.emi_amount)}
                  </Text>
                )}
              </>
            )}
          </>
        )}

        {/* Business Investment block (own_funds only) */}
        {fundingSource === "own_funds" && (
          <View style={styles.businessBlock}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Paid from my pocket for the business</Text>
              <Switch
                value={isBusinessInvestment}
                onValueChange={(val) => {
                  setIsBusinessInvestment(val);
                  if (!val) {
                    setBizSubscriptionId(null);
                    setBizSubscriptionName(null);
                    setBizClientId(null);
                  }
                }}
                trackColor={{ false: "#d1d5db", true: "#99f6e4" }}
                thumbColor={isBusinessInvestment ? "#0d9488" : "#f4f4f5"}
              />
            </View>

            {isBusinessInvestment && (
              <View>
                {bizSubscriptionName && (
                  <Text style={styles.matchHint}>
                    Matched to subscription: {bizSubscriptionName} — will link automatically
                  </Text>
                )}

                <Text style={styles.label}>Business Category *</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowBizCategoryPicker(true)}
                >
                  <Text style={styles.pickerButtonText}>
                    {getBizCategoryLabel(bizCategory)}
                  </Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Vendor Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Claude.ai, AWS"
                  placeholderTextColor="#9ca3af"
                  value={bizVendorName}
                  onChangeText={setBizVendorName}
                />

                {businessClients.length > 0 && (
                  <>
                    <Text style={styles.label}>Link to Client (optional)</Text>
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

                <Text style={styles.label}>Reason (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. AI tooling for client work"
                  placeholderTextColor="#9ca3af"
                  value={bizReason}
                  onChangeText={setBizReason}
                />
              </View>
            )}
          </View>
        )}

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
            <Text style={styles.saveButtonText}>{isEditing ? "Update Expense" : "Save Expense"}</Text>
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
      <PickerModal
        visible={showFundingSourcePicker}
        onClose={() => setShowFundingSourcePicker(false)}
        options={FUNDING_SOURCES}
        selectedValue={fundingSource}
        onSelect={(val) => {
          setFundingSource(val as FundingSource);
          if (val === "own_funds") {
            setLinkedDebtId(null);
          }
          if (val === "debt_repayment") {
            setCategory("debt_repayment");
          }
        }}
        title="Select Funding Source"
      />
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
      <PickerModal
        visible={showBizCategoryPicker}
        onClose={() => setShowBizCategoryPicker(false)}
        options={BUSINESS_EXPENSE_CATEGORIES}
        selectedValue={bizCategory}
        onSelect={(val) => setBizCategory(val as BusinessExpenseCategory)}
        title="Select Business Category"
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
  hintText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
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
    marginTop: 8,
    fontWeight: "600",
  },
});
