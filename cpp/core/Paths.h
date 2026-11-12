#pragma once

#include <QString>

namespace strata
{
    enum class OperatingSystem
    {
        Windows,
        MacOS,
        Linux
    };

    class Paths
    {
    public:
        static QString dataDirectory();
        // Overrides the platform default for this process (set once at
        // startup, e.g. from a --data-dir CLI option). Empty clears it.
        static void setDataDirectoryOverride(const QString& directory);
        static QString dataDirectoryOverride();
        static QString dataDirectory(OperatingSystem operatingSystem, const QString& homeDirectory,
                                     const QString& appDataDirectory = QString(),
                                     const QString& xdgDataHome = QString());
    };
} // namespace strata
