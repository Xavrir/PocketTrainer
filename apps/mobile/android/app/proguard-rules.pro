# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# react-native-config reflects over the application's BuildConfig fields at
# runtime. R8 cannot discover that access statically, so keep this one class and
# its public configuration constants in optimized release builds.
-keep class com.pockettrainer.BuildConfig { *; }
