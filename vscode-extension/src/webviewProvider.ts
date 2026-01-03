import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Webview Provider for CloudInfraGen model preview
 */
export class ModelPreviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'cloudinfragen.preview';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'refresh':
                        this.refresh();
                        return;
                    case 'openTerraform':
                        if (message.path) {
                            vscode.workspace.openTextDocument(message.path).then(doc => {
                                vscode.window.showTextDocument(doc);
                            });
                        }
                        return;
                }
            },
            null,
            this._context.subscriptions
        );
    }

    /**
     * Update preview with model data
     */
    public updatePreview(data: {
        provider?: string;
        resourceCount?: number;
        resources?: any[];
        terraformFile?: string;
        modelFile?: string;
    }) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'update',
                data: data
            });
        }
    }

    /**
     * Refresh preview
     */
    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'preview.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'preview.css')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>CloudInfraGen Preview</title>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Infrastructure Preview</h2>
            <button id="refresh-btn" class="btn">Refresh</button>
        </div>
        <div id="content" class="content">
            <div class="empty-state">
                <p>No model loaded. Generate infrastructure to see preview.</p>
            </div>
        </div>
    </div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}

