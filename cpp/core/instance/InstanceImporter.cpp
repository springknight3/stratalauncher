#include "InstanceImporter.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSaveFile>
#include <QStandardPaths>

#include <archive.h>
#include <archive_entry.h>

#include <algorithm>
#include <stdexcept>

namespace strata
{
    namespace
    {
        QString homeFile(const QString& relative)
        {
            return QDir(QDir::homePath()).filePath(relative);
        }

        QString genericDataFile(const QString& relative)
        {
            const QString base = QStandardPaths::writableLocation(
                QStandardPaths::GenericDataLocation);
            return base.isEmpty() ? QString() : QDir(base).filePath(relative);
        }

        // Returns the detected version when it is a known manifest id, or the
        // fallback when detection failed / is unknown.
        QString resolveVersion(const QString& detected, const QStringList& known,
                               const QString& fallback)
        {
            if (!detected.isEmpty() && (known.isEmpty() || known.contains(detected)))
            {
                return detected;
            }
            return fallback;
        }

        void scanMultimcStyle(const QString& root, const QString& source,
                              const QStringList& known, const QString& fallback,
                              QList<ImportCandidate>& out)
        {
            const QDir instancesDir(root);
            if (!instancesDir.exists())
            {
                return;
            }
            for (const QFileInfo& entry :
                 instancesDir.entryInfoList(QDir::Dirs | QDir::NoDotAndDotDot))
            {
                const QString dir = entry.absoluteFilePath();
                QString name = entry.fileName();
                QString detected;
                QFile cfgFile(QDir(dir).filePath(QStringLiteral("instance.cfg")));
                if (cfgFile.open(QIODevice::ReadOnly))
                {
                    const QStringList lines =
                        QString::fromUtf8(cfgFile.readAll()).split(QLatin1Char('\n'));
                    for (const QString& line : lines)
                    {
                        if (line.startsWith(QStringLiteral("name="), Qt::CaseInsensitive))
                        {
                            name = line.mid(5).trimmed();
                        }
                    }
                }
                QFile packFile(QDir(dir).filePath(QStringLiteral("mmc-pack.json")));
                if (packFile.open(QIODevice::ReadOnly))
                {
                    const QJsonDocument doc =
                        QJsonDocument::fromJson(packFile.readAll());
                    const QJsonArray components =
                        doc.object().value(QStringLiteral("components")).toArray();
                    for (const QJsonValue& component : components)
                    {
                        const QJsonObject object = component.toObject();
                        const QString uid = object.value(QStringLiteral("uid")).toString();
                        if (uid == QStringLiteral("net.minecraft"))
                        {
                            detected =
                                object.value(QStringLiteral("version")).toString();
                            break;
                        }
                    }
                }
                out.append({source, entry.fileName(), name,
                            resolveVersion(detected, known, fallback), dir});
            }
        }
    } // namespace

    QList<ImportCandidate> scanImportCandidates(const QStringList& knownVersionIds,
                                                const QString& fallbackVersion)
    {
        QList<ImportCandidate> result;

        // Official Minecraft Launcher: launcher_profiles.json under ~/.minecraft.
        const QString officialDir = homeFile(QStringLiteral(".minecraft"));
        QFile profilesFile(QDir(officialDir).filePath(
            QStringLiteral("launcher_profiles.json")));
        if (profilesFile.open(QIODevice::ReadOnly))
        {
            const QJsonDocument doc = QJsonDocument::fromJson(profilesFile.readAll());
            const QJsonObject profiles =
                doc.object().value(QStringLiteral("profiles")).toObject();
            for (auto it = profiles.constBegin(); it != profiles.constEnd(); ++it)
            {
                const QJsonObject profile = it.value().toObject();
                QString gameDir =
                    profile.value(QStringLiteral("gameDir")).toString().trimmed();
                if (gameDir.isEmpty())
                {
                    gameDir = officialDir;
                }
                else if (QDir(gameDir).isRelative())
                {
                    gameDir = QDir(officialDir).filePath(gameDir);
                }
                if (!QDir(gameDir).exists())
                {
                    continue;
                }
                const QString detected =
                    profile.value(QStringLiteral("lastVersionId")).toString();
                result.append(
                    {QStringLiteral("official"), it.key(),
                     profile.value(QStringLiteral("name")).toString(
                         it.key()),
                     resolveVersion(detected, knownVersionIds, fallbackVersion),
                     gameDir});
            }
        }

        // PrismLauncher and SKLauncher share the MultiMC instance layout.
        scanMultimcStyle(
            genericDataFile(QStringLiteral("PrismLauncher/instances")),
            QStringLiteral("prism"), knownVersionIds, fallbackVersion, result);
        scanMultimcStyle(
            genericDataFile(QStringLiteral("SKLauncher/instances")),
            QStringLiteral("sklauncher"), knownVersionIds, fallbackVersion, result);
        scanMultimcStyle(homeFile(QStringLiteral(".sklauncher/instances")),
                         QStringLiteral("sklauncher"), knownVersionIds, fallbackVersion,
                         result);

        // CurseForge app: <data>/CurseForge/minecraft/Instances/<name>/.
        const QDir curseDir(genericDataFile(
            QStringLiteral("CurseForge/minecraft/Instances")));
        if (curseDir.exists())
        {
            for (const QFileInfo& entry :
                 curseDir.entryInfoList(QDir::Dirs | QDir::NoDotAndDotDot))
            {
                QString name = entry.fileName();
                QString detected;
                QFile infoFile(
                    QDir(entry.absoluteFilePath())
                        .filePath(QStringLiteral("minecraftinstance.json")));
                if (infoFile.open(QIODevice::ReadOnly))
                {
                    const QJsonObject info =
                        QJsonDocument::fromJson(infoFile.readAll()).object();
                    name = info.value(QStringLiteral("name")).toString(name);
                    detected = info.value(QStringLiteral("gameVersion"))
                                   .toString(info.value(QStringLiteral("minecraftVersion"))
                                                 .toString());
                }
                result.append({QStringLiteral("curseforge"), entry.fileName(), name,
                               resolveVersion(detected, knownVersionIds, fallbackVersion),
                               entry.absoluteFilePath()});
            }
        }

        // Modrinth app: profiles/*.mrpack (zip with modrinth.index.json).
        const QDir modrinthDir(
            genericDataFile(QStringLiteral("com.modrinth.theseus/profiles")));
        if (modrinthDir.exists())
        {
            for (const QFileInfo& entry : modrinthDir.entryInfoList(
                     {QStringLiteral("*.mrpack")}, QDir::Files))
            {
                ModpackIndex index;
                try
                {
                    index = readModpackIndex(entry.absoluteFilePath());
                }
                catch (...)
                {
                    index = {};
                }
                const QString name =
                    index.name.isEmpty() ? entry.completeBaseName() : index.name;
                result.append({QStringLiteral("modrinth"), entry.fileName(), name,
                               resolveVersion(index.minecraftVersion, knownVersionIds,
                                              fallbackVersion),
                               entry.absoluteFilePath()});
            }
        }

        return result;
    }

    QString safePackPath(const QString& relative)
    {
        const QString cleaned = QDir::cleanPath(relative);
        if (cleaned.isEmpty() || cleaned == QStringLiteral(".") ||
            cleaned.startsWith(QLatin1Char('/')) || cleaned.contains(QStringLiteral("..")))
        {
            return QString();
        }
        return cleaned;
    }

    void writeCompatibilityFiles(const QString& instanceDirectory, const QString& name,
                                 const QString& versionId, const QString& loaderType,
                                 const QString& loaderVersion)
    {
        // instance.cfg: the key=value format MultiMC-derived launchers read.
        QString cfg = QStringLiteral("InstanceType=OneSix\niconKey=default\n");
        cfg += QStringLiteral("name=%1\n").arg(name);
        QFile cfgFile(QDir(instanceDirectory).filePath(QStringLiteral("instance.cfg")));
        if (cfgFile.open(QIODevice::WriteOnly | QIODevice::Truncate))
        {
            cfgFile.write(cfg.toUtf8());
        }

        // mmc-pack.json: component list other launchers use for imports.
        QJsonArray components;
        components.append(QJsonObject{{QStringLiteral("uid"),
                                       QStringLiteral("net.minecraft")},
                                      {QStringLiteral("version"), versionId},
                                      {QStringLiteral("important"), true}});
        QString componentUid;
        if (loaderType == QStringLiteral("FABRIC"))
        {
            componentUid = QStringLiteral("net.fabricmc.fabric-loader");
        }
        else if (loaderType == QStringLiteral("QUILT"))
        {
            componentUid = QStringLiteral("org.quiltmc.quilt-loader");
        }
        else if (loaderType == QStringLiteral("FORGE"))
        {
            componentUid = QStringLiteral("net.minecraftforge");
        }
        else if (loaderType == QStringLiteral("NEOFORGE"))
        {
            componentUid = QStringLiteral("net.neoforged");
        }
        if (!componentUid.isEmpty())
        {
            components.append(QJsonObject{{QStringLiteral("uid"), componentUid},
                                           {QStringLiteral("version"), loaderVersion}});
        }
        const QJsonDocument pack{{{QStringLiteral("formatVersion"), 1},
                                  {QStringLiteral("components"), components}}};
        QFile packFile(QDir(instanceDirectory).filePath(QStringLiteral("mmc-pack.json")));
        if (packFile.open(QIODevice::WriteOnly | QIODevice::Truncate))
        {
            packFile.write(pack.toJson(QJsonDocument::Indented));
        }
    }

    ModpackIndex readModpackIndex(const QString& mrpackPath)
    {
        ModpackIndex index;
        archive* arch = archive_read_new();
        archive_read_support_format_all(arch);
        archive_read_support_filter_all(arch);
        if (archive_read_open_filename(arch, QFile::encodeName(mrpackPath).constData(),
                                       10240) != ARCHIVE_OK)
        {
            archive_read_free(arch);
            throw std::runtime_error("Unable to open modpack archive.");
        }
        QByteArray json;
        archive_entry* entry = nullptr;
        while (archive_read_next_header(arch, &entry) == ARCHIVE_OK)
        {
            const QString name = QString::fromUtf8(archive_entry_pathname(entry));
            if (name == QStringLiteral("modrinth.index.json"))
            {
                json.resize(static_cast<qsizetype>(archive_entry_size(entry)));
                const la_ssize_t read =
                    archive_read_data(arch, json.data(), json.size());
                if (read < 0)
                {
                    archive_read_free(arch);
                    throw std::runtime_error("Unable to read modpack index.");
                }
                json.resize(read);
                break;
            }
            archive_read_data_skip(arch);
        }
        archive_read_free(arch);
        if (json.isEmpty())
        {
            throw std::runtime_error("Modpack archive has no modrinth.index.json.");
        }
        const QJsonObject root =
            QJsonDocument::fromJson(json).object();
        index.name = root.value(QStringLiteral("name")).toString();
        const QJsonObject dependencies =
            root.value(QStringLiteral("dependencies")).toObject();
        index.minecraftVersion =
            dependencies.value(QStringLiteral("minecraft")).toString();
        const QJsonObject loaders = dependencies;
        for (const char* key : {"fabric-loader", "quilt-loader", "forge", "neoform"})
        {
            const QString value = loaders.value(QLatin1String(key)).toString();
            if (value.isEmpty())
            {
                continue;
            }
            if (QLatin1String(key) == "fabric-loader")
            {
                index.loaderType = QStringLiteral("FABRIC");
            }
            else if (QLatin1String(key) == "quilt-loader")
            {
                index.loaderType = QStringLiteral("QUILT");
            }
            else if (QLatin1String(key) == "neoform")
            {
                index.loaderType = QStringLiteral("NEOFORGE");
            }
            else
            {
                index.loaderType = QStringLiteral("FORGE");
            }
            index.loaderVersion = value;
            break;
        }
        const QJsonArray files = root.value(QStringLiteral("files")).toArray();
        for (const QJsonValue& fileValue : files)
        {
            const QJsonObject file = fileValue.toObject();
            const QString rel = safePackPath(file.value(QStringLiteral("path")).toString());
            if (rel.isEmpty())
            {
                continue;
            }
            QString url;
            const QJsonArray downloads = file.value(QStringLiteral("downloads")).toArray();
            if (!downloads.isEmpty())
            {
                url = downloads.first().toString();
            }
            QString sha1;
            const QJsonObject hashes = file.value(QStringLiteral("hashes")).toObject();
            sha1 = hashes.value(QStringLiteral("sha1")).toString();
            index.files.append({rel, {url, sha1}});
        }
        return index;
    }
} // namespace strata
