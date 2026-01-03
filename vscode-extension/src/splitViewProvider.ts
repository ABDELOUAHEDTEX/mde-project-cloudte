import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Split View Provider for NLP and Terraform side-by-side
 */
export class SplitViewProvider {
    private static _nlpPanel: vscode.WebviewPanel | undefined;
    private static _terraformPanel: vscode.WebviewPanel | undefined;

    /**
     * Create or reveal split view
     */
    public static async createSplitView(
        nlpContent?: string,
        terraformContent?: string,
        nlpFilePath?: string,
        terraformFilePath?: string
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Create NLP panel (left)
        if (!this._nlpPanel) {
            this._nlpPanel = vscode.window.createWebviewPanel(
                'cloudinfragenNLP',
                'NLP Source',
                { viewColumn: column || vscode.ViewColumn.One, preserveFocus: false },
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this._nlpPanel.onDidDispose(() => {
                this._nlpPanel = undefined;
            });
        }

        // Create Terraform panel (right)
        if (!this._terraformPanel) {
            this._terraformPanel = vscode.window.createWebviewPanel(
                'cloudinfragenTerraform',
                'Generated Terraform',
                { viewColumn: column ? column + 1 : vscode.ViewColumn.Two, preserveFocus: false },
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this._terraformPanel.onDidDispose(() => {
                this._terraformPanel = undefined;
            });
        }

        // Update NLP panel
        if (nlpContent !== undefined) {
            this._nlpPanel.webview.html = this._getNLPHtml(this._nlpPanel.webview, nlpContent, nlpFilePath);
        }

        // Update Terraform panel
        if (terraformContent !== undefined) {
            this._terraformPanel.webview.html = this._getTerraformHtml(this._terraformPanel.webview, terraformContent, terraformFilePath);
        }

        // Handle messages from Terraform panel
        this._terraformPanel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'openFile':
                        if (message.path) {
                            vscode.workspace.openTextDocument(message.path).then(doc => {
                                vscode.window.showTextDocument(doc);
                            });
                        }
                        return;
                    case 'showMessage':
                        if (message.message) {
                            vscode.window.showInformationMessage(message.message);
                        }
                        return;
                }
            },
            null,
            []
        );

        // Reveal panels
        this._nlpPanel.reveal(column || vscode.ViewColumn.One);
        this._terraformPanel.reveal(column ? column + 1 : vscode.ViewColumn.Two);
    }

    /**
     * Update NLP panel content
     */
    public static updateNLP(content: string, filePath?: string) {
        if (this._nlpPanel) {
            this._nlpPanel.webview.html = this._getNLPHtml(this._nlpPanel.webview, content, filePath);
        }
    }

    /**
     * Update Terraform panel content
     */
    public static updateTerraform(content: string, filePath?: string) {
        if (this._terraformPanel) {
            this._terraformPanel.webview.html = this._getTerraformHtml(this._terraformPanel.webview, content, filePath);
        }
    }

    private static _getNLPHtml(webview: vscode.Webview, content: string, filePath?: string): string {
        const escapedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NLP Source</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .file-path {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        code {
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>NLP Source</h2>
        ${filePath ? `<div class="file-path">${filePath}</div>` : ''}
    </div>
    <pre><code>${escapedContent}</code></pre>
</body>
</html>`;
    }

    private static _getTerraformHtml(webview: vscode.Webview, content: string, filePath?: string): string {
        const escapedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Terraform</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .file-path {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        .actions {
            display: flex;
            gap: 10px;
        }
        button {
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        code {
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Generated Terraform</h2>
        <div style="display: flex; align-items: center; gap: 10px;">
            ${filePath ? `<div class="file-path">${filePath}</div>` : ''}
            <div class="actions">
                <button onclick="openFile()">Open File</button>
                <button onclick="copyToClipboard()">Copy</button>
            </div>
        </div>
    </div>
    <pre><code id="terraform-content">${escapedContent}</code></pre>
    <script>
        const vscode = acquireVsCodeApi();
        function openFile() {
            vscode.postMessage({
                command: 'openFile',
                path: '${filePath || ''}'
            });
        }
        function copyToClipboard() {
            const content = document.getElementById('terraform-content').textContent;
            navigator.clipboard.writeText(content).then(() => {
                vscode.postMessage({
                    command: 'showMessage',
                    message: 'Copied to clipboard!'
                });
            });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Dispose split view
     */
    public static dispose() {
        if (this._nlpPanel) {
            this._nlpPanel.dispose();
            this._nlpPanel = undefined;
        }
        if (this._terraformPanel) {
            this._terraformPanel.dispose();
            this._terraformPanel = undefined;
        }
    }
}

