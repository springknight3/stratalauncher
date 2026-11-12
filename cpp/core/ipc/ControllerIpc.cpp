#include "ControllerIpc.h"

#include <QJsonValue>
#include <QMetaMethod>
#include <QMetaObject>
#include <QMetaProperty>

#include "IpcServer.h"
#include "ThemeSettings.h"
#include "content/ContentController.h"
#include "settings/InstanceSettingsController.h"
#include "LauncherController.h"

namespace strata::ipc
{
    namespace
    {
        constexpr int kInvalidParams = -32602;

        QJsonValue ok()
        {
            return QJsonObject{{QStringLiteral("ok"), true}};
        }

        QString reqString(const QJsonObject& params, const char* key, QString* error)
        {
            const QJsonValue value = params.value(QLatin1String(key));
            if (value.isUndefined() || (value.isString() && value.toString().isEmpty()))
            {
                *error = QStringLiteral("Missing or empty parameter '%1'").arg(QLatin1String(key));
                return {};
            }
            return value.toString();
        }

        bool reqBool(const QJsonObject& params, const char* key, bool fallback, QString* error)
        {
            const QJsonValue value = params.value(QLatin1String(key));
            if (value.isUndefined())
            {
                return fallback;
            }
            if (value.isBool())
            {
                return value.toBool();
            }
            *error = QStringLiteral("Parameter '%1' must be a boolean").arg(QLatin1String(key));
            return false;
        }

        int reqInt(const QJsonObject& params, const char* key, int fallback, QString* error)
        {
            const QJsonValue value = params.value(QLatin1String(key));
            if (value.isUndefined())
            {
                return fallback;
            }
            if (value.isDouble())
            {
                return value.toInt();
            }
            *error = QStringLiteral("Parameter '%1' must be an integer").arg(QLatin1String(key));
            return 0;
        }

        QString optString(const QJsonObject& params, const char* key)
        {
            return params.value(QLatin1String(key)).toString();
        }

    } // namespace

    ControllerIpc::ControllerIpc(IpcServer& server, QObject* parent)
        : QObject(parent)
        , m_server(server)
        , m_launcher(new ui::LauncherController(this))
        , m_content(static_cast<QObject*>(
              static_cast<ui::LauncherController*>(m_launcher)->contentController()))
        , m_settings(static_cast<QObject*>(
              static_cast<ui::LauncherController*>(m_launcher)->instanceSettingsController()))
        , m_themeSettings(new ThemeSettings(QString(), this))
    {
        registerMethods();
        registerAppearanceMethods();
        connectControllerSignals(m_launcher, QStringLiteral("launcher"));

        // ContentController: single NOTIFY `contentChanged`.
        auto* content = static_cast<ui::ContentController*>(m_content);
        connect(content, &ui::ContentController::contentChanged, this, [this]() {
            m_server.emitEvent(
                QStringLiteral("content.changed"),
                QJsonObject{{QStringLiteral("state"), snapshot(m_content)}});
        });

        // InstanceSettingsController: single NOTIFY `changed`.
        auto* settings = static_cast<ui::InstanceSettingsController*>(m_settings);
        connect(settings, &ui::InstanceSettingsController::changed, this, [this]() {
            m_server.emitEvent(
                QStringLiteral("instanceSettings.changed"),
                QJsonObject{{QStringLiteral("state"), snapshot(m_settings)}});
        });

        // ThemeSettings: appearance + diagnostics properties and their NOTIFYs.
        connect(m_themeSettings, &ThemeSettings::themeChanged, this, [this]() {
            m_server.emitEvent(
                QStringLiteral("theme.changed"),
                QJsonObject{{QStringLiteral("theme"), m_themeSettings->theme()}});
        });
        connect(m_themeSettings, &ThemeSettings::reduceMotionChanged, this, [this]() {
            m_server.emitEvent(
                QStringLiteral("reduceMotion.changed"),
                QJsonObject{{QStringLiteral("reduceMotion"), m_themeSettings->reduceMotion()}});
        });
        connect(m_themeSettings, &ThemeSettings::diagnosticsChanged, this, [this]() {
            m_server.emitEvent(
                QStringLiteral("diagnostics.changed"),
                QJsonObject{
                    {QStringLiteral("vsyncEnabled"), m_themeSettings->vsyncEnabled()},
                    {QStringLiteral("frameTimeOverlayEnabled"),
                     m_themeSettings->frameTimeOverlayEnabled()},
                });
        });
        connect(m_themeSettings, &ThemeSettings::settingsError, this,
                [this](const QString& message) {
                    m_server.emitEvent(QStringLiteral("settings.error"),
                                       QJsonObject{{QStringLiteral("message"), message}});
                });
    }

    void ControllerIpc::registerAppearanceMethods()
    {
        auto* theme = m_themeSettings;
        const auto appearance = [theme]() {
            return QJsonObject{
                {QStringLiteral("theme"), theme->theme()},
                {QStringLiteral("reduceMotion"), theme->reduceMotion()},
                {QStringLiteral("vsyncEnabled"), theme->vsyncEnabled()},
                {QStringLiteral("frameTimeOverlayEnabled"), theme->frameTimeOverlayEnabled()},
            };
        };

        m_server.registerMethod(QStringLiteral("settings.getAppearance"),
                                [appearance](const QJsonObject&, int*, QString*) {
                                    return appearance();
                                });
        m_server.registerMethod(QStringLiteral("settings.setTheme"),
                                [theme](const QJsonObject& p, int* code, QString* err) {
                                    const QString name = reqString(p, "theme", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    theme->setTheme(name);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("settings.setReduceMotion"),
                                [theme](const QJsonObject& p, int* code, QString* err) {
                                    QString inner;
                                    const bool enabled = reqBool(p, "enabled", false, &inner);
                                    if (!inner.isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        *err = inner;
                                        return QJsonValue();
                                    }
                                    theme->setReduceMotion(enabled);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("settings.setDiagnostics"),
                                [theme](const QJsonObject& p, int*, QString*) {
                                    theme->setVsyncEnabled(
                                        p.value(QStringLiteral("vsyncEnabled")).toBool(true));
                                    theme->setFrameTimeOverlayEnabled(
                                        p.value(QStringLiteral("frameTimeOverlayEnabled"))
                                            .toBool(false));
                                    return ok();
                                });
    }

    QJsonObject ControllerIpc::snapshot(QObject* controller) const
    {
        QJsonObject state;
        const QMetaObject* meta = controller->metaObject();
        for (int i = 0; i < meta->propertyCount(); ++i)
        {
            const QMetaProperty property = meta->property(i);
            const QString name = QString::fromLatin1(property.name());
            if (name == QLatin1String("objectName"))
            {
                continue;
            }
            state.insert(name, QJsonValue::fromVariant(property.read(controller)));
        }
        return state;
    }

    void ControllerIpc::connectControllerSignals(QObject* controller, const QString& domain)
    {
        Q_UNUSED(domain)
        auto* launcher = qobject_cast<ui::LauncherController*>(controller);
        if (launcher == nullptr)
        {
            return;
        }

        // Every NOTIFY signal forwards a `<signal>.changed`-style event whose
        // params carry a full property snapshot of the emitting controller.
        const auto forward = [this, launcher](const QString& event) {
            return [this, launcher, event]() {
                m_server.emitEvent(
                    event, QJsonObject{{QStringLiteral("state"), snapshot(launcher)}});
            };
        };

        connect(launcher, &ui::LauncherController::versionsChanged, this,
                forward(QStringLiteral("versions.changed")));
        connect(launcher, &ui::LauncherController::loaderVersionsChanged, this,
                forward(QStringLiteral("loaderVersions.changed")));
        connect(launcher, &ui::LauncherController::instancesChanged, this,
                forward(QStringLiteral("instances.changed")));
        connect(launcher, &ui::LauncherController::lastLaunchedChanged, this,
                forward(QStringLiteral("lastLaunched.changed")));
        connect(launcher, &ui::LauncherController::launchTrackingChanged, this,
                forward(QStringLiteral("launchTracking.changed")));
        connect(launcher, &ui::LauncherController::deletingInstanceChanged, this,
                forward(QStringLiteral("deletingInstance.changed")));
        connect(launcher, &ui::LauncherController::installationChanged, this,
                forward(QStringLiteral("installation.changed")));
        connect(launcher, &ui::LauncherController::initializationChanged, this,
                forward(QStringLiteral("initialization.changed")));
        connect(launcher, &ui::LauncherController::errorMessageChanged, this,
                forward(QStringLiteral("errorMessage.changed")));
        connect(launcher, &ui::LauncherController::offlineAccountChanged, this,
                forward(QStringLiteral("offlineAccount.changed")));
        connect(launcher, &ui::LauncherController::accountsChanged, this,
                forward(QStringLiteral("accounts.changed")));
        connect(launcher, &ui::LauncherController::microsoftAuthChanged, this,
                forward(QStringLiteral("microsoftAuth.changed")));
        connect(launcher, &ui::LauncherController::consoleTextChanged, this,
                forward(QStringLiteral("consoleText.changed")));
        connect(launcher, &ui::LauncherController::consoleInstanceChanged, this,
                forward(QStringLiteral("consoleInstance.changed")));
        connect(launcher, &ui::LauncherController::runtimesChanged, this,
                forward(QStringLiteral("runtimes.changed")));
        connect(launcher, &ui::LauncherController::runtimePreferencesChanged, this,
                forward(QStringLiteral("runtimePreferences.changed")));
        connect(launcher, &ui::LauncherController::globalJavaArgumentsChanged, this,
                forward(QStringLiteral("globalJavaArguments.changed")));
        connect(launcher, &ui::LauncherController::runtimeInstallationChanged, this,
                forward(QStringLiteral("runtimeInstallation.changed")));
        connect(launcher, &ui::LauncherController::serversChanged, this,
                forward(QStringLiteral("servers.changed")));
        connect(launcher, &ui::LauncherController::serverContentChanged, this,
                forward(QStringLiteral("serverContent.changed")));

        connect(launcher, &ui::LauncherController::installFinished, this,
                [this, launcher](bool success, const QString& instanceName,
                                 const QString& error) {
                    m_server.emitEvent(
                        QStringLiteral("install.finished"),
                        QJsonObject{
                            {QStringLiteral("success"), success},
                            {QStringLiteral("instanceName"), instanceName},
                            {QStringLiteral("error"), error},
                            {QStringLiteral("state"), snapshot(launcher)},
                        });
                });
        connect(launcher, &ui::LauncherController::processStateChanged, this,
                [this, launcher](const QString& instanceId, const QString& state) {
                    m_server.emitEvent(
                        QStringLiteral("process.state.changed"),
                        QJsonObject{
                            {QStringLiteral("instanceId"), instanceId},
                            {QStringLiteral("state"), state},
                            {QStringLiteral("snapshot"), snapshot(launcher)},
                        });
                });

    }

    void ControllerIpc::registerMethods()
    {
        auto* launcher = static_cast<ui::LauncherController*>(m_launcher);
        auto* content = static_cast<ui::ContentController*>(m_content);
        auto* settings = static_cast<ui::InstanceSettingsController*>(m_settings);

        // ---- state queries -------------------------------------------------
        m_server.registerMethod(QStringLiteral("launcher.state"),
                                [this](const QJsonObject&, int*, QString*) {
                                    return snapshot(m_launcher);
                                });
        m_server.registerMethod(QStringLiteral("content.state"),
                                [this](const QJsonObject&, int*, QString*) {
                                    return snapshot(m_content);
                                });
        m_server.registerMethod(QStringLiteral("instanceSettings.state"),
                                [this](const QJsonObject&, int*, QString*) {
                                    return snapshot(m_settings);
                                });

        // ---- launcher / versions -------------------------------------------
        m_server.registerMethod(QStringLiteral("launcher.refresh"),
                                [launcher](const QJsonObject&, int*, QString*) {
                                    launcher->refresh();
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("versions.loadLoaderVersions"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    launcher->loadLoaderVersions(optString(p, "loaderType"),
                                                                 optString(p, "minecraftVersion"));
                                    Q_UNUSED(code)
                                    Q_UNUSED(err)
                                    return ok();
                                });

        // ---- install / launch / console ------------------------------------
        m_server.registerMethod(QStringLiteral("install.instance"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString name = reqString(p, "name", err);
                                    const QString versionId = reqString(p, "versionId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->installInstance(name, versionId);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("install.instanceWithLoader"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString name = reqString(p, "name", err);
                                    const QString versionId = reqString(p, "versionId", err);
                                    const QString loaderType = reqString(p, "loaderType", err);
                                    const QString loaderVersion =
                                        reqString(p, "loaderVersion", err);
                                    const int allocatedMemoryMb =
                                        reqInt(p, "allocatedMemoryMb", 0, err);
                                    const bool launchAfterInstall =
                                        reqBool(p, "launchAfterInstall", false, err);
                                    const bool useManagedJava =
                                        reqBool(p, "useManagedJava", false, err);
                                    const bool autoPerformanceMods =
                                        reqBool(p, "autoPerformanceMods", false, err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->installInstanceWithLoader(
                                        name, versionId, loaderType, loaderVersion,
                                        allocatedMemoryMb, launchAfterInstall, useManagedJava,
                                        autoPerformanceMods);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("import.scan"),
                                [launcher](const QJsonObject&, int*, QString*) {
                                    return QJsonValue::fromVariant(
                                        launcher->scanImportSources());
                                });
        m_server.registerMethod(QStringLiteral("import.instance"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString source = reqString(p, "source", err);
                                    const QString key = reqString(p, "key", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->importInstanceFromSource(
                                        source, key, optString(p, "name"),
                                        optString(p, "versionId"));
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("instances.delete"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString instanceId = reqString(p, "instanceId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->deleteInstance(instanceId);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("launch.instance"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString instanceId = reqString(p, "instanceId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->launchInstance(instanceId);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("launch.stopInstance"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString instanceId = reqString(p, "instanceId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->stopInstance(instanceId);
                                    return ok();
                                });
        m_server.registerMethod(
            QStringLiteral("launch.stopConsole"),
            [launcher](const QJsonObject&, int*, QString*) {
                launcher->stopConsoleInstance();
                return ok();
            });
        m_server.registerMethod(QStringLiteral("console.open"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString instanceId = reqString(p, "instanceId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->openConsole(instanceId);
                                    return ok();
                                });
        m_server.registerMethod(
            QStringLiteral("console.close"),
            [launcher](const QJsonObject&, int*, QString*) {
                launcher->closeConsole();
                return ok();
            });
        m_server.registerMethod(QStringLiteral("settings.setTrackInstanceLaunches"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    launcher->setTrackInstanceLaunches(
                                        reqBool(p, "track", true, err));
                                    Q_UNUSED(code)
                                    return ok();
                                });

        // ---- accounts / auth -------------------------------------------------
        m_server.registerMethod(QStringLiteral("accounts.saveOfflineUsername"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString name = reqString(p, "name", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->saveOfflineUsername(name);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("accounts.addOffline"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString name = reqString(p, "name", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->addOfflineAccount(name);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("accounts.select"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString accountId = reqString(p, "accountId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->selectAccount(accountId);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("accounts.remove"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString accountId = reqString(p, "accountId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->removeAccount(accountId);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("accounts.setMicrosoftClientId"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    launcher->setMicrosoftClientId(optString(p, "clientId"));
                                    Q_UNUSED(code)
                                    Q_UNUSED(err)
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("auth.signIn"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString clientId = reqString(p, "clientId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->signInMicrosoft(clientId);
                                    return ok();
                                });
        m_server.registerMethod(
            QStringLiteral("auth.cancel"),
            [launcher](const QJsonObject&, int*, QString*) {
                launcher->cancelMicrosoftSignIn();
                return ok();
            });

        // ---- runtime ----------------------------------------------------------
        m_server.registerMethod(QStringLiteral("runtime.setPreferences"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    launcher->setRuntimePreferences(
                                        optString(p, "vendor"),
                                        reqBool(p, "redundant", false, err));
                                    Q_UNUSED(code)
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("runtime.setGlobalJavaArguments"),
                                [launcher](const QJsonObject& p, int*, QString*) {
                                    launcher->setGlobalJavaArguments(optString(p, "flags"));
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("runtime.installForInstance"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString instanceId = reqString(p, "instanceId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->installInstanceRuntime(instanceId);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("runtime.useSystemJava"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString instanceId = reqString(p, "instanceId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->useSystemJava(instanceId);
                                    return ok();
                                });
        m_server.registerMethod(
            QStringLiteral("runtime.refresh"),
            [launcher](const QJsonObject&, int*, QString*) {
                launcher->refreshRuntimes();
                return ok();
            });
        m_server.registerMethod(QStringLiteral("runtime.delete"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString directory = reqString(p, "directory", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->deleteRuntime(directory);
                                    return ok();
                                });

        // ---- servers -----------------------------------------------------------
        m_server.registerMethod(
            QStringLiteral("servers.refresh"),
            [launcher](const QJsonObject&, int*, QString*) {
                launcher->refreshServers();
                return ok();
            });
        m_server.registerMethod(QStringLiteral("servers.create"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString name = reqString(p, "name", err);
                                    const QString version = reqString(p, "version", err);
                                    const QString distribution =
                                        reqString(p, "distribution", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->createServer(name, version, distribution);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.updateSettings"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->updateServerSettings(
                                        id, optString(p, "name"),
                                        reqBool(p, "eulaAccepted", false, err),
                                        optString(p, "javaFlags"),
                                        reqInt(p, "viewDistance", 10, err),
                                        reqBool(p, "onlineMode", true, err),
                                        reqBool(p, "useManagedJavaRuntime", true, err));
                                    Q_UNUSED(code)
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.setEulaAccepted"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->setServerEulaAccepted(
                                        id, reqBool(p, "accepted", false, err));
                                    Q_UNUSED(code)
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.loadProperties"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->loadServerProperties(id);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.saveProperties"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->saveServerProperties(id,
                                                                   optString(p, "contents"));
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.delete"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->deleteServer(id);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.select"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->selectServer(id);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.install"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->installServer(id);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.installRuntime"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->installServerRuntime(id);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.start"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->startServer(id);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.stop"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->stopServer(id);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.terminate"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->terminateServer(id);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.sendCommand"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    const QString command = reqString(p, "command", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->sendServerCommand(id, command);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.searchContent"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->searchServerContent(id,
                                                                  optString(p, "query"));
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.loadContentVersions"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    const QString projectId =
                                        reqString(p, "projectId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->loadServerContentVersions(id, projectId);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("servers.installContent"),
                                [launcher](const QJsonObject& p, int* code, QString* err) {
                                    const QString id = reqString(p, "id", err);
                                    const QString projectId =
                                        reqString(p, "projectId", err);
                                    const QString versionId =
                                        reqString(p, "versionId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    launcher->installServerContent(id, projectId, versionId);
                                    return ok();
                                });

        // ---- content -----------------------------------------------------------
        m_server.registerMethod(QStringLiteral("content.selectTarget"),
                                [content](const QJsonObject& p, int* code, QString* err) {
                                    const QString instanceId =
                                        reqString(p, "instanceId", err);
                                    const QString contentType =
                                        reqString(p, "contentType", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    content->selectTarget(instanceId, contentType);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("content.search"),
                                [content](const QJsonObject& p, int* code, QString* err) {
                                    QString inner;
                                    const int offset = reqInt(p, "offset", 0, &inner);
                                    if (!inner.isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        *err = inner;
                                        return QJsonValue();
                                    }
                                    content->search(optString(p, "query"), offset);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("content.loadVersions"),
                                [content](const QJsonObject& p, int* code, QString* err) {
                                    const QString projectId = reqString(p, "projectId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    content->loadVersions(projectId);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("content.installSelected"),
                                [content](const QJsonObject& p, int* code, QString* err) {
                                    const QString versionId =
                                        reqString(p, "versionId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    content->installSelected(versionId,
                                                             optString(p, "worldName"));
                                    return ok();
                                });
        m_server.registerMethod(
            QStringLiteral("content.confirmDependencies"),
            [content](const QJsonObject&, int*, QString*) {
                content->confirmDependencyInstall();
                return ok();
            });
        m_server.registerMethod(
            QStringLiteral("content.cancelDependencies"),
            [content](const QJsonObject&, int*, QString*) {
                content->cancelDependencyInstall();
                return ok();
            });
        m_server.registerMethod(QStringLiteral("content.setInstalledEnabled"),
                                [content](const QJsonObject& p, int* code, QString* err) {
                                    content->setInstalledEnabled(
                                        reqInt(p, "index", -1, err),
                                        reqBool(p, "enabled", true, err));
                                    Q_UNUSED(code)
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("content.removeInstalled"),
                                [content](const QJsonObject& p, int* code, QString* err) {
                                    const int index = reqInt(p, "index", -1, err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    content->removeInstalled(index);
                                    return ok();
                                });

        // ---- instance settings ---------------------------------------------------
        m_server.registerMethod(QStringLiteral("instanceSettings.load"),
                                [settings](const QJsonObject& p, int* code, QString* err) {
                                    const QString instanceId =
                                        reqString(p, "instanceId", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    settings->loadInstance(instanceId);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("instanceSettings.saveCommonOptions"),
                                [settings](const QJsonObject& p, int*, QString*) {
                                    settings->saveCommonOptions(
                                        p.value(QStringLiteral("options")).toObject().toVariantMap());
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("instanceSettings.saveOption"),
                                [settings](const QJsonObject& p, int* code, QString* err) {
                                    const QString key = reqString(p, "key", err);
                                    const QString value = reqString(p, "value", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    settings->saveOption(key, value);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("instanceSettings.saveControls"),
                                [settings](const QJsonObject& p, int*, QString*) {
                                    settings->saveControls(
                                        p.value(QStringLiteral("bindings")).toObject().toVariantMap());
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("instanceSettings.addServer"),
                                [settings](const QJsonObject& p, int* code, QString* err) {
                                    const QString name = reqString(p, "name", err);
                                    const QString address = reqString(p, "address", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    settings->addServer(name, address);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("instanceSettings.updateServer"),
                                [settings](const QJsonObject& p, int* code, QString* err) {
                                    const int index = reqInt(p, "index", -1, err);
                                    const QString name = reqString(p, "name", err);
                                    const QString address = reqString(p, "address", err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    settings->updateServer(index, name, address);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("instanceSettings.removeServer"),
                                [settings](const QJsonObject& p, int* code, QString* err) {
                                    const int index = reqInt(p, "index", -1, err);
                                    if (!err->isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        return QJsonValue();
                                    }
                                    settings->removeServer(index);
                                    return ok();
                                });
        m_server.registerMethod(QStringLiteral("instanceSettings.saveJavaFlags"),
                                [settings](const QJsonObject& p, int* code, QString* err) {
                                    QString inner;
                                    const bool overridden = reqBool(p, "overridden", false, &inner);
                                    if (!inner.isEmpty())
                                    {
                                        *code = kInvalidParams;
                                        *err = inner;
                                        return QJsonValue();
                                    }
                                    settings->saveJavaFlags(overridden, optString(p, "text"));
                                    return ok();
                                });
    }
} // namespace strata::ipc
