package com.kashir.android

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.*

class AmberModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val AMBER_PACKAGE_NAME = "com.greenart7c3.nostrsigner"
        private const val AMBER_REQUEST_CODE = 1001
    }
    
    private var promise: Promise? = null

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, intent: Intent?) {
            if (requestCode == AMBER_REQUEST_CODE) {
                promise?.let { p ->
                    when {
                        resultCode == Activity.RESULT_OK && intent != null -> {
                            val result = intent.getStringExtra("result")
                            if (result != null) {
                                p.resolve(result)
                            } else {
                                p.reject("NO_RESULT", "No result received from Amber")
                            }
                        }
                        else -> {
                            p.reject("USER_CANCELLED", "User cancelled or operation failed")
                        }
                    }
                    promise = null
                }
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    override fun getName(): String = "AmberModule"

    @ReactMethod
    fun getPublicKey(permissions: String, promise: Promise) {
        val currentActivity = currentActivity
        if (currentActivity == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }

        this.promise = promise

        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:")).apply {
                setPackage(AMBER_PACKAGE_NAME)
                putExtra("type", "get_public_key")
                putExtra("permissions", permissions)
            }
            
            currentActivity.startActivityForResult(intent, AMBER_REQUEST_CODE)
        } catch (e: Exception) {
            this.promise = null
            promise.reject("AMBER_ERROR", "Failed to launch Amber: ${e.message}")
        }
    }
}