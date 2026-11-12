#pragma once

#include <QHash>
#include <QJsonObject>
#include <QJsonValue>
#include <QList>
#include <QObject>
#include <QPair>
#include <QString>
#include <QTimer>

#include <functional>

class QWebSocket;
class QWebSocketServer;

namespace strata::ipc
{
    // JSON-RPC 2.0 server over a loopback WebSocket. Clients must complete the
    // `ipc.authenticate` handshake with the per-session token printed in the
    // STRATA_READY line before any other method is dispatched.
    class IpcServer : public QObject
    {
        Q_OBJECT

    public:
        explicit IpcServer(QObject* parent = nullptr);
        ~IpcServer() override;

        bool listen(quint16 port, QString* error = nullptr);
        quint16 serverPort() const;
        void shutdown();

        void setAuthToken(const QString& token);
        void setServerInfo(const QString& name, const QString& version);

        // Queue a server-push event (`{"jsonrpc":"2.0","method":...,"params":...}`).
        // Events are coalesced and flushed at most every ~75 ms; a pending event
        // with the same method is replaced by the newest params (latest-wins).
        void emitEvent(const QString& method, const QJsonObject& params = QJsonObject());

        // Register a JSON-RPC method handler. Handlers run on the server's
        // thread; on success leave *errorCode at 0 and return the result.
        // Set *errorCode (JSON-RPC error code) and *errorMessage on failure.
        using MethodHandler = std::function<QJsonValue(const QJsonObject& params, int* errorCode,
                                                        QString* errorMessage)>;
        void registerMethod(const QString& method, MethodHandler handler);

    signals:
        void shutdownRequested();

    private slots:
        void onNewConnection();
        void flushEvents();

    private:
        struct Client
        {
            QWebSocket* socket = nullptr;
            bool authenticated = false;
        };

        void onTextMessageFrom(QWebSocket* socket, const QString& message);
        void onSocketDisconnected(QWebSocket* socket);
        void dispatchFrom(QWebSocket* socket, const QJsonValue& id, const QString& method,
                          const QJsonObject& params);
        QJsonValue callMethod(const QString& method, const QJsonObject& params, int* errorCode,
                              QString* errorMessage);
        void sendResponse(QWebSocket* socket, const QJsonValue& id, const QJsonValue& result);
        void sendError(QWebSocket* socket, const QJsonValue& id, int code, const QString& message);

        QWebSocketServer* m_server = nullptr;
        QList<Client> m_clients;
        QHash<QString, MethodHandler> m_handlers;
        QString m_authToken;
        QString m_serverName;
        QString m_serverVersion;
        QTimer m_eventTimer;
        QList<QPair<QString, QJsonObject>> m_pendingEvents;
    };
} // namespace strata::ipc
