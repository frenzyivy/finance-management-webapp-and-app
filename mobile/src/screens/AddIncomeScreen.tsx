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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import { PageHeader } from "../components/PageHeader";
import {
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  RECURRENCE_FREQUENCIES,
  INCOME_SOURCE_TYPES,
} from "../lib/constants";
import { BUSINESS_INCOME_CATEGORIES } from "../lib/business-constants";
import { formatCurrency } from "../lib/format";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii } from "../lib/radii";
import { formatINR } from "../components/komal";
import type { IncomeCategory, PaymentMethod, RecurrenceFrequency, Debt } from "../types/database";
import type { BusinessClient, BusinessIncomeCategory } from "../types/business";
import type { RootStackParamList } from "../navigation/AppNavigator";

type SourceType = "personal" | "client" | "borrowed";

export function AddIncomeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "AddIncome">>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

  const pickerPreviewAmount = parseFloat(amount);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <PageHeader
          title={isEditing ? "Edit Income" : "Add Income"}
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
          {/* Amount */}
          <Text style={labelStyle}>Amount *</Text>
          <TextInput
            style={inputStyle}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          {!!pickerPreviewAmount && pickerPreviewAmount > 0 && (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
              {formatINR(pickerPreviewAmount)}
            </Text>
          )}

          {/* Source Type */}
          <Text style={labelStyle}>Where did this money come from? *</Text>
          <PickerField colors={colors} onPress={() => setShowSourceTypePicker(true)}>
            {getSourceTypeLabel(sourceType)}
          </PickerField>

          {/* Category — hidden when borrowed (forced to "borrowed") */}
          {sourceType !== "borrowed" && (
            <>
              <Text style={labelStyle}>Category *</Text>
              <PickerField colors={colors} onPress={() => setShowCategoryPicker(true)}>
                {getCategoryLabel(category)}
              </PickerField>
            </>
          )}

          {/* Source */}
          <Text style={labelStyle}>Source Name *</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Company Name, Client"
            placeholderTextColor={colors.textTertiary}
            value={source}
            onChangeText={setSource}
          />

          {/* Client mirror block */}
          {sourceType === "client" && (
            <View
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.accent,
                backgroundColor: colors.accentLight,
              }}
            >
              <Text style={[typography.caption, { color: colors.accent, fontFamily: fonts.sansSemibold }]}>
                This will also appear in your business books as revenue (landed in personal account).
              </Text>

              <Text style={labelStyle}>Business Income Category *</Text>
              <PickerField colors={colors} onPress={() => setShowBizCategoryPicker(true)}>
                {getBizCategoryLabel(bizCategory)}
              </PickerField>

              {businessClients.length > 0 && (
                <>
                  <Text style={labelStyle}>Client (optional)</Text>
                  <PickerField
                    colors={colors}
                    onPress={() => setShowBizClientPicker(true)}
                    placeholder={!bizClientId}
                  >
                    {selectedBizClientLabel}
                  </PickerField>
                </>
              )}

              <Text style={labelStyle}>Project Name (optional)</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g. Q2 Landing Page Build"
                placeholderTextColor={colors.textTertiary}
                value={bizProjectName}
                onChangeText={setBizProjectName}
              />

              <Text style={labelStyle}>Invoice # (optional)</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g. INV-2026-042"
                placeholderTextColor={colors.textTertiary}
                value={bizInvoiceNumber}
                onChangeText={setBizInvoiceNumber}
              />
            </View>
          )}

          {/* Borrowed: debt selector */}
          {sourceType === "borrowed" && (
            <>
              <Text style={labelStyle}>Link to Debt *</Text>
              {activeDebts.length === 0 ? (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                  No active debts found. Create a debt first so this income can be linked to it.
                </Text>
              ) : (
                <PickerField
                  colors={colors}
                  onPress={() => setShowDebtPicker(true)}
                  placeholder={!linkedDebtId}
                >
                  {linkedDebtId
                    ? debtPickerOptions.find((d) => d.value === linkedDebtId)?.label ?? "Select a debt"
                    : "Select the debt this money came from"}
                </PickerField>
              )}
            </>
          )}

          {/* Date */}
          <Text style={labelStyle}>Date *</Text>
          <TextInput
            style={inputStyle}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            value={date}
            onChangeText={setDate}
          />

          {/* Payment Method */}
          <Text style={labelStyle}>Payment Method</Text>
          <PickerField colors={colors} onPress={() => setShowPaymentPicker(true)}>
            {getPaymentLabel(paymentMethod)}
          </PickerField>

          {/* Is Recurring */}
          <View style={styles.switchRow}>
            <Text style={[labelStyle, { marginTop: 0 }]}>Is Recurring</Text>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={isRecurring ? colors.accent : colors.surfaceAlt}
            />
          </View>

          {/* Recurrence Frequency */}
          {isRecurring && (
            <>
              <Text style={labelStyle}>Recurrence Frequency</Text>
              <PickerField colors={colors} onPress={() => setShowFrequencyPicker(true)}>
                {getFrequencyLabel(recurrenceFrequency)}
              </PickerField>
            </>
          )}

          {/* Notes */}
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

          {/* Save Button */}
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
                {isEditing ? "Update Income" : "Save Income"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

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
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
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
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
