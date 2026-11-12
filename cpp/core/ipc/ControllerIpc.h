#pragma once

#include <QJsonObject>
#include <QJsonValue>
#include <QObject>

class ThemeSettings;

namespace strata::ipc
{
    class IpcServer;

    // Binds the launcher controllers' invokable surface and NOTIFY signals to
    // the JSON-RPC method/event namespace (`<domain>.<verb>` requests,
    // `<signal-name>` push events carrying a state snapshot).
    class ControllerIpc : public QObject
    {
        Q_OBJECT

    public:
        explicit ControllerIpc(IpcServer& server, QObject* parent = nullptr);

    private:
        void registerMethods();
        void registerAppearanceMethods();
        void connectControllerSignals(QObject* controller, const QString& domain);
        QJsonObject snapshot(QObject* controller) const;

        IpcServer& m_server;
        QObject* m_launcher = nullptr;
        QObject* m_content = nullptr;
        QObject* m_settings = nullptr;
        ThemeSettings* m_themeSettings = nullptr;
    };
} // namespace strata::ipc
