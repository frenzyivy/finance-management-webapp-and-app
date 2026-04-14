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
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import {
  BUSINESS_EXPENSE_CATEGORIES,
  BUSINESS_EXPENSE_SUBCATEGORIES,
  FUNDED_FROM_OPTIONS,
} from "../lib/business-constants";
import { PAYMENT_METHODS, RECURRENCE_FREQUENCIES } from "../lib/constants";
import type { BusinessExpense, BusinessExpenseCategory, FundedFrom } from "../types/business";
import type { PaymentMethod, RecurrenceFrequency } from "../types/database";

export function AddBusinessExpenseScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const existingEntry: BusinessExpense | undefined = route.params?.entry;
  const isEditing = !!existingEntry;
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState(existingEntry ? String(existingEntry.amount) : "");
  const [category, setCategory] = useState<BusinessExpenseCategory>(existingEntry?.category ?? "saas_tools");
  const [subCategory, setSubCategory] = useState(existingEntry?.sub_category ?? "");
  const [vendorName, setVendorName] = useState(existingEntry?.vendor_name ?? "");
  const [subscriptionId, setSubscriptionId] = useState<string | null>(existingEntry?.subscription_id ?? null);
  const [subscriptions, setSubscriptions] = useState<{ id: string; name: string }[]>([]);
  const [autoLinkedFromVendor, setAutoLinkedFromVendor] = useState(false);
  const [date, setDate] = useState(existingEntry?.date ?? new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>((existingEntry?.payment_method as PaymentMethod) ?? "upi");
  const [fundedFrom, setFundedFrom] = useState<FundedFrom>(existingEntry?.funded_from ?? "personal_pocket");
  const [personalPortion, setPersonalPortion] = useState(existingEntry ? String(existingEntry.personal_portion) : "0");
  const [isTaxDeductible, setIsTaxDeductible] = useState(existingEntry?.is_tax_deductible ?? false);
  const [gstApplicable, setGstApplicable] = useState(existingEntry?.gst_applicable ?? false);
  const [gstAmount, setGstAmount] = useState(existingEntry ? String(existingEntry.gst_amount) : "0");
  const [isRecurring, setIsRecurring] = useState(existingEntry?.is_recurring ?? false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>((existingEntry?.recurrence_frequency as RecurrenceFrequency) ?? "monthly");
  const [notes, setNotes] = useState(existingEntry?.notes ?? "");

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSubCategoryPicker, setShowSubCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showFundedFromPicker, setShowFundedFromPicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [showSubscriptionPicker, setShowSubscriptionPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("business_subscriptions")
        .select("id, name")
        .in("status", ["active", "trial"])
        .order("name");
      if (!cancelled && data) setSubscriptions(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-suggest subscription from vendor name (matches web behavior).
  useEffect(() => {
    if (isEditing) return;
    const name = vendorName.trim();
    if (name.length < 3) return;
    if (subscriptionId && !autoLinkedFromVendor) return;

    const handle = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc("match_business_subscription_by_name", {
        p_user_id: user.id,
        p_payee_name: name,
      });
      if (error) return;
      const matchedId = (data as string | null) ?? null;
      if (matchedId) {
        setSubscriptionId(matchedId);
        setAutoLinkedFromVendor(true);
      } else if (autoLinkedFromVendor) {
        setSubscriptionId(null);
        setAutoLinkedFromVendor(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [vendorName, subscriptionId, autoLinkedFromVendor, isEditing]);

  const subscriptionOptions = [
    { value: "", label: "— None —" },
    ...subscriptions.map((s) => ({ value: s.id, label: s.name })),
  ];
  const selectedSubscriptionLabel =
    subscriptions.find((s) => s.id === subscriptionId)?.name ?? "— None —";

  const getCategoryLabel = (val: string) =>
    BUSINESS_EXPENSE_CATEGORIES.find((c) => c.value === val)?.label ?? val;
  const getPaymentLabel = (val: string) =>
    PAYMENT_METHODS.find((p) => p.value === val)?.label ?? val;
  const getFundedFromLabel = (val: string) =>
    FUNDED_FROM_OPTIONS.find((f) => f.value === val)?.label ?? val;
  const getFrequencyLabel = (val: string) =>
    RECURRENCE_FREQUENCIES.find((f) => f.value === val)?.label ?? val;

  const subCategoryOptions = (BUSINESS_EXPENSE_SUBCATEGORIES[category] ?? []).map((sc) => ({
    value: sc,
    label: sc,
  }));

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount greater than 0.");
      return;
    }
    if (!vendorName.trim()) {
      Alert.alert("Validation Error", "Please enter a vendor name.");
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
        sub_category: subCategory.trim() || null,
        vendor_name: vendorName.trim(),
        subscription_id: subscriptionId,
        date,
        payment_method: paymentMethod,
        funded_from: fundedFrom,
        personal_portion: fundedFrom === "mixed" ? parseFloat(personalPortion) || 0 : 0,
        is_tax_deductible: isTaxDeductible,
        gst_applicable: gstApplicable,
        gst_amount: gstApplicable ? parseFloat(gstAmount) || 0 : 0,
        is_recurring: isRecurring,
        recurrence_frequency: isRecurring ? recurrenceFrequency : null,
        notes: notes.trim() || null,
      };

      const { error } = isEditing
        ? await supabase.from("business_expenses").update(payload).eq("id", existingEntry!.id)
        : await supabase.from("business_expenses").insert(payload);

      if (error) throw error;
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to save business expense.");
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

        {/* Sub-category */}
        {subCategoryOptions.length > 0 && (
          <>
            <Text style={styles.label}>Sub-category</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowSubCategoryPicker(true)}
            >
              <Text
                style={[
                  styles.pickerButtonText,
                  !subCategory && { color: "#9ca3af" },
                ]}
              >
                {subCategory || "Select sub-category"}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Vendor Name */}
        <Text style={styles.label}>Vendor Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. OpenAI, Vercel"
          placeholderTextColor="#9ca3af"
          value={vendorName}
          onChangeText={setVendorName}
        />

        {/* Link to Subscription */}
        <Text style={styles.label}>Link to Subscription (optional)</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowSubscriptionPicker(true)}
        >
          <Text
            style={[
              styles.pickerButtonText,
              !subscriptionId && { color: "#9ca3af" },
            ]}
          >
            {selectedSubscriptionLabel}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>
        {autoLinkedFromVendor && subscriptionId && (
          <Text style={styles.helperText}>
            Auto-linked by vendor match — change if wrong.
          </Text>
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

        {/* Funded From */}
        <Text style={styles.label}>Funded From</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowFundedFromPicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getFundedFromLabel(fundedFrom)}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Personal Portion (if mixed) */}
        {fundedFrom === "mixed" && (
          <>
            <Text style={styles.label}>Personal Portion (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 30"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={personalPortion}
              onChangeText={setPersonalPortion}
            />
          </>
        )}

        {/* Tax Deductible */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Tax Deductible</Text>
          <Switch
            value={isTaxDeductible}
            onValueChange={setIsTaxDeductible}
            trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
            thumbColor={isTaxDeductible ? "#185FA5" : "#f4f4f5"}
          />
        </View>

        {/* GST Applicable */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>GST Applicable</Text>
          <Switch
            value={gstApplicable}
            onValueChange={setGstApplicable}
            trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
            thumbColor={gstApplicable ? "#185FA5" : "#f4f4f5"}
          />
        </View>

        {/* GST Amount */}
        {gstApplicable && (
          <>
            <Text style={styles.label}>GST Amount</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={gstAmount}
              onChangeText={setGstAmount}
            />
          </>
        )}

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
              {isEditing ? "Update Business Expense" : "Save Business Expense"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Picker Modals */}
      <PickerModal
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        options={BUSINESS_EXPENSE_CATEGORIES}
        selectedValue={category}
        onSelect={(val) => {
          setCategory(val as BusinessExpenseCategory);
          setSubCategory("");
        }}
        title="Select Category"
      />
      {subCategoryOptions.length > 0 && (
        <PickerModal
          visible={showSubCategoryPicker}
          onClose={() => setShowSubCategoryPicker(false)}
          options={subCategoryOptions}
          selectedValue={subCategory}
          onSelect={(val) => setSubCategory(val)}
          title="Select Sub-category"
        />
      )}
      <PickerModal
        visible={showPaymentPicker}
        onClose={() => setShowPaymentPicker(false)}
        options={PAYMENT_METHODS}
        selectedValue={paymentMethod}
        onSelect={(val) => setPaymentMethod(val as PaymentMethod)}
        title="Select Payment Method"
      />
      <PickerModal
        visible={showFundedFromPicker}
        onClose={() => setShowFundedFromPicker(false)}
        options={FUNDED_FROM_OPTIONS}
        selectedValue={fundedFrom}
        onSelect={(val) => setFundedFrom(val as FundedFrom)}
        title="Funded From"
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
        visible={showSubscriptionPicker}
        onClose={() => setShowSubscriptionPicker(false)}
        options={subscriptionOptions}
        selectedValue={subscriptionId ?? ""}
        onSelect={(val) => {
          setSubscriptionId(val ? val : null);
          setAutoLinkedFromVendor(false);
        }}
        title="Link to Subscription"
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
  helperText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    fontStyle: "italic",
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
});
