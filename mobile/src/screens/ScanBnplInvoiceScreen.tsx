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
import { supabase } from "../lib/supabase";

/**
 * Scan BNPL Invoice — mobile equivalent of the web "Add from Invoice" flow.
 *
 * Step 1: Pick order invoice + optional EMI confirmation
 * Step 2: Parse via backend (Claude Vision)
 * Step 3: Review & edit the extracted fields
 * Step 4: Save purchase + upload invoices to Storage
 */

interface ParsedInvoiceData {
  item_name: string | null;
  item_category: string | null;
  merchant_name: string | null;
  order_id: string | null;
  total_amount: number | null;
  down_payment: number | null;
  interest_rate: number | null;
  interest_rate_type: "per_annum" | "flat" | null;
  processing_fee: number | null;
  total_payable: number | null;
  emi_amount: number | null;
  total_emis: number | null;
  purchase_date: string | null;
  first_emi_date: string | null;
  emi_day_of_month: number | null;
  notes: string | null;
  confidence: Record<string, "high" | "low" | "missing">;
  warnings: string[];
}

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

interface BnplPlatform {
  id: string;
  name: string;
}

export function ScanBnplInvoiceScreen({ navigation }: any) {
  const [orderFile, setOrderFile] = useState<PickedFile | null>(null);
  const [emiFile, setEmiFile] = useState<PickedFile | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<ParsedInvoiceData | null>(null);

  // Editable review fields
  const [itemName, setItemName] = useState("");
  const [orderId, setOrderId] = useState("");
  const [merchant, setMerchant] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [downPayment, setDownPayment] = useState("0");
  const [interestRate, setInterestRate] = useState("0");
  const [rateType, setRateType] = useState<"per_annum" | "flat">("per_annum");
  const [processingFee, setProcessingFee] = useState("0");
  const [totalEmis, setTotalEmis] = useState("");
  const [emiDay, setEmiDay] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [firstEmiDate, setFirstEmiDate] = useState("");
  const [category, setCategory] = useState<string>("other");

  // Platform selection
  const [platforms, setPlatforms] = useState<BnplPlatform[]>([]);
  const [platformId, setPlatformId] = useState<string>("");

  const loadPlatforms = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("bnpl_platforms")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (data) {
      setPlatforms(data as BnplPlatform[]);
      if (data.length > 0 && !platformId) setPlatformId(data[0].id);
    }
  };

  React.useEffect(() => {
    loadPlatforms();
  }, []);

  const applyParsed = (data: ParsedInvoiceData) => {
    setParsed(data);
    setItemName(data.item_name ?? "");
    setOrderId(data.order_id ?? "");
    setMerchant(data.merchant_name ?? "");
    setTotalAmount(data.total_amount != null ? String(data.total_amount) : "");
    setDownPayment(data.down_payment != null ? String(data.down_payment) : "0");
    setInterestRate(data.interest_rate != null ? String(data.interest_rate) : "0");
    setRateType(data.interest_rate_type ?? "per_annum");
    setProcessingFee(data.processing_fee != null ? String(data.processing_fee) : "0");
    setTotalEmis(data.total_emis != null ? String(data.total_emis) : "");
    setEmiDay(data.emi_day_of_month != null ? String(data.emi_day_of_month) : "");
    setPurchaseDate(data.purchase_date ?? "");
    setFirstEmiDate(data.first_emi_date ?? "");
    setCategory(data.item_category ?? "other");
  };

  const pickFile = async (target: "order" | "emi") => {
    try {
      const DocumentPicker = require("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/jpg", "image/png"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];
      if (!file) return;

      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert("Too large", "Max file size is 10 MB");
        return;
      }

      const picked: PickedFile = {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType || "application/octet-stream",
        size: file.size ?? 0,
      };

      if (target === "order") setOrderFile(picked);
      else setEmiFile(picked);
    } catch (err: any) {
      Alert.alert("Picker error", err?.message ?? "Could not open file picker");
    }
  };

  const handleParse = async () => {
    if (!orderFile) {
      Alert.alert("Required", "Please pick the order invoice first");
      return;
    }
    setParsing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Auth error", "Not authenticated");
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

      const formData = new FormData();
      formData.append("order_file", {
        uri: orderFile.uri,
        name: orderFile.name,
        type: orderFile.mimeType,
      } as any);
      if (emiFile) {
        formData.append("emi_file", {
          uri: emiFile.uri,
          name: emiFile.name,
          type: emiFile.mimeType,
        } as any);
      }

      const res = await fetch(`${apiUrl}/api/bnpl/parse-invoice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        Alert.alert("Parse failed", errBody.detail || `HTTP ${res.status}`);
        return;
      }

      const json = await res.json();
      applyParsed(json.data as ParsedInvoiceData);

      if ((json.data as ParsedInvoiceData).warnings?.length > 0) {
        Alert.alert("Review required", (json.data as ParsedInvoiceData).warnings.join("\n"));
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to parse invoice");
    } finally {
      setParsing(false);
    }
  };

  const uploadFile = async (
    file: PickedFile,
    purchaseId: string,
    type: "order_invoice" | "emi_confirmation"
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `${user.id}/${purchaseId}/${ts}-${type}-${safeName}`;

    // Read file as array buffer
    const response = await fetch(file.uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error } = await supabase.storage
      .from("bnpl-invoices")
      .upload(path, arrayBuffer, { contentType: file.mimeType, upsert: false });

    if (error) {
      console.error("Upload failed:", error);
      return null;
    }

    const now = new Date();
    const expires = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
    return {
      path,
      name: file.name,
      type,
      size: file.size,
      uploaded_at: now.toISOString(),
      expires_at: expires.toISOString(),
    };
  };

  const handleSave = async () => {
    if (!platformId) {
      Alert.alert("Required", "Please select a platform");
      return;
    }
    if (!itemName.trim()) {
      Alert.alert("Required", "Item name is required");
      return;
    }
    const total = parseFloat(totalAmount);
    if (!total || total <= 0) {
      Alert.alert("Required", "Enter a valid total amount");
      return;
    }
    const emis = parseInt(totalEmis, 10);
    if (!emis || emis < 1) {
      Alert.alert("Required", "Enter number of EMIs (>= 1)");
      return;
    }
    const day = parseInt(emiDay, 10);
    if (!day || day < 1 || day > 31) {
      Alert.alert("Required", "EMI day must be 1-31");
      return;
    }
    if (!purchaseDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Required", "Purchase date must be YYYY-MM-DD");
      return;
    }
    if (!firstEmiDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Required", "First EMI date must be YYYY-MM-DD");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Auth error", "Not authenticated");
        return;
      }

      const dp = parseFloat(downPayment) || 0;
      const rate = parseFloat(interestRate) || 0;
      const fee = parseFloat(processingFee) || 0;
      const financed = Math.max(0, total - dp);
      const totalInterest =
        rateType === "per_annum" ? (financed * rate * emis) / (12 * 100) : (financed * rate) / 100;
      const totalPayable = financed + totalInterest + fee;
      const emiAmount = emis > 0 ? totalPayable / emis : 0;

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "create_bnpl_purchase_with_schedule",
        {
          p_user_id: user.id,
          p_platform_id: platformId,
          p_item_name: itemName,
          p_item_category: category,
          p_order_id: orderId || null,
          p_merchant_name: merchant || null,
          p_total_amount: total,
          p_down_payment: dp,
          p_interest_rate: rate,
          p_interest_rate_type: rateType,
          p_processing_fee: fee,
          p_total_payable: totalPayable,
          p_emi_amount: emiAmount,
          p_total_emis: emis,
          p_purchase_date: purchaseDate,
          p_first_emi_date: firstEmiDate,
          p_emi_day_of_month: day,
          p_is_business_purchase: false,
          p_notes: parsed?.notes || null,
          p_expense_category: "shopping",
          p_expense_sub_category: itemName,
        }
      );

      if (rpcError) {
        Alert.alert("Save failed", rpcError.message);
        return;
      }

      const purchaseId = (rpcData as { purchase_id?: string } | null)?.purchase_id;

      // Upload invoice files in the background
      if (purchaseId) {
        const uploaded: any[] = [];
        if (orderFile) {
          const meta = await uploadFile(orderFile, purchaseId, "order_invoice");
          if (meta) uploaded.push(meta);
        }
        if (emiFile) {
          const meta = await uploadFile(emiFile, purchaseId, "emi_confirmation");
          if (meta) uploaded.push(meta);
        }
        if (uploaded.length > 0) {
          await supabase
            .from("bnpl_purchases")
            .update({ invoice_files: uploaded })
            .eq("id", purchaseId);
        }
      }

      Alert.alert("Success", "BNPL purchase saved with EMI schedule", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Scan BNPL Invoice</Text>
      <Text style={styles.subtitle}>
        Upload your BNPL order invoice and we&apos;ll extract the details automatically.
      </Text>

      {/* Order file picker */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Order Invoice *</Text>
        <TouchableOpacity
          style={[styles.fileDropzone, orderFile && styles.fileDropzoneFilled]}
          onPress={() => pickFile("order")}
        >
          {orderFile ? (
            <Text style={styles.fileName} numberOfLines={1}>
              📄 {orderFile.name}
            </Text>
          ) : (
            <Text style={styles.fileHint}>Tap to pick order PDF / image</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* EMI file picker */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>EMI Confirmation (optional)</Text>
        <TouchableOpacity
          style={[styles.fileDropzone, emiFile && styles.fileDropzoneFilled]}
          onPress={() => pickFile("emi")}
        >
          {emiFile ? (
            <Text style={styles.fileName} numberOfLines={1}>
              🧾 {emiFile.name}
            </Text>
          ) : (
            <Text style={styles.fileHint}>Screenshot of Pay Later tenure</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Parse button */}
      {!parsed && (
        <TouchableOpacity
          style={[styles.primaryBtn, (!orderFile || parsing) && styles.primaryBtnDisabled]}
          onPress={handleParse}
          disabled={!orderFile || parsing}
        >
          {parsing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>✨ Parse Invoice</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Review fields — shown after parsing */}
      {parsed && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewTitle}>Review & Edit</Text>

          {parsed.warnings.length > 0 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>⚠ Please verify:</Text>
              {parsed.warnings.map((w, i) => (
                <Text key={i} style={styles.warningText}>• {w}</Text>
              ))}
            </View>
          )}

          <LabeledInput label="Platform" value={platforms.find((p) => p.id === platformId)?.name ?? ""} onChangeText={() => {}} editable={false} />
          {platforms.length > 1 && (
            <View style={styles.platformRow}>
              {platforms.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.platformChip, platformId === p.id && styles.platformChipActive]}
                  onPress={() => setPlatformId(p.id)}
                >
                  <Text
                    style={[styles.platformChipText, platformId === p.id && styles.platformChipTextActive]}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <LabeledInput label="Item Name" value={itemName} onChangeText={setItemName} />
          <LabeledInput label="Order ID" value={orderId} onChangeText={setOrderId} />
          <LabeledInput label="Merchant" value={merchant} onChangeText={setMerchant} />
          <LabeledInput label="Total Price (₹)" value={totalAmount} onChangeText={setTotalAmount} keyboardType="numeric" />
          <LabeledInput label="Down Payment (₹)" value={downPayment} onChangeText={setDownPayment} keyboardType="numeric" />
          <LabeledInput label="Interest Rate (%)" value={interestRate} onChangeText={setInterestRate} keyboardType="numeric" />

          <View style={styles.rateTypeRow}>
            <TouchableOpacity
              style={[styles.rateChip, rateType === "per_annum" && styles.rateChipActive]}
              onPress={() => setRateType("per_annum")}
            >
              <Text style={[styles.rateChipText, rateType === "per_annum" && styles.rateChipTextActive]}>
                Per Annum
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rateChip, rateType === "flat" && styles.rateChipActive]}
              onPress={() => setRateType("flat")}
            >
              <Text style={[styles.rateChipText, rateType === "flat" && styles.rateChipTextActive]}>
                Flat
              </Text>
            </TouchableOpacity>
          </View>

          <LabeledInput label="Processing Fee (₹)" value={processingFee} onChangeText={setProcessingFee} keyboardType="numeric" />
          <LabeledInput label="Number of EMIs" value={totalEmis} onChangeText={setTotalEmis} keyboardType="numeric" />
          <LabeledInput label="EMI Day (1-31)" value={emiDay} onChangeText={setEmiDay} keyboardType="numeric" />
          <LabeledInput label="Purchase Date (YYYY-MM-DD)" value={purchaseDate} onChangeText={setPurchaseDate} />
          <LabeledInput label="First EMI Date (YYYY-MM-DD)" value={firstEmiDate} onChangeText={setFirstEmiDate} />

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save Purchase</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "numeric" | "default";
  editable?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: "500", marginBottom: 8 },
  fileDropzone: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
  },
  fileDropzoneFilled: { borderStyle: "solid", backgroundColor: "#eff6ff", borderColor: "#93c5fd" },
  fileHint: { fontSize: 13, color: "#9ca3af" },
  fileName: { fontSize: 13, color: "#1e40af", fontWeight: "500" },
  primaryBtn: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  reviewSection: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  reviewTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  warningBox: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  warningTitle: { fontSize: 13, fontWeight: "600", color: "#92400e", marginBottom: 4 },
  warningText: { fontSize: 12, color: "#92400e", marginBottom: 2 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: "500", color: "#374151", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  inputDisabled: { backgroundColor: "#f3f4f6", color: "#6b7280" },
  platformRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  platformChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  platformChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  platformChipText: { fontSize: 12, color: "#374151" },
  platformChipTextActive: { color: "#fff" },
  rateTypeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  rateChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  rateChipActive: { backgroundColor: "#eff6ff", borderColor: "#3b82f6" },
  rateChipText: { fontSize: 13, color: "#6b7280" },
  rateChipTextActive: { color: "#1e40af", fontWeight: "500" },
});
