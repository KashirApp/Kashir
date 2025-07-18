package com.kashir.android

import android.app.Activity
import android.content.ContentResolver
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

@ReactModule(name = IntentLauncherModule.NAME)
class IntentLauncherModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private val pendingPromises = ConcurrentHashMap<Int, Promise>()
    private val nextRequestCode = AtomicInteger(1000)

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String {
        return NAME
    }

    override fun onActivityResult(
        activity: Activity?,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        val promise = pendingPromises.remove(requestCode) ?: return
        
        try {
            val result = Arguments.createMap().apply {
                putInt("resultCode", resultCode)
                putString("data", data?.dataString ?: "")
                putMap("extra", createExtrasMap(data))
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("RESULT_ERROR", "Failed to process activity result: ${e.message}")
        }
    }

    private fun createExtrasMap(data: Intent?): WritableMap {
        val extraMap = Arguments.createMap()
        data?.extras?.let { extras ->
            for (key in extras.keySet()) {
                // Use type-safe getters instead of deprecated get()
                when {
                    extras.getString(key) != null -> {
                        extraMap.putString(key, extras.getString(key))
                    }
                    // Check for boolean values
                    extras.containsKey(key) -> {
                        try {
                            val boolValue = extras.getBoolean(key)
                            extraMap.putBoolean(key, boolValue)
                        } catch (e: ClassCastException) {
                            try {
                                val intValue = extras.getInt(key)
                                extraMap.putInt(key, intValue)
                            } catch (e: ClassCastException) {
                                try {
                                    val doubleValue = extras.getDouble(key)
                                    extraMap.putDouble(key, doubleValue)
                                } catch (e: ClassCastException) {
                                    try {
                                        val floatValue = extras.getFloat(key)
                                        extraMap.putDouble(key, floatValue.toDouble())
                                    } catch (e: ClassCastException) {
                                        try {
                                            val longValue = extras.getLong(key)
                                            extraMap.putDouble(key, longValue.toDouble())
                                        } catch (e: ClassCastException) {
                                            // Fallback to empty string if we can't determine type
                                            extraMap.putString(key, "")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return extraMap
    }

    override fun onNewIntent(intent: Intent?) {
        // Not used for this implementation
    }
    
    @ReactMethod
    fun startActivity(options: ReadableMap, promise: Promise) {
        try {
            val intent = Intent().apply {
                // Set action
                if (options.hasKey("action")) {
                    action = options.getString("action")
                }
                
                // Set data URI
                if (options.hasKey("data")) {
                    data = Uri.parse(options.getString("data"))
                }
                
                // Set package name
                if (options.hasKey("packageName")) {
                    setPackage(options.getString("packageName"))
                }
                
                // Set extra data
                addExtrasToIntent(this, options)
            }
            
            val currentActivity = currentActivity
            if (currentActivity != null) {
                val requestCode = nextRequestCode.getAndIncrement()
                pendingPromises[requestCode] = promise
                currentActivity.startActivityForResult(intent, requestCode)
            } else {
                promise.reject("NO_ACTIVITY", "No current activity available")
            }
        } catch (e: Exception) {
            promise.reject("INTENT_ERROR", "Failed to start activity: ${e.message}")
        }
    }

    private fun addExtrasToIntent(intent: Intent, options: ReadableMap) {
        if (!options.hasKey("extra")) return
        
        val extras = options.getMap("extra") ?: return
        val iterator = extras.keySetIterator()
        
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            val value = extras.getDynamic(key)
            when (value.type) {
                ReadableType.String -> intent.putExtra(key, value.asString())
                ReadableType.Boolean -> intent.putExtra(key, value.asBoolean())
                ReadableType.Number -> {
                    val numberValue = value.asDouble()
                    // Check if it's an integer value
                    if (numberValue % 1 == 0.0) {
                        intent.putExtra(key, numberValue.toInt())
                    } else {
                        intent.putExtra(key, numberValue)
                    }
                }
                ReadableType.Null -> intent.putExtra(key, "")
                else -> intent.putExtra(key, value.asString())
            }
        }
    }
    
    @ReactMethod
    fun queryContentResolver(
        uri: String,
        projection: ReadableArray?,
        selection: String?,
        selectionArgs: ReadableArray?,
        promise: Promise
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val result = performContentResolverQuery(uri, projection, selection, selectionArgs)
                
                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CONTENT_RESOLVER_ERROR", "Failed to query content resolver: ${e.message}", e)
                }
            }
        }
    }
    
    private suspend fun performContentResolverQuery(
        uriString: String,
        projection: ReadableArray?,
        selection: String?,
        selectionArgs: ReadableArray?
    ): WritableMap {
        return withContext(Dispatchers.IO) {
            val contentResolver: ContentResolver = reactContext.contentResolver
            val uri = Uri.parse(uriString)
            
            // Convert ReadableArray to String arrays
            val projectionArray = projection?.let { array ->
                Array(array.size()) { i -> array.getString(i) }
            }
            
            val result = Arguments.createMap()
            
            try {
                // Content resolver query format: projection contains the data, selection is "1", selectionArgs is null
                val cursor = contentResolver.query(
                    uri,
                    projectionArray,  // This contains [event, "", currentUser] 
                    selection,        // This is "1"
                    null,            // selectionArgs is always null
                    null             // sortOrder is always null
                )
                
                cursor?.use { c ->
                    if (c.moveToFirst()) {
                        // Get all column names and their values
                        val columnNames = c.columnNames
                        
                        // Response handling: Look for specific columns
                        val eventColumn = c.getColumnIndex("event")
                        val rejectedColumn = c.getColumnIndex("rejected")
                        val signatureColumn = c.getColumnIndex("signature")
                        
                        if (rejectedColumn >= 0) {
                            result.putString("rejected", "true")
                        } else if (eventColumn >= 0) {
                            val eventValue = c.getString(eventColumn)
                            result.putString("event", eventValue)
                        } else if (signatureColumn >= 0) {
                            val signatureValue = c.getString(signatureColumn)
                            result.putString("signature", signatureValue)
                        }
                        
                        // Also add all columns for debugging
                        for (columnName in columnNames) {
                            val columnIndex = c.getColumnIndex(columnName)
                            if (columnIndex != -1) {
                                val value = c.getString(columnIndex)
                                if (!result.hasKey(columnName)) {
                                    result.putString(columnName, value)
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                // Silent failure
            }
            
            result
        }
    }
    
    @ReactMethod
    fun isAppInstalled(packageName: String, promise: Promise) {
        try {
            reactContext.packageManager.getPackageInfo(packageName, PackageManager.GET_ACTIVITIES)
            promise.resolve(true)
        } catch (e: PackageManager.NameNotFoundException) {
            promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("PACKAGE_ERROR", "Error checking package: ${e.message}")
        }
    }

    override fun invalidate() {
        reactContext.removeActivityEventListener(this)
        pendingPromises.clear()
    }

    companion object {
        const val NAME = "IntentLauncher"
    }
}