import * as vscode from 'vscode';

/**
 * Status Bar Manager for CloudInfraGen
 */
export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private providerStatusBarItem: vscode.StatusBarItem;
    private resourceCountStatusBarItem: vscode.StatusBarItem;

    constructor() {
        // Main status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'cloudinfragen.showOutput';
        this.statusBarItem.tooltip = 'CloudInfraGen: Click to show output';

        // Provider status bar item
        this.providerStatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.providerStatusBarItem.tooltip = 'Cloud Provider';

        // Resource count status bar item
        this.resourceCountStatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            98
        );
        this.resourceCountStatusBarItem.tooltip = 'Number of resources';

        this.showIdle();
    }

    /**
     * Show idle state
     */
    public showIdle() {
        this.statusBarItem.text = '$(cloud) CloudInfraGen';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.show();

        this.providerStatusBarItem.hide();
        this.resourceCountStatusBarItem.hide();
    }

    /**
     * Show generating state
     */
    public showGenerating() {
        this.statusBarItem.text = '$(sync~spin) Generating...';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        this.statusBarItem.show();
    }

    /**
     * Show success state
     */
    public showSuccess(provider?: string, resourceCount?: number) {
        this.statusBarItem.text = '$(check) Generated';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.show();

        if (provider) {
            this.providerStatusBarItem.text = `$(cloud) ${provider}`;
            this.providerStatusBarItem.show();
        }

        if (resourceCount !== undefined) {
            this.resourceCountStatusBarItem.text = `$(list-unordered) ${resourceCount} resources`;
            this.resourceCountStatusBarItem.show();
        }
    }

    /**
     * Show error state
     */
    public showError(message?: string) {
        this.statusBarItem.text = '$(error) Generation Failed';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.statusBarItem.show();

        this.providerStatusBarItem.hide();
        this.resourceCountStatusBarItem.hide();
    }

    /**
     * Update provider
     */
    public updateProvider(provider: string) {
        this.providerStatusBarItem.text = `$(cloud) ${provider}`;
        this.providerStatusBarItem.show();
    }

    /**
     * Update resource count
     */
    public updateResourceCount(count: number) {
        this.resourceCountStatusBarItem.text = `$(list-unordered) ${count} resources`;
        this.resourceCountStatusBarItem.show();
    }

    /**
     * Dispose status bar items
     */
    public dispose() {
        this.statusBarItem.dispose();
        this.providerStatusBarItem.dispose();
        this.resourceCountStatusBarItem.dispose();
    }
}

