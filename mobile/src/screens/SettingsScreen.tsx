import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";

const STATUS_LABELS: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  disconnected: "Disconnected",
};

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { isDark, colors, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
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

  const STATUS_COLORS: Record<string, string> = {
    connected: colors.income,
    connecting: colors.warning,
    disconnected: colors.expense,
  };

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
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageHeader title="Settings" eyebrow="Preferences & account" />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: navHeight + 40 + insets.bottom,
          paddingHorizontal: 24,
        }}
      >
        {/* Profile Section */}
        <Text
          style={[
            typography.pillLabel,
            { color: colors.textSecondary, marginTop: 8, marginBottom: 8 },
          ]}
        >
          PROFILE
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={[styles.avatarText, { color: colors.surface }]}>
                {(userName || userEmail || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text
                style={[
                  typography.sectionTitle,
                  { color: colors.textPrimary },
                ]}
              >
                {userName || "User"}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textSecondary, marginTop: 2 },
                ]}
              >
                {userEmail}
              </Text>
              <Text
                style={[
                  typography.captionRegular,
                  { color: colors.textSecondary, marginTop: 2 },
                ]}
              >
                Currency: INR
              </Text>
            </View>
          </View>
        </View>

        {/* Sync Section */}
        <Text
          style={[
            typography.pillLabel,
            { color: colors.textSecondary, marginTop: 24, marginBottom: 8 },
          ]}
        >
          SYNC
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.syncRow}>
            <View
              style={[
                styles.syncDot,
                { backgroundColor: STATUS_COLORS[connectionStatus] },
              ]}
            />
            <View style={styles.syncInfo}>
              <Text
                style={[typography.body, { color: colors.textPrimary, fontWeight: "600" }]}
              >
                {STATUS_LABELS[connectionStatus]}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textSecondary, marginTop: 2 },
                ]}
              >
                Last synced: {syncTimeText}
              </Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={({ pressed }) => [
              styles.syncBtn,
              {
                backgroundColor:
                  lastSyncedAt &&
                  Date.now() - lastSyncedAt.getTime() > 3_600_000
                    ? colors.warning
                    : colors.accent,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            onPress={syncNow}
          >
            <Text style={[typography.body, { color: colors.surface, fontWeight: "700" }]}>
              Sync Now
            </Text>
          </Pressable>
        </View>

        {/* Preferences Section */}
        <Text
          style={[
            typography.pillLabel,
            { color: colors.textSecondary, marginTop: 24, marginBottom: 8 },
          ]}
        >
          PREFERENCES
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Pressable
            style={styles.actionItem}
            onPress={() => navigation.navigate("CreditCards")}
          >
            <Text style={styles.actionIcon}>💳</Text>
            <Text style={[typography.body, { color: colors.textPrimary, fontSize: 16 }]}>
              Credit Cards
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.actionItem}>
            <Text style={styles.actionIcon}>🌙</Text>
            <Text
              style={[
                typography.body,
                { color: colors.textPrimary, fontSize: 16, flex: 1 },
              ]}
            >
              Dark Mode
            </Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={isDark ? colors.accent : colors.surfaceAlt}
            />
          </View>
        </View>

        {/* Notifications Section */}
        <Text
          style={[
            typography.pillLabel,
            { color: colors.textSecondary, marginTop: 24, marginBottom: 8 },
          ]}
        >
          NOTIFICATIONS
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.actionItem}>
            <Text style={styles.actionIcon}>🔔</Text>
            <Text
              style={[
                typography.body,
                { color: colors.textPrimary, fontSize: 16, flex: 1 },
              ]}
            >
              Payment Reminders
            </Text>
            <Switch
              value={remindersEnabled}
              onValueChange={(val) => {
                setRemindersEnabled(val);
                saveNotifPreference(val, reminderDays);
              }}
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={remindersEnabled ? colors.accent : colors.surfaceAlt}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.actionItem}>
            <Text style={styles.actionIcon}>📅</Text>
            <Text
              style={[
                typography.body,
                { color: colors.textPrimary, fontSize: 16, flex: 1 },
              ]}
            >
              Remind before (days)
            </Text>
            <View
              style={[
                notifStyles.daysInput,
                { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Pressable
                style={notifStyles.daysBtn}
                disabled={!remindersEnabled || reminderDays <= 1}
                onPress={() => {
                  const newDays = Math.max(1, reminderDays - 1);
                  setReminderDays(newDays);
                  saveNotifPreference(remindersEnabled, newDays);
                }}
              >
                <Text
                  style={[
                    notifStyles.daysBtnText,
                    { color: colors.accent },
                  ]}
                >
                  -
                </Text>
              </Pressable>
              <Text
                style={[
                  notifStyles.daysValue,
                  {
                    color: remindersEnabled
                      ? colors.textPrimary
                      : colors.textTertiary,
                  },
                ]}
              >
                {reminderDays}
              </Text>
              <Pressable
                style={notifStyles.daysBtn}
                disabled={!remindersEnabled || reminderDays >= 30}
                onPress={() => {
                  const newDays = Math.min(30, reminderDays + 1);
                  setReminderDays(newDays);
                  saveNotifPreference(remindersEnabled, newDays);
                }}
              >
                <Text
                  style={[
                    notifStyles.daysBtnText,
                    { color: colors.accent },
                  ]}
                >
                  +
                </Text>
              </Pressable>
            </View>
          </View>
          <Text
            style={[
              typography.captionRegular,
              { color: colors.textTertiary, marginTop: 8 },
            ]}
          >
            You'll see reminders for EMI payments due within {reminderDays} day
            {reminderDays === 1 ? "" : "s"}.
          </Text>
        </View>

        {/* Actions Section */}
        <Text
          style={[
            typography.pillLabel,
            { color: colors.textSecondary, marginTop: 24, marginBottom: 8 },
          ]}
        >
          ACTIONS
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Pressable
            style={styles.actionItem}
            onPress={async () => {
              try {
                const { data, error } = await supabase.rpc(
                  "generate_recurring_entries"
                );
                if (error) throw error;
                const count = (data as any)?.entries_created ?? 0;
                if (count > 0) {
                  Alert.alert(
                    "Done",
                    `${count} recurring ${count === 1 ? "entry" : "entries"} generated`
                  );
                } else {
                  Alert.alert("All caught up", "No recurring entries due today");
                }
              } catch (err: any) {
                Alert.alert(
                  "Error",
                  err.message || "Failed to generate recurring entries"
                );
              }
            }}
          >
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={[typography.body, { color: colors.textPrimary, fontSize: 16 }]}>
              Generate Recurring Entries
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable style={styles.actionItem} onPress={handleExportData}>
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={[typography.body, { color: colors.textPrimary, fontSize: 16 }]}>
              Export Data
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable style={styles.actionItem} onPress={handleChangePassword}>
            <Text style={styles.actionIcon}>🔑</Text>
            <Text style={[typography.body, { color: colors.textPrimary, fontSize: 16 }]}>
              Change Password
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable style={styles.actionItem} onPress={handleLogout}>
            <Text style={styles.actionIcon}>🚪</Text>
            <Text style={[typography.body, { color: colors.textPrimary, fontSize: 16 }]}>
              Log Out
            </Text>
          </Pressable>
        </View>

        {/* Danger Zone */}
        <Text
          style={[
            typography.pillLabel,
            { color: colors.expense, marginTop: 24, marginBottom: 8 },
          ]}
        >
          DANGER ZONE
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.expense,
              borderWidth: 1,
            },
          ]}
        >
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginBottom: 12 },
            ]}
          >
            Permanently delete your account and all associated data. This cannot
            be undone.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.deleteBtn,
              {
                backgroundColor: colors.expense,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            onPress={handleDeleteAccount}
          >
            <Text style={[typography.body, { color: colors.surface, fontWeight: "700" }]}>
              Delete Account
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 16,
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: { fontSize: 24, fontWeight: "bold" },
  profileInfo: { flex: 1 },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  actionIcon: { fontSize: 20, marginRight: 12 },
  divider: { height: 1 },
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
  syncBtn: {
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  deleteBtn: {
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
});

const notifStyles = StyleSheet.create({
  daysInput: {
    flexDirection: "row",
    alignItems: "center",
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
  },
  daysValue: {
    fontSize: 16,
    fontWeight: "700",
    minWidth: 28,
    textAlign: "center",
  },
});
