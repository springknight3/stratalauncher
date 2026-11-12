#include "IpcServer.h"

#include <QDateTime>
#include <QHostAddress>
#include <QJsonDocument>
#include <QJsonValue>
#include <QWebSocket>
#include <QWebSocketServer>

#include <utility>

#include "Paths.h"

namespace strata::ipc
{
    namespace
    {
        constexpr int kParseError = -32700;
        constexpr int kInvalidRequest = -32600;
        constexpr int kMethodNotFound = -32601;
        constexpr int kServerError = -32000;
        constexpr int kAuthRequired = -32001;
        constexpr int kAuthFailed = -32002;

        constexpr int kEventFlushMs = 75;
        constexpr int kAuthTimeoutMs = 15000;
        constexpr qsizetype kMaxPendingEvents = 1000;

        QByteArray compactJson(const QJsonObject& object)
        {
            return QJsonDocument(object).toJson(QJsonDocument::Compact);
        }

        void sendText(QWebSocket* socket, const QByteArray& payload)
        {
            if (socket != nullptr && socket->isValid())
            {
                socket->sendTextMessage(QString::fromUtf8(payload));
            }
        }
    } // namespace

    IpcServer::IpcServer(QObject* parent)
        : QObject(parent)
        , m_server(new QWebSocketServer(QStringLiteral("strata-core"),
                                        QWebSocketServer::NonSecureMode,
                                        this))
    {
        connect(m_server, &QWebSocketServer::newConnection, this, &IpcServer::onNewConnection);
        m_eventTimer.setInterval(kEventFlushMs);
        m_eventTimer.setSingleShot(false);
        connect(&m_eventTimer, &QTimer::timeout, this, &IpcServer::flushEvents);
    }

    IpcServer::~IpcServer() = default;

    bool IpcServer::listen(quint16 port, QString* error)
    {
        if (!m_server->listen(QHostAddress::LocalHost, port))
        {
            if (error != nullptr)
            {
                *error = m_server->errorString();
            }
            return false;
        }
        return true;
    }

    quint16 IpcServer::serverPort() const
    {
        return m_server->serverPort();
    }

    void IpcServer::shutdown()
    {
        m_eventTimer.stop();
        for (Client& client : m_clients)
        {
            if (client.socket != nullptr)
            {
                // The server owns the socket objects; detach our callbacks so
                // nothing fires on them once the server closes them.
                client.socket->disconnect(this);
                client.socket->close();
            }
        }
        m_clients.clear();
        m_server->close();
    }

    void IpcServer::setAuthToken(const QString& token)
    {
        m_authToken = token;
    }

    void IpcServer::setServerInfo(const QString& name, const QString& version)
    {
        m_serverName = name;
        m_serverVersion = version;
    }

    void IpcServer::registerMethod(const QString& method, MethodHandler handler)
    {
        m_handlers.insert(method, std::move(handler));
    }

    void IpcServer::emitEvent(const QString& method, const QJsonObject& params)
    {
        // Latest-wins coalescing per method keeps high-frequency streams small.
        for (auto& pending : m_pendingEvents)
        {
            if (pending.first == method)
            {
                pending.second = params;
                return;
            }
        }
        if (m_pendingEvents.size() >= kMaxPendingEvents)
        {
            m_pendingEvents.removeFirst();
        }
        m_pendingEvents.append({method, params});
        if (!m_eventTimer.isActive())
        {
            m_eventTimer.start();
        }
    }

    void IpcServer::onNewConnection()
    {
        while (m_server->hasPendingConnections())
        {
            QWebSocket* socket = m_server->nextPendingConnection();
            if (socket == nullptr)
            {
                continue;
            }
            m_clients.append({socket, false});
            // Unauthenticated sockets are closed if they never authenticate.
            QTimer::singleShot(kAuthTimeoutMs, socket, [this, socket]() {
                for (const Client& client : m_clients)
                {
                    if (client.socket == socket && !client.authenticated)
                    {
                        socket->close(QWebSocketProtocol::CloseCodePolicyViolated,
                                      QStringLiteral("Authentication timeout"));
                        return;
                    }
                }
            });
            // Context `this`: Qt disconnects these automatically if either side
            // dies, so no callback can fire on a partially-destroyed server.
            connect(socket, &QWebSocket::textMessageReceived, this,
                    [this, socket](const QString& message) { onTextMessageFrom(socket, message); });
            connect(socket, &QWebSocket::disconnected, this,
                    [this, socket]() { onSocketDisconnected(socket); });
        }
    }

    void IpcServer::onTextMessageFrom(QWebSocket* socket, const QString& message)
    {
        // Browsers always send an Origin header on WebSocket handshakes; our
        // Electron main client does not. origin() is only populated once the
        // handshake completes, so this is checked on first message rather than
        // at accept time. Rejecting Origin-bearing peers blocks drive-by web
        // pages even if port+token ever leaked.
        if (!socket->origin().isEmpty())
        {
            socket->close(QWebSocketProtocol::CloseCodePolicyViolated,
                          QStringLiteral("Origin not allowed"));
            return;
        }
        QJsonParseError parseError;
        const QJsonDocument document = QJsonDocument::fromJson(message.toUtf8(), &parseError);
        if (parseError.error != QJsonParseError::NoError || !document.isObject())
        {
            sendError(socket, QJsonValue(), kParseError, QStringLiteral("Parse error"));
            return;
        }

        const QJsonObject request = document.object();
        const QString jsonrpc = request.value(QStringLiteral("jsonrpc")).toString();
        if (jsonrpc != QStringLiteral("2.0"))
        {
            sendError(socket, QJsonValue(), kInvalidRequest,
                      QStringLiteral("Invalid JSON-RPC version"));
            return;
        }

        const QJsonValue id = request.value(QStringLiteral("id"));
        const QJsonValue methodValue = request.value(QStringLiteral("method"));
        if (!methodValue.isString())
        {
            // Notifications without a method are protocol violations; requests
            // without an id are notifications and only valid with a method.
            if (id.isUndefined())
            {
                return;
            }
            sendError(socket, id, kInvalidRequest, QStringLiteral("Missing method"));
            return;
        }

        const QJsonObject params = request.value(QStringLiteral("params")).toObject();
        dispatchFrom(socket, id, methodValue.toString(), params);
    }

    void IpcServer::dispatchFrom(QWebSocket* socket, const QJsonValue& id, const QString& method,
                                 const QJsonObject& params)
    {
        Client* client = nullptr;
        for (Client& candidate : m_clients)
        {
            if (candidate.socket == socket)
            {
                client = &candidate;
                break;
            }
        }
        if (client == nullptr)
        {
            return;
        }

        if (!client->authenticated)
        {
            if (method == QStringLiteral("ipc.authenticate"))
            {
                const QString token = params.value(QStringLiteral("token")).toString();
                if (token.isEmpty() || token != m_authToken)
                {
                    sendError(socket, id, kAuthFailed, QStringLiteral("Authentication failed"));
                    socket->close(QWebSocketProtocol::CloseCodePolicyViolated,
                                  QStringLiteral("Authentication failed"));
                    return;
                }
                client->authenticated = true;
                sendResponse(socket, id,
                             QJsonObject{{QStringLiteral("authenticated"), true}});
                return;
            }
            sendError(socket, id, kAuthRequired, QStringLiteral("Authentication required"));
            return;
        }

        int errorCode = kServerError;
        QString errorMessage;
        const QJsonValue result = callMethod(method, params, &errorCode, &errorMessage);
        if (errorCode == 0)
        {
            // Notifications (no id) get no response.
            if (!id.isUndefined())
            {
                sendResponse(socket, id, result);
            }
        }
        else if (!id.isUndefined())
        {
            sendError(socket, id, errorCode, errorMessage);
        }
    }

    QJsonValue IpcServer::callMethod(const QString& method, const QJsonObject& params,
                                     int* errorCode, QString* errorMessage)
    {
        *errorCode = 0;

        if (method == QStringLiteral("ping"))
        {
            return QJsonObject{
                {QStringLiteral("pong"), true},
                {QStringLiteral("version"), m_serverVersion},
                {QStringLiteral("time"), QDateTime::currentMSecsSinceEpoch()},
            };
        }
        if (method == QStringLiteral("version"))
        {
            return QJsonObject{
                {QStringLiteral("name"), m_serverName},
                {QStringLiteral("version"), m_serverVersion},
            };
        }
        if (method == QStringLiteral("launcher.getState"))
        {
            return QJsonObject{
                {QStringLiteral("name"), m_serverName},
                {QStringLiteral("version"), m_serverVersion},
                {QStringLiteral("dataDirectory"), Paths::dataDirectory()},
            };
        }
        if (method == QStringLiteral("shutdown"))
        {
            // Defer the quit so the response reaches the client first.
            QTimer::singleShot(0, this, [this]() { emit shutdownRequested(); });
            return QJsonObject{{QStringLiteral("shuttingDown"), true}};
        }

        const auto it = m_handlers.constFind(method);
        if (it != m_handlers.constEnd())
        {
            return it.value()(params, errorCode, errorMessage);
        }

        *errorCode = kMethodNotFound;
        *errorMessage = QStringLiteral("Method not found: %1").arg(method);
        return QJsonValue();
    }

    void IpcServer::sendResponse(QWebSocket* socket, const QJsonValue& id, const QJsonValue& result)
    {
        QJsonObject response{
            {QStringLiteral("jsonrpc"), QStringLiteral("2.0")},
            {QStringLiteral("id"), id},
            {QStringLiteral("result"), result},
        };
        sendText(socket, compactJson(response));
    }

    void IpcServer::sendError(QWebSocket* socket, const QJsonValue& id, int code,
                              const QString& message)
    {
        QJsonObject error{
            {QStringLiteral("code"), code},
            {QStringLiteral("message"), message},
        };
        QJsonObject response{
            {QStringLiteral("jsonrpc"), QStringLiteral("2.0")},
            {QStringLiteral("id"), id},
            {QStringLiteral("error"), error},
        };
        sendText(socket, compactJson(response));
    }

    void IpcServer::onSocketDisconnected(QWebSocket* socket)
    {
        socket->deleteLater();
        m_clients.removeIf([socket](const Client& client) { return client.socket == socket; });
    }

    void IpcServer::flushEvents()
    {
        if (m_pendingEvents.isEmpty())
        {
            m_eventTimer.stop();
            return;
        }

        const auto pending = std::exchange(m_pendingEvents, QList<QPair<QString, QJsonObject>>());
        for (const auto& [method, params] : pending)
        {
            QJsonObject event{
                {QStringLiteral("jsonrpc"), QStringLiteral("2.0")},
                {QStringLiteral("method"), method},
                {QStringLiteral("params"), params},
            };
            const QByteArray payload = compactJson(event);
            for (const Client& client : m_clients)
            {
                if (client.authenticated && client.socket != nullptr &&
                    client.socket->isValid())
                {
                    sendText(client.socket, payload);
                }
            }
        }
    }
} // namespace strata::ipc
