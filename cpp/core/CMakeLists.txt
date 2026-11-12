add_library(strata_core STATIC
    auth/AccountManager.cpp
    auth/CredentialStore.cpp
    auth/MicrosoftAuth.cpp
    auth/OfflineAccountStore.cpp
    modrinth/ContentManager.cpp
    modrinth/ContentType.cpp
    modrinth/ModrinthClient.cpp
    loader/LoaderInstaller.cpp
    server/DevServerManager.cpp
    server/ServerProcess.cpp
    launch/GameLauncher.cpp
    launch/GameProcess.cpp
    Paths.cpp
    ThemeSettings.cpp
    mojang/MojangManifestClient.cpp
    mojang/MinecraftInstaller.cpp
    download/DownloadManager.cpp
    runtime/JavaRuntimeManager.cpp
    instance/Instance.cpp
    instance/InstanceImporter.cpp
    instance/InstanceManager.cpp
    ipc/IpcServer.cpp
    ipc/ControllerIpc.cpp
    controllers/LauncherController.cpp
    controllers/content/ContentController.cpp
    controllers/settings/InstanceSettingsController.cpp
    settings/MinecraftControls.cpp
    settings/MinecraftOptionValues.cpp
    settings/InstanceSettings.cpp
    settings/LauncherSettings.cpp
    settings/NbtFile.cpp
    settings/OptionsFile.cpp
    settings/ServerListStore.cpp
    logging/LauncherLogging.cpp
)

find_package(LibArchive REQUIRED)
find_package(Qt6Keychain CONFIG REQUIRED)
find_package(ZLIB REQUIRED)

target_include_directories(strata_core
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/controllers
)

target_link_libraries(strata_core
    PUBLIC
        Qt6::Core
        Qt6::Network
        Qt6::WebSockets
        LibArchive::LibArchive
        ZLIB::ZLIB
        Qt6Keychain::Qt6Keychain)

if(WIN32)
    target_link_libraries(strata_core PRIVATE Psapi)
endif()
