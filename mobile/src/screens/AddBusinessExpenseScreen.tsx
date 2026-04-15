import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import { PageHeader } from "../components/PageHeader";
import {
  BUSINESS_EXPENSE_CATEGORIES,
  BUSINESS_EXPENSE_SUBCATEGORIES,
  FUNDED_FROM_OPTIONS,
} from "../lib/business-constants";
import { PAYMENT_METHODS, RECURRENCE_FREQUENCIES } from "../lib/constants";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii } from "../lib/radii";
import { formatINR } from "../components/komal";
import type { BusinessExpense, BusinessExpenseCategory, FundedFrom } from "../types/business";
import type { PaymentMethod, RecurrenceFrequency } from "../types/database";

export function AddBusinessExpenseScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

  const previewAmount = parseFloat(amount);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <PageHeader
          title={isEditing ? "Edit Expense" : "Business Expense"}
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
          <Text style={labelStyle}>Amount *</Text>
          <TextInput
            style={inputStyle}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          {!!previewAmount && previewAmount > 0 && (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
              {formatINR(previewAmount)}
            </Text>
          )}

          <Text style={labelStyle}>Category *</Text>
          <PickerField colors={colors} onPress={() => setShowCategoryPicker(true)}>
            {getCategoryLabel(category)}
          </PickerField>

          {subCategoryOptions.length > 0 && (
            <>
              <Text style={labelStyle}>Sub-category</Text>
              <PickerField colors={colors} onPress={() => setShowSubCategoryPicker(true)} placeholder={!subCategory}>
                {subCategory || "Select sub-category"}
              </PickerField>
            </>
          )}

          <Text style={labelStyle}>Vendor Name *</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. OpenAI, Vercel"
            placeholderTextColor={colors.textTertiary}
            value={vendorName}
            onChangeText={setVendorName}
          />

          <Text style={labelStyle}>Link to Subscription (optional)</Text>
          <PickerField colors={colors} onPress={() => setShowSubscriptionPicker(true)} placeholder={!subscriptionId}>
            {selectedSubscriptionLabel}
          </PickerField>
          {autoLinkedFromVendor && subscriptionId && (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6, fontStyle: "italic" }]}>
              Auto-linked by vendor match — change if wrong.
            </Text>
          )}

          <Text style={labelStyle}>Date *</Text>
          <TextInput
            style={inputStyle}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            value={date}
            onChangeText={setDate}
          />

          <Text style={labelStyle}>Payment Method</Text>
          <PickerField colors={colors} onPress={() => setShowPaymentPicker(true)}>
            {getPaymentLabel(paymentMethod)}
          </PickerField>

          <Text style={labelStyle}>Funded From</Text>
          <PickerField colors={colors} onPress={() => setShowFundedFromPicker(true)}>
            {getFundedFromLabel(fundedFrom)}
          </PickerField>

          {fundedFrom === "mixed" && (
            <>
              <Text style={labelStyle}>Personal Portion (%)</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g. 30"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={personalPortion}
                onChangeText={setPersonalPortion}
              />
            </>
          )}

          <View style={styles.switchRow}>
            <Text style={[typography.pillLabel, { color: colors.textTertiary }]}>Tax Deductible</Text>
            <Switch
              value={isTaxDeductible}
              onValueChange={setIsTaxDeductible}
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={isTaxDeductible ? colors.accent : colors.surfaceAlt}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[typography.pillLabel, { color: colors.textTertiary }]}>GST Applicable</Text>
            <Switch
              value={gstApplicable}
              onValueChange={setGstApplicable}
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={gstApplicable ? colors.accent : colors.surfaceAlt}
            />
          </View>

          {gstApplicable && (
            <>
              <Text style={labelStyle}>GST Amount</Text>
              <TextInput
                style={inputStyle}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={gstAmount}
                onChangeText={setGstAmount}
              />
            </>
          )}

          <View style={styles.switchRow}>
            <Text style={[typography.pillLabel, { color: colors.textTertiary }]}>Is Recurring</Text>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={isRecurring ? colors.accent : colors.surfaceAlt}
            />
          </View>

          {isRecurring && (
            <>
              <Text style={labelStyle}>Recurrence Frequency</Text>
              <PickerField colors={colors} onPress={() => setShowFrequencyPicker(true)}>
                {getFrequencyLabel(recurrenceFrequency)}
              </PickerField>
            </>
          )}

          <Text style={labelStyle}>Notes</Text>
          <TextInput
            style={[inputStyle, styles.textArea]}
            placeholder="Optional notes..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,
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
              <Text style={[styles.saveButtonText, { fontFamily: fonts.sansSemibold }]}>
                {isEditing ? "Update Business Expense" : "Save Business Expense"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

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
    </View>
  );
}

function PickerField({
  colors,
  onPress,
  children,
  placeholder,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  onPress: () => void;
  children: React.ReactNode;
  placeholder?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 12,
          padding: 14,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          color: placeholder ? colors.textTertiary : colors.textPrimary,
          fontFamily: fonts.sansMedium,
          fontSize: 14,
          flex: 1,
          marginRight: 8,
        }}
      >
        {children}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>▼</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
