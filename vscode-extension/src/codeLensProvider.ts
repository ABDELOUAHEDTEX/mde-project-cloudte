import * as vscode from 'vscode';

/**
 * CodeLens Provider for .nlp files
 * Adds "Generate Terraform" button above NLP content
 */
export class NLPCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        vscode.workspace.onDidChangeConfiguration(_ => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    public provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        if (document.languageId !== 'nlp') {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];

        // Add "Generate Terraform" button at the top
        const topCodeLens = new vscode.CodeLens(
            new vscode.Range(0, 0, 0, 0),
            {
                title: '$(play) Generate Terraform',
                command: 'cloudinfragen.generateFromNLP',
                arguments: [document.uri.fsPath]
            }
        );
        codeLenses.push(topCodeLens);

        // Add "Open Split View" button
        const splitViewCodeLens = new vscode.CodeLens(
            new vscode.Range(0, 0, 0, 0),
            {
                title: '$(split-horizontal) Open Split View',
                command: 'cloudinfragen.openSplitView',
                arguments: [document.uri.fsPath]
            }
        );
        codeLenses.push(splitViewCodeLens);

        return codeLenses;
    }

    public resolveCodeLens(
        codeLens: vscode.CodeLens,
        token: vscode.CancellationToken
    ): vscode.CodeLens {
        return codeLens;
    }
}

