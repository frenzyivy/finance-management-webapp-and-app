import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { useTheme } from "../lib/theme-context";

const STATUS_COLORS: Record<string, string> = {
  connected: "#22c55e",
  connecting: "#f59e0b",
  disconnected: "#f87171",
};

const STATUS_LABELS: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  disconnected: "Disconnected",
};

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { isDark, toggleTheme } = useTheme();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const { connectionStatus, lastSyncedAt, syncNow } = useSyncStore();
  const [syncTimeText, setSyncTimeText] = useState("");

  // Notification preferences
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState(5);
  const [notifPrefsLoaded, setNotifPrefsLoaded] = useState(false);
  const [hasNotifRow, setHasNotifRow] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!lastSyncedAt) {
      setSyncTimeText("Never synced");
      return;
    }
    const update = () => {
      setSyncTimeText(formatDistanceToNow(lastSyncedAt, { addSuffix: true }));
    };
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [lastSyncedAt]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, currency")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserName(profile.name || "");
      }

      // Load notification preferences
      const { data: notifPrefs } = await supabase
        .from("notification_preferences")
        .select("reminder_days_before, reminders_enabled")
        .eq("user_id", user.id)
        .single();

      if (notifPrefs) {
        setRemindersEnabled(notifPrefs.reminders_enabled);
        setReminderDays(notifPrefs.reminder_days_before);
        setHasNotifRow(true);
      }
      setNotifPrefsLoaded(true);
    } catch (err) {
      // Silently fail - profile may not exist yet
    } finally {
      setLoading(false);
    }
  };

  const saveNotifPreference = async (enabled: boolean, days: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        reminder_days_before: days,
        reminders_enabled: enabled,
        updated_at: new Date().toISOString(),
      };

      if (hasNotifRow) {
        await supabase
          .from("notification_preferences")
          .update(payload)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("notification_preferences")
          .insert({ ...payload, user_id: user.id });
        setHasNotifRow(true);
      }
    } catch (err: any) {
      Alert.alert("Error", "Failed to save notification preferences");
    }
  };

  const arrayToCSV = (headers: string[], rows: string[][]): string => {
    const escape = (val: string) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.map(escape).join(",")];
    for (const row of rows) {
      lines.push(row.map(escape).join(","));
    }
    return lines.join("\n");
  };

  const exportCSV = async (filename: string, csv: string) => {
    try {
      const FileSystem = await import("expo-file-system");
      const Sharing = await import("expo-sharing");

      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: `Export ${filename}`,
        });
      } else {
        Alert.alert("Exported", `File saved to ${fileUri}`);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to export");
    }
  };

  const handleExportData = async () => {
    Alert.alert("Export Data", "What would you like to export?", [
      {
        text: "Income",
        onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data } = await supabase.from("income_entries").select("*").eq("user_id", user.id);
          if (!data?.length) { Alert.alert("No Data", "No income entries to export"); return; }
          const csv = arrayToCSV(
            ["Date", "Amount", "Category", "Source", "Payment Method", "Recurring", "Notes"],
            data.map((e) => [e.date, String(e.amount), e.category, e.source_name ?? "", e.payment_method ?? "", String(e.is_recurring), e.notes ?? ""])
          );
          exportCSV("komalfin-income.csv", csv);
        },
      },
      {
        text: "Expenses",
        onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data } = await supabase.from("expense_entries").select("*").eq("user_id", user.id);
          if (!data?.length) { Alert.alert("No Data", "No expense entries to export"); return; }
          const csv = arrayToCSV(
            ["Date", "Amount", "Category", "Payee", "Payment Method", "Recurring", "Notes"],
            data.map((e) => [e.date, String(e.amount), e.category, e.payee_name ?? "", e.payment_method ?? "", String(e.is_recurring), e.notes ?? ""])
          );
          exportCSV("komalfin-expenses.csv", csv);
        },
      },
      {
        text: "All Data",
        onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const [incRes, expRes, goalRes, debtRes] = await Promise.all([
            supabase.from("income_entries").select("*").eq("user_id", user.id),
            supabase.from("expense_entries").select("*").eq("user_id", user.id),
            supabase.from("savings_goals").select("*").eq("user_id", user.id),
            supabase.from("debts").select("*").eq("user_id", user.id),
          ]);
          const lines: string[] = [];
          lines.push("=== INCOME ===");
          lines.push(arrayToCSV(
            ["Date", "Amount", "Category", "Source"],
            (incRes.data ?? []).map((e) => [e.date, String(e.amount), e.category, e.source_name ?? ""])
          ));
          lines.push("\n=== EXPENSES ===");
          lines.push(arrayToCSV(
            ["Date", "Amount", "Category", "Payee"],
            (expRes.data ?? []).map((e) => [e.date, String(e.amount), e.category, e.payee_name ?? ""])
          ));
          lines.push("\n=== GOALS ===");
          lines.push(arrayToCSV(
            ["Name", "Target", "Current", "Status", "Priority"],
            (goalRes.data ?? []).map((g) => [g.name, String(g.target_amount), String(g.current_balance ?? 0), g.status, g.priority])
          ));
          lines.push("\n=== DEBTS ===");
          lines.push(arrayToCSV(
            ["Name", "Type", "Original", "Outstanding", "Status"],
            (debtRes.data ?? []).map((d) => [d.name, d.type, String(d.original_amount ?? d.principal_amount ?? 0), String(d.outstanding_balance ?? d.current_balance ?? 0), d.status])
          ));
          exportCSV("komalfin-all-data.csv", lines.join("\n"));
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleChangePassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail);
      if (error) throw error;
      Alert.alert("Success", "Password reset email sent. Check your inbox.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send reset email");
    }
  };

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete all your data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              // Delete all user data from all tables
              await Promise.all([
                supabase.from("savings_contributions").delete().eq("user_id", user.id),
                supabase.from("debt_payments").delete().eq("user_id", user.id),
              ]);

              await Promise.all([
                supabase.from("income_entries").delete().eq("user_id", user.id),
                supabase.from("expense_entries").delete().eq("user_id", user.id),
                supabase.from("savings_goals").delete().eq("user_id", user.id),
                supabase.from("debts").delete().eq("user_id", user.id),
                supabase.from("budget_limits").delete().eq("user_id", user.id),
                supabase.from("credit_cards").delete().eq("user_id", user.id),
                supabase.from("profiles").delete().eq("id", user.id),
              ]);

              await supabase.auth.signOut();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete account");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Section */}
      <Text style={styles.sectionHeader}>Profile</Text>
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(userName || userEmail || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName || "User"}</Text>
            <Text style={styles.profileEmail}>{userEmail}</Text>
            <Text style={styles.profileCurrency}>Currency: INR</Text>
          </View>
        </View>
      </View>

      {/* Sync Section */}
      <Text style={styles.sectionHeader}>Sync</Text>
      <View style={styles.card}>
        <View style={styles.syncRow}>
          <View
            style={[
              styles.syncDot,
              { backgroundColor: STATUS_COLORS[connectionStatus] },
            ]}
          />
          <View style={styles.syncInfo}>
            <Text style={styles.syncStatusText}>
              {STATUS_LABELS[connectionStatus]}
            </Text>
            <Text style={styles.syncTimeText}>
              Last synced: {syncTimeText}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity
          style={[
            styles.syncBtn,
            lastSyncedAt &&
              Date.now() - lastSyncedAt.getTime() > 3_600_000 && {
                backgroundColor: "#f59e0b",
              },
          ]}
          onPress={syncNow}
        >
          <Text style={styles.syncBtnText}>Sync Now</Text>
        </TouchableOpacity>
      </View>

      {/* Preferences Section */}
      <Text style={styles.sectionHeader}>Preferences</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate("CreditCards")}
        >
          <Text style={styles.actionIcon}>💳</Text>
          <Text style={styles.actionText}>Credit Cards</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <View style={styles.actionItem}>
          <Text style={styles.actionIcon}>🌙</Text>
          <Text style={[styles.actionText, { flex: 1 }]}>Dark Mode</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: "#d1d5db", true: "#99f6e4" }}
            thumbColor={isDark ? "#0d9488" : "#f4f4f5"}
          />
        </View>
      </View>

      {/* Notifications Section */}
      <Text style={styles.sectionHeader}>Notifications</Text>
      <View style={styles.card}>
        <View style={styles.actionItem}>
          <Text style={styles.actionIcon}>🔔</Text>
          <Text style={[styles.actionText, { flex: 1 }]}>Payment Reminders</Text>
          <Switch
            value={remindersEnabled}
            onValueChange={(val) => {
              setRemindersEnabled(val);
              saveNotifPreference(val, reminderDays);
            }}
            trackColor={{ false: "#d1d5db", true: "#99f6e4" }}
            thumbColor={remindersEnabled ? "#0d9488" : "#f4f4f5"}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.actionItem}>
          <Text style={styles.actionIcon}>📅</Text>
          <Text style={[styles.actionText, { flex: 1 }]}>Remind before (days)</Text>
          <View style={notifStyles.daysInput}>
            <TouchableOpacity
              style={notifStyles.daysBtn}
              disabled={!remindersEnabled || reminderDays <= 1}
              onPress={() => {
                const newDays = Math.max(1, reminderDays - 1);
                setReminderDays(newDays);
                saveNotifPreference(remindersEnabled, newDays);
              }}
            >
              <Text style={notifStyles.daysBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={[notifStyles.daysValue, !remindersEnabled && { color: "#9ca3af" }]}>
              {reminderDays}
            </Text>
            <TouchableOpacity
              style={notifStyles.daysBtn}
              disabled={!remindersEnabled || reminderDays >= 30}
              onPress={() => {
                const newDays = Math.min(30, reminderDays + 1);
                setReminderDays(newDays);
                saveNotifPreference(remindersEnabled, newDays);
              }}
            >
              <Text style={notifStyles.daysBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={notifStyles.hint}>
          You'll see reminders for EMI payments due within {reminderDays} day{reminderDays === 1 ? "" : "s"}.
        </Text>
      </View>

      {/* Actions Section */}
      <Text style={styles.sectionHeader}>Actions</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={async () => {
            try {
              const { data, error } = await supabase.rpc("generate_recurring_entries");
              if (error) throw error;
              const count = (data as any)?.entries_created ?? 0;
              if (count > 0) {
                Alert.alert("Done", `${count} recurring ${count === 1 ? "entry" : "entries"} generated`);
              } else {
                Alert.alert("All caught up", "No recurring entries due today");
              }
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to generate recurring entries");
            }
          }}
        >
          <Text style={styles.actionIcon}>🔄</Text>
          <Text style={styles.actionText}>Generate Recurring Entries</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionItem} onPress={handleExportData}>
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionText}>Export Data</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionItem} onPress={handleChangePassword}>
          <Text style={styles.actionIcon}>🔑</Text>
          <Text style={styles.actionText}>Change Password</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
          <Text style={styles.actionIcon}>🚪</Text>
          <Text style={styles.actionText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <Text style={[styles.sectionHeader, { color: "#f87171" }]}>Danger Zone</Text>
      <View style={[styles.card, { borderColor: "#fca5a5", borderWidth: 1 }]}>
        <Text style={styles.dangerDesc}>
          Permanently delete your account and all associated data. This cannot be undone.
        </Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0d9488",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "bold", color: "#1f2937" },
  profileEmail: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  profileCurrency: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  actionIcon: { fontSize: 20, marginRight: 12 },
  actionText: { fontSize: 16, color: "#1f2937" },
  divider: { height: 1, backgroundColor: "#e5e7eb" },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  syncDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  syncInfo: { flex: 1 },
  syncStatusText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
  },
  syncTimeText: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  syncBtn: {
    backgroundColor: "#0d9488",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  syncBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  dangerDesc: { fontSize: 14, color: "#6b7280", marginBottom: 12 },
  deleteBtn: {
    backgroundColor: "#f87171",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});

const notifStyles = StyleSheet.create({
  daysInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
  },
  daysBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  daysBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0d9488",
  },
  daysValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    minWidth: 28,
    textAlign: "center",
  },
  hint: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 8,
  },
});
