package expo.modules.smsreader

import android.content.ContentResolver
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsReaderModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("SmsReader")

        AsyncFunction("readSms") { minDate: Long ->
            val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any?>>()
            val resolver: ContentResolver = context.contentResolver
            val messages = mutableListOf<Map<String, Any?>>()

            val uri = Uri.parse("content://sms/inbox")
            val projection = arrayOf("_id", "address", "body", "date", "type")
            val selection = if (minDate > 0) "date >= ?" else null
            val selectionArgs = if (minDate > 0) arrayOf(minDate.toString()) else null

            var cursor: Cursor? = null
            try {
                cursor = resolver.query(uri, projection, selection, selectionArgs, "date DESC")
                if (cursor != null && cursor.moveToFirst()) {
                    val idIdx = cursor.getColumnIndex("_id")
                    val addressIdx = cursor.getColumnIndex("address")
                    val bodyIdx = cursor.getColumnIndex("body")
                    val dateIdx = cursor.getColumnIndex("date")
                    val typeIdx = cursor.getColumnIndex("type")

                    do {
                        val msg = mapOf<String, Any?>(
                            "_id" to (if (idIdx >= 0) cursor.getString(idIdx) else ""),
                            "address" to (if (addressIdx >= 0) cursor.getString(addressIdx) else ""),
                            "body" to (if (bodyIdx >= 0) cursor.getString(bodyIdx) else ""),
                            "date" to (if (dateIdx >= 0) cursor.getLong(dateIdx) else 0L),
                            "type" to (if (typeIdx >= 0) cursor.getInt(typeIdx) else 0)
                        )
                        messages.add(msg)
                    } while (cursor.moveToNext())
                }
            } finally {
                cursor?.close()
            }

            return@AsyncFunction messages
        }
    }
}
