import React, { useState, useEffect } from "react";
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
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  RECURRENCE_FREQUENCIES,
  FUNDING_SOURCES,
} from "../lib/constants";
import { BUSINESS_EXPENSE_CATEGORIES } from "../lib/business-constants";
import { formatCurrency } from "../lib/format";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii } from "../lib/radii";
import { formatINR } from "../components/komal";
import type {
  ExpenseCategory,
  PaymentMethod,
  RecurrenceFrequency,
  FundingSource,
  Debt,
} from "../types/database";

type BnplPlatform = { id: string; name: string };
type BnplPurchase = {
  id: string;
  platform_id: string;
  item_name: string;
  emi_amount: number;
  paid_emis: number;
  total_emis: number;
  outstanding_balance: number;
  status: string;
};
import type { BusinessClient, BusinessExpenseCategory } from "../types/business";
import type { RootStackParamList } from "../navigation/AppNavigator";

export function AddExpenseScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "AddExpense">>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
  const [bnplPurchaseId, setBnplPurchaseId] = useState<string | null>(
    existingEntry?.source_bnpl_purchase_id ?? null
  );
  const [activeDebts, setActiveDebts] = useState<Debt[]>([]);
  const [bnplPlatforms, setBnplPlatforms] = useState<BnplPlatform[]>([]);
  const [bnplPurchases, setBnplPurchases] = useState<BnplPurchase[]>([]);

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
    async function fetchBnpl() {
      const [{ data: platforms }, { data: purchases }] = await Promise.all([
        supabase.from("bnpl_platforms").select("id,name").order("name"),
        supabase
          .from("bnpl_purchases")
          .select("id,platform_id,item_name,emi_amount,paid_emis,total_emis,outstanding_balance,status")
          .in("status", ["active", "overdue"])
          .order("purchase_date", { ascending: false }),
      ]);
      if (platforms) setBnplPlatforms(platforms as BnplPlatform[]);
      if (purchases) setBnplPurchases(purchases as BnplPurchase[]);
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
    fetchBnpl();
    fetchClients();
  }, []);

  useEffect(() => {
    if (fundingSource !== "own_funds" && isBusinessInvestment) {
      setIsBusinessInvestment(false);
    }
  }, [fundingSource, isBusinessInvestment]);

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
  const selectedBnplPurchase = bnplPurchases.find((p) => p.id === bnplPurchaseId);

  // Flat list for PickerModal. Values are prefixed: "debt:<id>" or "bnpl:<id>".
  const debtPickerOptions = [
    ...activeDebts.map((d) => ({
      value: `debt:${d.id}`,
      label: `${d.creditor_name} — ${d.name} (${formatCurrency(d.outstanding_balance)} outstanding)`,
    })),
    ...bnplPlatforms.flatMap((platform) =>
      bnplPurchases
        .filter((p) => p.platform_id === platform.id)
        .map((p) => ({
          value: `bnpl:${p.id}`,
          label:
            fundingSource === "debt_repayment"
              ? `${platform.name} · ${p.item_name} (EMI ${formatCurrency(p.emi_amount)} · ${p.paid_emis}/${p.total_emis})`
              : `${platform.name} · ${p.item_name} (${formatCurrency(p.outstanding_balance)} outstanding)`,
        }))
    ),
  ];

  const debtPickerSelected = bnplPurchaseId
    ? `bnpl:${bnplPurchaseId}`
    : linkedDebtId
    ? `debt:${linkedDebtId}`
    : "";

  const debtPickerLabel = (() => {
    if (!debtPickerSelected) return "Select a debt or purchase";
    return (
      debtPickerOptions.find((o) => o.value === debtPickerSelected)?.label ??
      "Select a debt or purchase"
    );
  })();

  const handleDebtPickerSelect = (val: string) => {
    if (val.startsWith("bnpl:")) {
      setBnplPurchaseId(val.slice(5));
      setLinkedDebtId(null);
    } else if (val.startsWith("debt:")) {
      setLinkedDebtId(val.slice(5));
      setBnplPurchaseId(null);
    }
  };

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
      Alert.alert("Validation Error", "Please enter a valid amount greater than 0.");
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Validation Error", "Please enter a valid date in YYYY-MM-DD format.");
      return;
    }
    if (fundingSource !== "own_funds" && !linkedDebtId && !bnplPurchaseId) {
      Alert.alert("Validation Error", "Please select a debt or BNPL purchase to link.");
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
        source_bnpl_purchase_id: fundingSource !== "own_funds" ? bnplPurchaseId : null,
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

        if (wasBusinessOnLoad) {
          await runUnmirror(savedExpenseId);
        }
        if (wantsMirror) {
          await runMirror(savedExpenseId);
        }
      } else if (fundingSource !== "own_funds" && bnplPurchaseId) {
        const { error } = await supabase.rpc("create_expense_with_bnpl_purchase_link", {
          p_user_id: user.id,
          p_amount: parsedAmount,
          p_category: category,
          p_sub_category: null,
          p_payee_name: description.trim() || "Unknown",
          p_date: date,
          p_payment_method: paymentMethod,
          p_funding_source: fundingSource,
          p_bnpl_purchase_id: bnplPurchaseId,
          p_is_emi: true,
          p_is_recurring: isRecurring,
          p_recurrence_frequency: isRecurring ? recurrenceFrequency : null,
          p_notes: notes.trim() || null,
        });
        if (error) throw error;
      } else if (fundingSource !== "own_funds" && linkedDebtId) {
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
          title={isEditing ? "Edit Expense" : "Add Expense"}
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

          <Text style={labelStyle}>Description / Payee</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Grocery Store, Netflix"
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
          />

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

          <Text style={labelStyle}>Funding Source</Text>
          <PickerField colors={colors} onPress={() => setShowFundingSourcePicker(true)}>
            {getFundingSourceLabel(fundingSource)}
          </PickerField>

          {fundingSource !== "own_funds" && (
            <>
              <Text style={labelStyle}>Select Debt or Purchase *</Text>
              {debtPickerOptions.length === 0 ? (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                  No active debts or BNPL purchases found.
                </Text>
              ) : (
                <>
                  <PickerField colors={colors} onPress={() => setShowDebtPicker(true)} placeholder={!debtPickerSelected}>
                    {debtPickerLabel}
                  </PickerField>
                  {selectedDebt && fundingSource === "debt_repayment" && selectedDebt.emi_amount != null && (
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
                      EMI amount: {formatCurrency(selectedDebt.emi_amount)}
                    </Text>
                  )}
                  {selectedBnplPurchase && fundingSource === "debt_repayment" && (
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
                      EMI amount: {formatCurrency(selectedBnplPurchase.emi_amount)} · paid{" "}
                      {selectedBnplPurchase.paid_emis}/{selectedBnplPurchase.total_emis}
                    </Text>
                  )}
                </>
              )}
            </>
          )}

          {fundingSource === "own_funds" && (
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
              <View style={[styles.switchRow, { marginTop: 0 }]}>
                <Text style={[typography.pillLabel, { color: colors.textTertiary }]}>Paid from my pocket for business</Text>
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
                  trackColor={{ false: colors.border, true: colors.accentLight }}
                  thumbColor={isBusinessInvestment ? colors.accent : colors.surfaceAlt}
                />
              </View>

              {isBusinessInvestment && (
                <View>
                  {bizSubscriptionName && (
                    <Text style={[typography.caption, { color: colors.accent, marginTop: 10, fontFamily: fonts.sansSemibold }]}>
                      Matched to subscription: {bizSubscriptionName} — will link automatically
                    </Text>
                  )}

                  <Text style={labelStyle}>Business Category *</Text>
                  <PickerField colors={colors} onPress={() => setShowBizCategoryPicker(true)}>
                    {getBizCategoryLabel(bizCategory)}
                  </PickerField>

                  <Text style={labelStyle}>Vendor Name *</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="e.g. Claude.ai, AWS"
                    placeholderTextColor={colors.textTertiary}
                    value={bizVendorName}
                    onChangeText={setBizVendorName}
                  />

                  {businessClients.length > 0 && (
                    <>
                      <Text style={labelStyle}>Link to Client (optional)</Text>
                      <PickerField colors={colors} onPress={() => setShowBizClientPicker(true)} placeholder={!bizClientId}>
                        {selectedBizClientLabel}
                      </PickerField>
                    </>
                  )}

                  <Text style={labelStyle}>Reason (optional)</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="e.g. AI tooling for client work"
                    placeholderTextColor={colors.textTertiary}
                    value={bizReason}
                    onChangeText={setBizReason}
                  />
                </View>
              )}
            </View>
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
                {isEditing ? "Update Expense" : "Save Expense"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

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
          selectedValue={debtPickerSelected}
          onSelect={handleDebtPickerSelect}
          title="Select Debt or Purchase"
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
