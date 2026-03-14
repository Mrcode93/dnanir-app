package com.mrcodeiq.dinar

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews

class DnanirWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.widget_layout)

        // Read data from Shared Preferences
        val prefs = context.getSharedPreferences("group.com.mrcodeiq.dinar", Context.MODE_PRIVATE)
        val balance = prefs.getString("widget_balance", "0")
        val currency = prefs.getString("widget_currency", "IQD")
        val isPrivate = prefs.getString("privacy_mode", "false") == "true"
        val themeMode = prefs.getString("widget_theme_mode", "system")
        
        // Determine if we should use dark theme
        val isDark = when (themeMode) {
            "dark" -> true
            "light" -> false
            else -> {
                val nightModeFlags = context.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK
                nightModeFlags == android.content.res.Configuration.UI_MODE_NIGHT_YES
            }
        }

        // Apply theme-specific colors
        if (isDark) {
            views.setInt(R.id.widget_container, "setBackgroundResource", R.drawable.widget_bg)
            views.setTextColor(R.id.widget_app_name, Color.WHITE)
            views.setTextColor(R.id.widget_balance, Color.WHITE)
            views.setTextColor(R.id.widget_balance_label, Color.parseColor("#66FFFFFF"))
        } else {
            views.setInt(R.id.widget_container, "setBackgroundColor", Color.parseColor("#F5F7F9"))
            views.setTextColor(R.id.widget_app_name, Color.BLACK)
            views.setTextColor(R.id.widget_balance, Color.BLACK)
            views.setTextColor(R.id.widget_balance_label, Color.parseColor("#66000000"))
        }

        // Update values
        views.setTextViewText(R.id.widget_balance, if (isPrivate) "****" else balance)
        views.setTextViewText(R.id.widget_balance_label, "$currency / الرصيد")

        // Intents
        views.setOnClickPendingIntent(R.id.btn_add_expense, getPendingSelfIntent(context, "dnanir://add-expense"))
        views.setOnClickPendingIntent(R.id.btn_add_income, getPendingSelfIntent(context, "dnanir://add-income"))
        views.setOnClickPendingIntent(R.id.btn_smart_add, getPendingSelfIntent(context, "dnanir://smart-add"))

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun getPendingSelfIntent(context: Context, uriString: String): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uriString))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        
        val flags = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        
        return PendingIntent.getActivity(context, uriString.hashCode(), intent, flags)
    }
}
