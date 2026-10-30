# Reglas de R8 (la compilación release encoge y renombra el código Java; las reglas de AGP y las de cada librería
# van aparte, estas son solo lo nuestro). Este archivo está fuera de src/: no cambia la huella nativa.

# El puente con la web: la web llama a FantasyApp.<método> por su nombre, así que los métodos con
# @JavascriptInterface no se renombran ni se quitan, y la anotación se queda (Android la mira al llamarlos).
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-keep class es.fantasymanager.app.Puente {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Los errores que llegan a la web con e.getClass().getSimpleName() (Red, AlDia, Puente, Actualizador): que
# salga el nombre de verdad de la excepción, no uno renombrado.
-keepnames class * extends java.lang.Throwable

# Números de línea en los fallos de Java; el mapping (para traducir los nombres) va dentro del AAB y Play lo usa
# solo. El de cada compilación también se guarda en los artefactos de la Action.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
