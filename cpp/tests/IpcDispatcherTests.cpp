#include <QElapsedTimer>
#include <QJsonDocument>
#include <QJsonObject>
#include <QTest>
#include <QUrl>
#include <QWebSocket>

#include <memory>

#include "ipc/IpcServer.h"

class IpcDispatcherTests : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();

    void rejectsUnauthenticatedRequests();
    void rejectsBadToken();
    void pingAndVersion();
    void unknownMethod();
    void registeredHandler();
    void eventsAreCoalesced();

private:
    std::unique_ptr<strata::ipc::IpcServer> m_server;
    const QString m_token = QStringLiteral("test-token");
    QList<QJsonObject> m_received;

    QWebSocket* m_client = nullptr;
    QWebSocket* connectClient();
    void authenticate(QWebSocket& socket);
    void sendRpc(QWebSocket& socket, int id, const QString& method,
                 const QJsonObject& params = QJsonObject());
    QJsonObject waitForResponse(int id, int timeoutMs = 3000);
    void drainEvents(int timeoutMs = 1500);
};

void IpcDispatcherTests::initTestCase()
{
    m_server = std::make_unique<strata::ipc::IpcServer>();
    m_server->setAuthToken(m_token);
    m_server->setServerInfo(QStringLiteral("strata-core"), QStringLiteral("0.0.0-test"));
    QString error;
    QVERIFY2(m_server->listen(0, &error), qPrintable(error));
}

void IpcDispatcherTests::cleanupTestCase()
{
    m_server->shutdown();
}

void IpcDispatcherTests::init()
{
    m_received.clear();
    if (m_client != nullptr)
    {
        m_client->disconnect(this);
        m_client->close();
        m_client->deleteLater();
        m_client = nullptr;
        QCoreApplication::processEvents(QEventLoop::AllEvents, 50);
    }
    m_server->registerMethod(QStringLiteral("test.echo"),
                             [](const QJsonObject& params, int*, QString*) {
                                 return QJsonObject{{QStringLiteral("echo"), params}};
                             });
    m_server->registerMethod(QStringLiteral("test.fail"),
                             [](const QJsonObject&, int* code, QString* message) {
                                 *code = -32000;
                                 *message = QStringLiteral("boom");
                                 return QJsonValue();
                             });
}

QWebSocket* IpcDispatcherTests::connectClient()
{
    m_client = new QWebSocket(QString(), QWebSocketProtocol::VersionLatest, this);
    connect(m_client, &QWebSocket::textMessageReceived, this,
            [this](const QString& text) {
                m_received.append(QJsonDocument::fromJson(text.toUtf8()).object());
            });
    m_client->open(QUrl(QStringLiteral("ws://127.0.0.1:%1").arg(m_server->serverPort())));
    QElapsedTimer timer;
    timer.start();
    while (m_client->state() != QAbstractSocket::ConnectedState && timer.elapsed() < 3000)
    {
        QCoreApplication::processEvents(QEventLoop::AllEvents, 20);
        QTest::qWait(5);
    }
    return m_client;
}

void IpcDispatcherTests::authenticate(QWebSocket& socket)
{
    sendRpc(socket, 1, QStringLiteral("ipc.authenticate"),
            QJsonObject{{QStringLiteral("token"), m_token}});
    const QJsonObject response = waitForResponse(1);
    QVERIFY(response.contains(QStringLiteral("result")));
    QVERIFY(response.value(QStringLiteral("result"))
                .toObject()
                .value(QStringLiteral("authenticated"))
                .toBool());
}

void IpcDispatcherTests::sendRpc(QWebSocket& socket, int id, const QString& method,
                                 const QJsonObject& params)
{
    const QJsonObject request{
        {QStringLiteral("jsonrpc"), QStringLiteral("2.0")},
        {QStringLiteral("id"), id},
        {QStringLiteral("method"), method},
        {QStringLiteral("params"), params},
    };
    socket.sendTextMessage(
        QString::fromUtf8(QJsonDocument(request).toJson(QJsonDocument::Compact)));
}

QJsonObject IpcDispatcherTests::waitForResponse(int id, int timeoutMs)
{
    QElapsedTimer timer;
    timer.start();
    while (timer.elapsed() < timeoutMs)
    {
        QCoreApplication::processEvents(QEventLoop::AllEvents, 20);
        for (int i = 0; i < m_received.size(); ++i)
        {
            const QJsonObject message = m_received.at(i);
            if (message.value(QStringLiteral("id")).toInt(-1) == id)
            {
                m_received.remove(i);
                return message;
            }
        }
        QTest::qWait(5);
    }
    return {};
}

void IpcDispatcherTests::drainEvents(int timeoutMs)
{
    QElapsedTimer timer;
    timer.start();
    while (timer.elapsed() < timeoutMs)
    {
        QCoreApplication::processEvents(QEventLoop::AllEvents, 20);
        QTest::qWait(10);
    }
}

void IpcDispatcherTests::rejectsUnauthenticatedRequests()
{
    QWebSocket* socket = connectClient();
    QVERIFY(socket->state() == QAbstractSocket::ConnectedState);
    sendRpc(*socket, 7, QStringLiteral("ping"));
    const QJsonObject response = waitForResponse(7);
    QVERIFY(response.contains(QStringLiteral("error")));
    QCOMPARE(response.value(QStringLiteral("error")).toObject().value(QStringLiteral("code")).toInt(),
             -32001);
}

void IpcDispatcherTests::rejectsBadToken()
{
    QWebSocket* socket = connectClient();
    QVERIFY(socket->state() == QAbstractSocket::ConnectedState);
    sendRpc(*socket, 1, QStringLiteral("ipc.authenticate"),
            QJsonObject{{QStringLiteral("token"), QStringLiteral("wrong")}});
    const QJsonObject response = waitForResponse(1);
    QVERIFY(response.contains(QStringLiteral("error")));
    QCOMPARE(response.value(QStringLiteral("error")).toObject().value(QStringLiteral("code")).toInt(),
             -32002);
    // Server closes the socket after a failed handshake.
    QElapsedTimer timer;
    timer.start();
    while (socket->state() != QAbstractSocket::UnconnectedState && timer.elapsed() < 3000)
    {
        QCoreApplication::processEvents(QEventLoop::AllEvents, 20);
        QTest::qWait(5);
    }
    QCOMPARE(socket->state(), QAbstractSocket::UnconnectedState);
}

void IpcDispatcherTests::pingAndVersion()
{
    QWebSocket* socket = connectClient();
    QVERIFY(socket->state() == QAbstractSocket::ConnectedState);
    authenticate(*socket);

    sendRpc(*socket, 2, QStringLiteral("ping"));
    const QJsonObject pong = waitForResponse(2);
    QVERIFY(pong.contains(QStringLiteral("result")));
    const QJsonObject result = pong.value(QStringLiteral("result")).toObject();
    QVERIFY(result.value(QStringLiteral("pong")).toBool());
    QCOMPARE(result.value(QStringLiteral("version")).toString(),
             QStringLiteral("0.0.0-test"));

    sendRpc(*socket, 3, QStringLiteral("version"));
    const QJsonObject version = waitForResponse(3);
    const QJsonObject vresult = version.value(QStringLiteral("result")).toObject();
    QCOMPARE(vresult.value(QStringLiteral("name")).toString(), QStringLiteral("strata-core"));
}

void IpcDispatcherTests::unknownMethod()
{
    QWebSocket* socket = connectClient();
    QVERIFY(socket->state() == QAbstractSocket::ConnectedState);
    authenticate(*socket);

    sendRpc(*socket, 9, QStringLiteral("no.such.method"));
    const QJsonObject response = waitForResponse(9);
    QCOMPARE(response.value(QStringLiteral("error")).toObject().value(QStringLiteral("code")).toInt(),
             -32601);
}

void IpcDispatcherTests::registeredHandler()
{
    QWebSocket* socket = connectClient();
    QVERIFY(socket->state() == QAbstractSocket::ConnectedState);
    authenticate(*socket);

    sendRpc(*socket, 10, QStringLiteral("test.echo"),
            QJsonObject{{QStringLiteral("hello"), QStringLiteral("world")}});
    const QJsonObject response = waitForResponse(10);
    const QJsonObject echo =
        response.value(QStringLiteral("result")).toObject().value(QStringLiteral("echo")).toObject();
    QCOMPARE(echo.value(QStringLiteral("hello")).toString(), QStringLiteral("world"));

    sendRpc(*socket, 11, QStringLiteral("test.fail"));
    const QJsonObject failure = waitForResponse(11);
    QCOMPARE(failure.value(QStringLiteral("error")).toObject().value(QStringLiteral("code")).toInt(),
             -32000);
}

void IpcDispatcherTests::eventsAreCoalesced()
{
    QWebSocket* socket = connectClient();
    QVERIFY(socket->state() == QAbstractSocket::ConnectedState);
    authenticate(*socket);
    m_received.clear();

    // Five events for the same method inside one flush window collapse to the
    // latest params; a different method still arrives separately.
    for (int i = 0; i < 5; ++i)
    {
        m_server->emitEvent(QStringLiteral("test.tick"), QJsonObject{{QStringLiteral("n"), i}});
    }
    m_server->emitEvent(QStringLiteral("test.other"), QJsonObject{});

    drainEvents(1500);

    QStringList methods;
    int tickCount = 0;
    for (const QJsonObject& message : m_received)
    {
        if (!message.contains(QStringLiteral("method")))
        {
            continue;
        }
        const QString method = message.value(QStringLiteral("method")).toString();
        if (method == QLatin1String("test.tick"))
        {
            ++tickCount;
            // Latest-wins: only the last emitted params survive coalescing.
            QCOMPARE(message.value(QStringLiteral("params")).toObject()
                         .value(QStringLiteral("n"))
                         .toInt(),
                     4);
        }
        methods << method;
    }
    QCOMPARE(tickCount, 1);
    QVERIFY(methods.contains(QStringLiteral("test.other")));
}

QTEST_MAIN(IpcDispatcherTests)
#include "IpcDispatcherTests.moc"
