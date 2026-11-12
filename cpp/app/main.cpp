// strata-core: headless launcher daemon. `strata-core serve` runs the
// JSON-RPC 2.0 IPC server consumed by the Electron client.

#include <QCommandLineParser>
#include <QCoreApplication>
#include <QDir>
#include <QJsonDocument>
#include <QJsonObject>
#include <QRandomGenerator>
#include <QTextStream>

#include <iostream>
#include <string_view>

#include "Paths.h"
#include "ipc/ControllerIpc.h"
#include "ipc/IpcServer.h"
#include "logging/LauncherLogging.h"

namespace
{
    void printVersion()
    {
        std::cout << "strata-core " << STRATA_VERSION << '\n';
    }

    QString generateToken()
    {
        // 256 bits of CSPRNG output, hex-encoded for the --token argument.
        QString token;
        token.reserve(64);
        for (int i = 0; i < 8; ++i)
        {
            const quint32 value = QRandomGenerator::system()->generate();
            token += QString::number(value, 16).rightJustified(8, QLatin1Char('0'));
        }
        return token;
    }
} // namespace

int main(int argc, char* argv[])
{
    QCoreApplication app(argc, argv);
    QCoreApplication::setApplicationName(QStringLiteral("strata-core"));
    QCoreApplication::setApplicationVersion(QStringLiteral(STRATA_VERSION));
    QCoreApplication::setOrganizationName(QStringLiteral("StrataLauncher"));
    QCoreApplication::setOrganizationDomain(QStringLiteral("stratalauncher.net"));

    for (int index = 1; index < argc; ++index)
    {
        if (std::string_view(argv[index]) == "--version")
        {
            printVersion();
            return 0;
        }
    }

    QCommandLineParser parser;
    parser.setApplicationDescription(
        QStringLiteral("StrataLauncher headless core daemon"));
    parser.addHelpOption();
    parser.addVersionOption();

    QCommandLineOption portOption({QStringLiteral("p"), QStringLiteral("port")},
                                  QStringLiteral("TCP port to listen on (0 = ephemeral)."),
                                  QStringLiteral("port"), QStringLiteral("0"));
    QCommandLineOption tokenOption({QStringLiteral("t"), QStringLiteral("token")},
                                   QStringLiteral("Per-session IPC auth token."),
                                   QStringLiteral("token"));
    QCommandLineOption dataDirOption(
        {QStringLiteral("d"), QStringLiteral("data-dir")},
        QStringLiteral("Launcher data directory (default: platform app-data dir). "
                       "'~' expands to the user home directory."),
        QStringLiteral("path"));
    parser.addOption(portOption);
    parser.addOption(tokenOption);
    parser.addOption(dataDirOption);
    parser.addPositionalArgument(QStringLiteral("command"),
                                 QStringLiteral("Subcommand (serve)."));
    parser.process(app);

    const QString command = parser.positionalArguments().value(0);
    if (command != QStringLiteral("serve"))
    {
        QTextStream(stderr) << "Usage: strata-core serve [--port N] [--token T] [--data-dir PATH]\n";
        return command.isEmpty() ? 1 : 0;
    }

    const QString dataDir = parser.value(dataDirOption);
    if (!dataDir.isEmpty())
    {
        QString expanded = dataDir;
        if (expanded == QStringLiteral("~") || expanded.startsWith(QStringLiteral("~/")))
        {
            expanded = QDir::homePath() + expanded.mid(1);
        }
        strata::Paths::setDataDirectoryOverride(expanded);
    }

    QString loggingError;
    if (!strata::LauncherLogging::configure(strata::Paths::dataDirectory(), &loggingError))
    {
        QTextStream(stderr) << loggingError << '\n';
    }

    QString token = parser.value(tokenOption);
    if (token.isEmpty())
    {
        token = generateToken();
    }

    strata::ipc::IpcServer server;
    server.setAuthToken(token);
    server.setServerInfo(QStringLiteral("strata-core"), QStringLiteral(STRATA_VERSION));
    QObject::connect(&server, &strata::ipc::IpcServer::shutdownRequested, &app,
                     &QCoreApplication::quit);

    // Bind the controller invokable surface and NOTIFY signals to IPC.
    strata::ipc::ControllerIpc controllerIpc(server);

    QString listenError;
    if (!server.listen(parser.value(portOption).toUShort(), &listenError))
    {
        QTextStream(stderr) << "Failed to listen: " << listenError << '\n';
        return 1;
    }

    // Exactly one machine-readable line on stdout; all diagnostics stay on stderr.
    const QJsonObject ready{
        {QStringLiteral("port"), server.serverPort()},
        {QStringLiteral("token"), token},
    };
    std::cout << "STRATA_READY "
              << QJsonDocument(ready).toJson(QJsonDocument::Compact).constData() << '\n';
    std::cout.flush();

    qInfo().noquote() << "strata-core" << STRATA_VERSION << "listening on 127.0.0.1:"
                      << server.serverPort();

    return app.exec();
}
