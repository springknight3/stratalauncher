qt_add_executable(strata-core
    main.cpp
)

target_link_libraries(strata-core
    PRIVATE
        strata_core
        Qt6::Core
        Qt6::Network
)

target_compile_definitions(strata-core
    PRIVATE
        STRATA_VERSION="${PROJECT_VERSION}"
)

set_target_properties(strata-core PROPERTIES
    WIN32_EXECUTABLE TRUE
    MACOSX_BUNDLE FALSE
)

include(GNUInstallDirs)
install(TARGETS strata-core
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
