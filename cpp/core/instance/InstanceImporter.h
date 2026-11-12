#pragma once

#include <QList>
#include <QString>
#include <QVariantList>

namespace strata
{
    // A discovered instance in a foreign launcher's data directory.
    struct ImportCandidate
    {
        QString source;    // official | prism | sklauncher | curseforge | modrinth
        QString key;       // stable per-source identifier (profile key / dir name / file name)
        QString name;      // display name
        QString versionId; // detected Minecraft version (may be empty -> fallback)
        QString path;      // game dir, instance dir, or .mrpack file
    };

    struct ModpackIndex
    {
        QString name;
        QString minecraftVersion;
        QString loaderType;    // FABRIC | QUILT | FORGE | NEOFORGE | "" (vanilla)
        QString loaderVersion; // loader version when the index pins one
        QList<QPair<QString, QPair<QString, QString>>> files; // path -> (url, sha1)
    };

    // Scans well-known launcher data directories for importable instances.
    // Synchronous and offline; callers pass the manifest version ids so
    // detected versions can be validated, plus a fallback for unknown ones.
    QList<ImportCandidate> scanImportCandidates(const QStringList& knownVersionIds,
                                                const QString& fallbackVersion);

    // Reads a .mrpack (Modrinth app profile) index.json via libarchive.
    ModpackIndex readModpackIndex(const QString& mrpackPath);

    // Sanitizes a modpack-relative file path; returns empty when unsafe.
    QString safePackPath(const QString& relative);

    // Writes MultiMC/Pratte-compatible instance.cfg + mmc-pack.json into an
    // instance directory so other launchers can read Strata instances.
    // loaderType is a LoaderSelection::typeName() value ("" or "VANILLA" = none).
    void writeCompatibilityFiles(const QString& instanceDirectory, const QString& name,
                                 const QString& versionId, const QString& loaderType,
                                 const QString& loaderVersion);
} // namespace strata
