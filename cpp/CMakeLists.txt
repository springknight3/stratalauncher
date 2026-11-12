cmake_minimum_required(VERSION 3.25)

project(StrataLauncher VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# The frozen Qt Quick frontend is kept as a buildable fallback. Disable with
# -DSTRATA_BUILD_LEGACY_QML=OFF for a headless strata-core-only build (note:
# the Qt-era test binaries that exercise QML still require the Qml components).
option(STRATA_BUILD_LEGACY_QML "Build the frozen Qt Quick fallback UI" ON)

find_package(Qt6 6.8 REQUIRED COMPONENTS Core Network Test WebSockets)
if(STRATA_BUILD_LEGACY_QML)
    find_package(Qt6 6.8 REQUIRED COMPONENTS Gui Qml Quick QuickControls2)
endif()
qt_policy(SET QTP0001 NEW)
include(CTest)

add_subdirectory(core)
if(STRATA_BUILD_LEGACY_QML)
    add_subdirectory(legacy-qml)
endif()
add_subdirectory(app)
add_subdirectory(tests)
